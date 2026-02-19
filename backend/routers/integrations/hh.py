
import requests
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database.models import IntegrationSettings
from dependencies import get_db, get_current_active_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/integrations/hh", tags=["integrations-hh"])

class CandidateSchema(BaseModel):
    id: str
    name: str 
    position: str
    experience: str
    salary: Optional[int] = 0
    skills: List[str]
    source: str = "HeadHunter"
    avatar: Optional[str] = None
    url: str
    area: str

@router.get("/search", response_model=List[CandidateSchema])
def search_candidates(
    text: str,
    area: Optional[int] = 1, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    # 1. Get Settings
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == 'hh').first()
    if not setting or not setting.is_active:
         raise HTTPException(status_code=400, detail="HH Integration is not active")
    
    if not setting.client_id or not setting.client_secret:
         raise HTTPException(status_code=400, detail="HH Integration credentials missing")

    # 2. Get Access Token (with caching)
    current_time = int(time.time())
    
    # Check cache in DB (additional_params)
    params = setting.additional_params or {}
    cached_token = params.get("access_token")
    expires_at = params.get("token_expires_at", 0)
    
    access_token = None
    
    # If token exists and is valid for at least another minute
    if cached_token and expires_at > (current_time + 60):
        access_token = cached_token
    else:
        # Request new token
        token_url = "https://hh.ru/oauth/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": setting.client_id,
            "client_secret": setting.client_secret
        }
        
        # HH requires specific User-Agent format: AppName/Version (email)
        headers = {"User-Agent": "FOT-Corporate-System/1.0 (admin@fot.local)"}
        
        try:
            auth_resp = requests.post(token_url, data=payload, headers=headers, timeout=5)
            
            if auth_resp.status_code != 200:
                 # If we get a rate limit error here, we might be stuck until we wait.
                 # But usually this happens because we didn't cache. Now we caching.
                 err_detail = auth_resp.text
                 try:
                     err_json = auth_resp.json()
                     err_detail = err_json.get('error_description', err_detail)
                 except: pass
                 raise HTTPException(status_code=400, detail=f"HH Auth Failed: {err_detail}")
            
            auth_data = auth_resp.json()
            access_token = auth_data['access_token']
            expires_in = auth_data.get('expires_in', 1209600) # Default 14 days for HH usually
            
            # Save to DB
            new_params = dict(params) if params else {}
            new_params["access_token"] = access_token
            new_params["token_expires_at"] = current_time + expires_in
            
            # We must assign a new dict to trigger SQLAlchemy change tracking for JSON? 
            # Sometimes modifying in place doesn't work.
            setting.additional_params = new_params
            
            # Use `flag_modified` if needed, but reassignment usually works.
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(setting, "additional_params")
            
            db.commit()
            
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"HH Connection Error: {str(e)}")

    # 3. Search Resumes
    
    search_url = "https://api.hh.ru/resumes"
    search_params = {
        "text": text,
        "per_page": 20,
        # "area": area # Optional
    }
    
    search_headers = {
        "User-Agent": "FOT-Corporate-System/1.0 (admin@fot.local)",
        "Authorization": f"Bearer {access_token}"
    }

    try:
        resp = requests.get(search_url, params=search_params, headers=search_headers, timeout=10)
        
        if resp.status_code == 403:
             raise HTTPException(status_code=403, detail="Доступ к поиску резюме запрещен (403). Проверьте права приложения на сайте HH.")
        
        if resp.status_code != 200:
             # If token invalid (401), we might need to clear cache?
             if resp.status_code == 401:
                 # Clear cache logic could go here
                 pass
             raise HTTPException(status_code=resp.status_code, detail=f"HH Search Error: {resp.text}")
        
        data = resp.json()
        items = data.get('items', [])
        
        results = []
        for item in items:
            # Experience
            exp_months = item.get('total_experience', {}).get('months', 0)
            exp_years = exp_months // 12
            exp_str = f"{exp_years} years" if exp_years > 0 else f"{exp_months} months"
            
            # Salary
            salary_data = item.get('salary')
            salary_val = 0
            if salary_data:
                salary_val = salary_data.get('amount') or 0
                if salary_data.get('currency') == 'USD':
                     salary_val = salary_val * 90 
            
            # Skills
            skills = []
            for s in item.get('skill_set', []):
                skills.append(s)
            
            # Name
            full_name = "Candidate (Hidden)"
            if item.get('first_name'):
                 full_name = f"{item.get('first_name')} {item.get('last_name', '')}"
            elif item.get('title'):
                 full_name = item.get('title')
            
            avatar_url = None
            if item.get('photo'):
                 avatar_url = item.get('photo', {}).get('medium')

            results.append({
                "id": str(item.get('id')),
                "name": full_name,
                "position": item.get('title', 'Unknown'),
                "experience": exp_str,
                "salary": salary_val,
                "skills": skills,
                "source": "HH.ru",
                "avatar": avatar_url,
                "url": item.get('alternate_url', ''),
                "area": item.get('area', {}).get('name', 'Unknown')
            })
            
        return results

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
