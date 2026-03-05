import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any, cast, Optional
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

from database.models import IntegrationSettings, Employee, AuditLog
from dependencies import get_db, require_admin
from services.onec_service import OneCService
from utils.secret_store import decrypt_secret
from utils.security.url_guard import UnsafeOutboundUrlError, validate_outbound_base_url

router = APIRouter(tags=["onec"])
logger = logging.getLogger("fot.integrations.onec")


class ImportOneCResponse(BaseModel):
    imported: int
    skipped: int

    model_config = ConfigDict(extra="forbid")


class OneCConnectionSettings(BaseModel):
    base_url: str = Field(..., max_length=512)
    username: Optional[str] = None
    password: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

@router.get("/employees", response_model=List[str])
def get_onec_employees(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    """
    Fetch employees from 1C using stored settings.
    """
    setting = db.query(IntegrationSettings).filter(
        IntegrationSettings.service_name == 'onec',
        IntegrationSettings.is_active.is_(True),
    ).first()
    if setting is None:
        raise HTTPException(status_code=400, detail="1C Integration not configured or inactive")

    settings = cast(Any, setting)
    # Get base_url from additional_params
    base_url = settings.additional_params.get('base_url') if settings.additional_params else None
    if not base_url:
        logger.error("1C base URL is not configured in settings")
        raise HTTPException(status_code=400, detail="1C base URL is not configured")

    try:
        base_url = validate_outbound_base_url(str(base_url), "onec")
    except UnsafeOutboundUrlError:
        raise HTTPException(status_code=400, detail="Некорректный Base URL 1С-интеграции.")
    
    username = settings.client_id
    password = decrypt_secret(settings.client_secret) if settings.client_secret else None
    
    logger.info("Connecting to 1C integration", extra={"base_url": base_url, "user": username})
    
    service = OneCService(base_url, username, password)
    try:
        data = service.get_employees()
        logger.info(f"Successfully fetched {len(data)} employees from 1C")
        return data
    except Exception:
        logger.exception("1C connection error", extra={"base_url": base_url})
        raise HTTPException(status_code=502, detail="Не удалось получить данные из 1С. Попробуйте позже.")

class ImportOneCRequest(BaseModel):
    names: List[str]

    model_config = ConfigDict(extra="forbid")

@router.post("/import", response_model=ImportOneCResponse)
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
            status="Active"
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
