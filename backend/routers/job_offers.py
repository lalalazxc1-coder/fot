import secrets
import hmac
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database.database import get_db
from database.models import JobOffer, User, WelcomePageConfig
from schemas import JobOfferCreate, JobOfferResponse
from dependencies import get_current_active_user, PermissionChecker

router = APIRouter(prefix="/api/offers", tags=["job-offers"])

@router.post("/", response_model=JobOfferResponse)
def create_offer(data: JobOfferCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Simple permissions check - admin or manager
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")

    token = secrets.token_urlsafe(16)
    # FIX #6: Use cryptographically secure random, 6 digits
    access_code = "".join([str(secrets.choice(range(10))) for _ in range(6)])
    
    # Resolve welcome_content: from explicit field OR from config_id
    welcome_content = None
    if data.welcome_content:
        welcome_content = data.welcome_content.model_dump()
    elif data.welcome_page_config_id:
        cfg = db.query(WelcomePageConfig).filter(WelcomePageConfig.id == data.welcome_page_config_id).first()
        if cfg:
            welcome_content = {
                "video_url": cfg.video_url,
                "office_tour_images": cfg.office_tour_images or [],
                "address": cfg.address,
                "first_day_instructions": cfg.first_day_instructions or [],
                "merch_info": cfg.merch_info,
                "team_members": cfg.team_members or [],
                "company_description": cfg.company_description,
                "mission": cfg.mission,
                "vision": cfg.vision,
            }

    new_offer = JobOffer(
        token=token,
        access_code=access_code,
        candidate_name=data.candidate_name,
        candidate_email=data.candidate_email,
        candidate_phone=data.candidate_phone,
        position_title=data.position_title,
        branch_id=data.branch_id,
        department_id=data.department_id,
        base_net=data.base_net,
        kpi_net=data.kpi_net,
        bonus_net=data.bonus_net,
        valid_until=data.valid_until,
        company_name=data.company_name,
        manager_name=data.manager_name or current_user.full_name,
        benefits=data.benefits,
        welcome_text=data.welcome_text,
        description_text=data.description_text,
        theme_color=data.theme_color,
        custom_sections=[s.model_dump() for s in data.custom_sections],
        probation_period=data.probation_period,
        working_hours=data.working_hours,
        lunch_break=data.lunch_break,
        non_compete_text=data.non_compete_text,
        president_name=data.president_name,
        hr_name=data.hr_name,
        start_date=data.start_date,
        signatories=[s.model_dump() for s in data.signatories],
        welcome_content=welcome_content,
        status="pending"
    )
    db.add(new_offer)
    db.commit()
    db.refresh(new_offer)
    return new_offer

@router.get("/", response_model=List[JobOfferResponse])
def list_offers(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    return db.query(JobOffer).order_by(JobOffer.id.desc()).all()

@router.put("/{offer_id}", response_model=JobOfferResponse)
def update_offer(offer_id: int, data: JobOfferCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning') or perms.get('manage_offers')):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    offer = db.query(JobOffer).filter(JobOffer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    offer.candidate_name = data.candidate_name
    offer.candidate_email = data.candidate_email
    offer.candidate_phone = data.candidate_phone
    offer.position_title = data.position_title
    offer.base_net = data.base_net
    offer.kpi_net = data.kpi_net
    offer.bonus_net = data.bonus_net
    offer.valid_until = data.valid_until
    offer.company_name = data.company_name
    offer.benefits = data.benefits
    offer.welcome_text = data.welcome_text
    offer.description_text = data.description_text
    offer.theme_color = data.theme_color
    offer.custom_sections = [s.model_dump() for s in data.custom_sections]
    offer.probation_period = data.probation_period
    offer.working_hours = data.working_hours
    offer.lunch_break = data.lunch_break
    offer.non_compete_text = data.non_compete_text
    offer.president_name = data.president_name
    offer.hr_name = data.hr_name
    offer.start_date = data.start_date
    offer.signatories = [s.model_dump() for s in data.signatories]
    offer.welcome_content = data.welcome_content.model_dump() if data.welcome_content else None
    
    db.commit()
    db.refresh(offer)
    return offer

# NEW-4 FIX: Redis-based rate limit для PIN (multi-worker safe)
from utils.rate_limiter import check_rate_limit as _check_rl

PIN_RATE_LIMIT_WINDOW = 900  # 15 minutes
PIN_RATE_LIMIT_MAX = 5       # max attempts per token
PIN_ACTION_RATE_LIMIT_WINDOW = 900  # 15 minutes
PIN_ACTION_RATE_LIMIT_MAX = 5       # max action attempts per token

def _check_pin_rate_limit(token: str) -> bool:
    """Returns True if rate limited. Uses Redis (multi-worker safe)."""
    return _check_rl(f"pin:{token}", PIN_RATE_LIMIT_MAX, PIN_RATE_LIMIT_WINDOW)


def _check_pin_action_rate_limit(token: str) -> bool:
    """Returns True if action PIN checks are rate limited."""
    return _check_rl(f"pin_action:{token}", PIN_ACTION_RATE_LIMIT_MAX, PIN_ACTION_RATE_LIMIT_WINDOW)


@router.get("/public/{token}")
def get_public_offer(token: str, db: Session = Depends(get_db)):
    """
    FIX #H2: PIN больше не передаётся в GET-параметре (не попадает в логи и историю браузера).
    GET возвращает только preview (locked view). Для разблокировки — POST /public/{token}/unlock.
    """
    offer = db.query(JobOffer).filter(JobOffer.token == token).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    # Всегда возвращаем locked preview — PIN проверяется отдельным POST-запросом
    return {
        "id": offer.id,
        "token": offer.token,
        "candidate_name": offer.candidate_name,
        "position_title": offer.position_title,
        "company_name": offer.company_name,
        "is_locked": True,
        "status": offer.status
    }


from pydantic import BaseModel as _BaseModel

class PinVerifyRequest(_BaseModel):
    pin: str


@router.post("/public/{token}/unlock")
def unlock_offer_with_pin(token: str, data: PinVerifyRequest, db: Session = Depends(get_db)):
    """
    FIX #H2: PIN принимается только в POST JSON-теле (не в URL).
    Возвращает полные данные оффера при корректном PIN.
    """
    offer = db.query(JobOffer).filter(JobOffer.token == token).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    # Rate limit
    if _check_pin_rate_limit(token):
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже.")

    if not hmac.compare_digest(str(data.pin), str(offer.access_code or "")):
        raise HTTPException(status_code=403, detail="Неверный PIN-код")

    # PIN верный — возвращаем полные данные
    return {
        "candidate_name": offer.candidate_name,
        "position_title": offer.position_title,
        "base_net": offer.base_net,
        "kpi_net": offer.kpi_net,
        "bonus_net": offer.bonus_net,
        "status": offer.status,
        "company_name": offer.company_name,
        "manager_name": offer.manager_name,
        "benefits": offer.benefits,
        "valid_until": offer.valid_until,
        "welcome_text": offer.welcome_text,
        "description_text": offer.description_text,
        "theme_color": offer.theme_color,
        "custom_sections": offer.custom_sections,
        "probation_period": offer.probation_period,
        "working_hours": offer.working_hours,
        "lunch_break": offer.lunch_break,
        "non_compete_text": offer.non_compete_text,
        "president_name": offer.president_name,
        "hr_name": offer.hr_name,
        "start_date": offer.start_date,
        "signatories": offer.signatories,
        "welcome_content": offer.welcome_content,
    }


class JobOfferActionRequest(_BaseModel):
    action: str
    pin: str


@router.post("/public/{token}/action")
def job_offer_action(token: str, data: JobOfferActionRequest, db: Session = Depends(get_db)):
    offer = db.query(JobOffer).filter(JobOffer.token == token).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if _check_pin_action_rate_limit(token):
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже.")
    
    # FIX #7: Require PIN verification before action
    if not hmac.compare_digest(str(data.pin), str(offer.access_code or "")):
        raise HTTPException(status_code=403, detail="Неверный PIN-код")
    
    if offer.status != "pending":
        raise HTTPException(status_code=400, detail="Offer is already closed")
    
    if data.action == "accept":
        offer.status = "accepted"
    elif data.action == "reject":
        offer.status = "rejected"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    db.commit()
    return {"status": offer.status, "welcome_content": offer.welcome_content if offer.status == "accepted" else None}
