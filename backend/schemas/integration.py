from pydantic import BaseModel
from typing import Optional, Dict, Any

class IntegrationSettingBase(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    is_active: bool = False
    additional_params: Optional[Dict[str, Any]] = {}

class IntegrationSettingUpdate(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    is_active: Optional[bool] = None
    additional_params: Optional[Dict[str, Any]] = None

class IntegrationSettingOut(IntegrationSettingBase):
    id: int
    updated_at: str
    
    # Mask secrets in output
    has_api_key: bool
    has_client_secret: bool

    class Config:
        from_attributes = True
