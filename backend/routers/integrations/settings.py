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
class TestConnectionRequest(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str

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
        
        try:
            # Simple models list call
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            resp = requests.get("https://api.openai.com/v1/models", headers=headers, timeout=5)
            
            if resp.status_code == 200:
                return {"success": True, "message": "OpenAI connection successful!"}
            else:
                return {"success": False, "message": f"OpenAI Error: {resp.status_code}"}
                
        except Exception as e:
            return {"success": False, "message": f"Connection error: {str(e)}"}

    return {"success": False, "message": "Unknown service"}
