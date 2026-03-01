from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database.database import get_db
from database import models
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from dependencies import get_current_active_user
from database.models import User

router = APIRouter(prefix="/api/welcome-pages", tags=["Welcome Pages"])


# --- Schemas ---
class TeamMember(BaseModel):
    name: str = ""
    role: str = ""
    description: str = ""


class WelcomePageConfigCreate(BaseModel):
    name: str
    branch_id: Optional[int] = None
    video_url: Optional[str] = None
    office_tour_images: Optional[List[str]] = []
    address: Optional[str] = None
    first_day_instructions: Optional[List[str]] = []
    merch_info: Optional[str] = None
    team_members: Optional[List[TeamMember]] = []
    company_description: Optional[str] = None
    mission: Optional[str] = None
    vision: Optional[str] = None


class WelcomePageConfigResponse(BaseModel):
    id: int
    name: str
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    video_url: Optional[str] = None
    office_tour_images: Optional[List[str]] = []
    address: Optional[str] = None
    first_day_instructions: Optional[List[str]] = []
    merch_info: Optional[str] = None
    team_members: Optional[List[dict]] = []
    company_description: Optional[str] = None
    mission: Optional[str] = None
    vision: Optional[str] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


def _serialize(cfg: models.WelcomePageConfig) -> dict:
    return {
        "id": cfg.id,
        "name": cfg.name,
        "branch_id": cfg.branch_id,
        "branch_name": cfg.branch.name if cfg.branch else None,
        "video_url": cfg.video_url,
        "office_tour_images": cfg.office_tour_images or [],
        "address": cfg.address,
        "first_day_instructions": cfg.first_day_instructions or [],
        "merch_info": cfg.merch_info,
        "team_members": cfg.team_members or [],
        "company_description": cfg.company_description,
        "mission": cfg.mission,
        "vision": cfg.vision,
        "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
    }


@router.get("/", response_model=List[WelcomePageConfigResponse])
def list_welcome_pages(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")
    configs = db.query(models.WelcomePageConfig).order_by(models.WelcomePageConfig.id.desc()).all()
    return [_serialize(c) for c in configs]


@router.post("/", response_model=WelcomePageConfigResponse)
def create_welcome_page(data: WelcomePageConfigCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")
    cfg = models.WelcomePageConfig(
        name=data.name,
        branch_id=data.branch_id,
        video_url=data.video_url,
        office_tour_images=data.office_tour_images or [],
        address=data.address,
        first_day_instructions=data.first_day_instructions or [],
        merch_info=data.merch_info,
        team_members=[m.model_dump() for m in (data.team_members or [])],
        company_description=data.company_description,
        mission=data.mission,
        vision=data.vision,
        created_at=datetime.utcnow(),
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _serialize(cfg)


@router.put("/{config_id}", response_model=WelcomePageConfigResponse)
def update_welcome_page(config_id: int, data: WelcomePageConfigCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")
    cfg = db.query(models.WelcomePageConfig).filter(models.WelcomePageConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Not found")
    cfg.name = data.name
    cfg.branch_id = data.branch_id
    cfg.video_url = data.video_url
    cfg.office_tour_images = data.office_tour_images or []
    cfg.address = data.address
    cfg.first_day_instructions = data.first_day_instructions or []
    cfg.merch_info = data.merch_info
    cfg.team_members = [m.model_dump() for m in (data.team_members or [])]
    cfg.company_description = data.company_description
    cfg.mission = data.mission
    cfg.vision = data.vision
    db.commit()
    db.refresh(cfg)
    return _serialize(cfg)


@router.delete("/{config_id}")
def delete_welcome_page(config_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")
    cfg = db.query(models.WelcomePageConfig).filter(models.WelcomePageConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(cfg)
    db.commit()
    return {"status": "ok"}
