import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any, cast, Optional
from pydantic import BaseModel
from datetime import datetime

from database.models import IntegrationSettings, Employee, AuditLog
from dependencies import get_db, require_admin
from services.onec_service import OneCService
from utils.secret_store import decrypt_secret

router = APIRouter(tags=["onec"])
logger = logging.getLogger("fot.integrations.onec")

class OneCConnectionSettings(BaseModel):
    base_url: str
    username: Optional[str] = None
    password: Optional[str] = None

@router.get("/employees", response_model=List[str])
def get_onec_employees(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    """
    Fetch employees from 1C using stored settings.
    """
    setting = db.query(IntegrationSettings).filter(IntegrationSettings.service_name == 'onec').first()
    if not setting or not setting.is_active:
        raise HTTPException(status_code=400, detail="1C Integration not configured or inactive")

    settings = cast(Any, setting)
    # Get base_url from additional_params
    base_url = settings.additional_params.get('base_url') if settings.additional_params else None
    if not base_url:
        logger.error("1C base URL is not configured in settings")
        raise HTTPException(status_code=400, detail="1C base URL is not configured")
    
    username = settings.client_id
    password = decrypt_secret(settings.client_secret) if settings.client_secret else None
    
    logger.info(f"Connecting to 1C at: {base_url} (User: {username})")
    
    service = OneCService(base_url, username, password)
    try:
        data = service.get_employees()
        logger.info(f"Successfully fetched {len(data)} employees from 1C")
        return data
    except Exception as e:
        logger.error(f"1C Connection Error for {base_url}: {e}")
        raise HTTPException(status_code=502, detail=f"Ошибка 1С: {str(e)}")

class ImportOneCRequest(BaseModel):
    names: List[str]

@router.post("/import")
def import_onec_employees(
    data: ImportOneCRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """
    Bulk create employees from 1C names.
    Simple version: just sets full_name and default status.
    """
    imported_count = 0
    skipped_count = 0
    
    for name in data.names:
        # Check if already exists
        exists = db.query(Employee).filter(Employee.full_name == name).first()
        if exists:
            skipped_count += 1
            continue
        
        new_emp = Employee(
            full_name=name,
            status="Active",
            created_at=datetime.now().isoformat()
        )
        db.add(new_emp)
        db.flush() # Get ID
        imported_count += 1
        
        # Log audit
        audit = AuditLog(
            user_id=current_user.id,
            target_entity="employee",
            target_entity_id=new_emp.id,
            timestamp=datetime.now().isoformat(),
            new_values={"full_name": name, "source": "1C Import"}
        )
        db.add(audit)

    db.commit()
    return {"imported": imported_count, "skipped": skipped_count}
