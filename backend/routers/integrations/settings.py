import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database.models import IntegrationSettings
from dependencies import get_db, get_current_active_user

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# --- Schemas ---
class IntegrationSettingsUpdate(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    is_active: bool
    additional_params: Optional[dict] = {}

class IntegrationSettingsResponse(BaseModel):
    id: int
    service_name: str
    is_active: bool
    has_api_key: bool # Don't return the actual key
    has_client_secret: bool
    client_id: Optional[str] = None
    updated_at: str

class TestConnectionRequest(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    base_url: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str

class AnalyzeRequest(BaseModel):
    candidate_data: dict
    job_description: Optional[str] = None

class AnalyzeResponse(BaseModel):
    analysis: str
    match_score: int

# --- Endpoints ---

@router.get("/settings", response_model=List[IntegrationSettingsResponse])
def get_integration_settings(db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    """Get all integration settings (masked)"""
    # Check if admin (optional, for now open to active users or restrict to admin)
    
    settings = db.query(IntegrationSettings).all()
    response = []
    
    # Ensure default entries exist if not found (lazy init)
    services = ['hh', 'openai']
    existing_services = [s.service_name for s in settings]
    
    for service in services:
        if service not in existing_services:
            new_setting = IntegrationSettings(service_name=service)
            db.add(new_setting)
            db.commit()
            db.refresh(new_setting)
            settings.append(new_setting)
            
    for s in settings:
        response.append({
            "id": s.id,
            "service_name": s.service_name,
            "is_active": s.is_active,
            "has_api_key": bool(s.api_key),
            "has_client_secret": bool(s.client_secret),
            "client_id": s.client_id,
            "updated_at": s.updated_at
        })
        
    return response

@router.post("/settings", response_model=IntegrationSettingsResponse)
def update_integration_settings(
    data: IntegrationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Update settings for a service"""
    # In real app: Add permission check!
    
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == data.service_name).first()
    if not setting:
        setting = IntegrationSettings(service_name=data.service_name)
        db.add(setting)
    
    # Update fields only if provided (to allow partial updates without re-sending secrets)
    if data.api_key is not None: # Allow clearing if empty string passed? Or explicit null? treating non-None as update
        setting.api_key = data.api_key
    if data.client_id is not None:
        setting.client_id = data.client_id
    if data.client_secret is not None:
        setting.client_secret = data.client_secret
        
    setting.is_active = data.is_active
    if data.additional_params:
        setting.additional_params = data.additional_params
        
    db.commit()
    db.refresh(setting)
    
    return {
        "id": setting.id,
        "service_name": setting.service_name,
        "is_active": setting.is_active,
        "has_api_key": bool(setting.api_key),
        "has_client_secret": bool(setting.client_secret),
        "client_id": setting.client_id,
        "updated_at": setting.updated_at
    }

@router.post("/test-connection", response_model=TestConnectionResponse)
def test_connection(
    data: TestConnectionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == data.service_name).first()
    if not setting:
        setting = IntegrationSettings(service_name=data.service_name)

    # Use provided keys if available, else fallback to DB
    client_id = data.client_id or setting.client_id
    client_secret = data.client_secret or setting.client_secret
    api_key = data.api_key or setting.api_key

    if data.service_name == 'hh':
        if not client_id or not client_secret:
             return {"success": False, "message": "Client ID and Client Secret are required"}
        
        # Test HH connection by trying to get an access token (client credentials flow)
        try:
            token_url = "https://hh.ru/oauth/token"
            payload = {
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret
            }
            # HH requires User-Agent
            headers = {"User-Agent": "FOT-Manager/1.0 (test@example.com)"}
            
            resp = requests.post(token_url, data=payload, headers=headers, timeout=5)
            
            if resp.status_code == 200:
                 return {"success": True, "message": "Connection successful! Token received."}
            elif resp.status_code == 400 or resp.status_code == 401:
                 return {"success": False, "message": f"Auth failed from HH: {resp.json().get('error_description', 'Invalid credentials')}"}
            else:
                 return {"success": False, "message": f"HH API Error: {resp.status_code}"}

        except Exception as e:
            return {"success": False, "message": f"Connection error: {str(e)}"}

    elif data.service_name == 'openai':
        if not api_key:
             return {"success": False, "message": "API Key is required"}
        
        # Determine base URL: Priority: Request param > DB param > default OpenAI
        base_url = data.base_url or (setting.additional_params or {}).get('base_url') or "https://api.openai.com/v1"
        
        # Ensure base_url doesn't end with slash for consistency if we append /models
        base_url = base_url.rstrip('/')
        
        try:
            # Simple models list call
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            # Use /models for testing general connectivity
            test_url = f"{base_url}/models"
            resp = requests.get(test_url, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                provider = "DeepSeek" if "deepseek" in base_url.lower() else ("OpenRouter" if "openrouter" in base_url.lower() else "AI")
                return {"success": True, "message": f"Соединение с {provider} успешно установлено!"}
            else:
                try:
                    error_detail = resp.json().get('error', {}).get('message', f"HTTP {resp.status_code}")
                except:
                    error_detail = f"HTTP {resp.status_code}"
                return {"success": False, "message": f"Ошибка {resp.status_code}: {error_detail}"}
                
        except Exception as e:
            return {"success": False, "message": f"Ошибка соединения: {str(e)}"}

    return {"success": False, "message": "Unknown service"}

@router.post("/ai-analyze", response_model=AnalyzeResponse)
def ai_analyze(
    data: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Real AI Analysis using configured provider"""
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == 'openai').first()
    if not setting or not setting.api_key:
        raise HTTPException(status_code=400, detail="AI Integration not configured")

    api_key = setting.api_key
    base_url = (setting.additional_params or {}).get('base_url') or "https://api.openai.com/v1"
    base_url = base_url.rstrip('/')

    prompt = f"""
    Проанализируй кандидата для вакансии.
    Кандидат: {data.candidate_data}
    
    Требования: {data.job_description or "Соответствие общим техническим требованиям"}
    
    Дай краткий профессиональный вывод (2-3 предложения) и оценку соответствия от 0 до 100.
    Ответ верни СТРОГО в формате JSON:
    {{"analysis": "текст вывода", "match_score": 85}}
    """

    try:
        payload = {
            "model": "gpt-3.5-turbo" if "openai" in base_url else "deepseek-chat", # Default fallback
            "messages": [
                {"role": "system", "content": "Ты профессиональный HR-ассистент."},
                {"role": "user", "content": prompt}
            ]
        }
        
        # response_format only supported by some
        if "openai" in base_url.lower() or "deepseek" in base_url.lower():
             payload["response_format"] = { "type": "json_object" }

        # Adjust for OpenRouter/DeepSeek default models
        if "openrouter" in base_url.lower():
            payload["model"] = "openai/gpt-3.5-turbo" 
        elif "deepseek" in base_url.lower():
            payload["model"] = "deepseek-chat"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        resp = requests.post(f"{base_url}/chat/completions", json=payload, headers=headers, timeout=30)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"AI API Error: {resp.text}")
            
        result = resp.json()
        content = result['choices'][0]['message']['content']
        
        import json
        try:
            # Clean possible markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            ai_data = json.loads(content)
            return AnalyzeResponse(**ai_data)
        except Exception as e:
            return AnalyzeResponse(analysis=content, match_score=70)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
