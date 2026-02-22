import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database.database import get_db
from database.models import JobOffer, User
from schemas import JobOfferCreate, JobOfferResponse
from dependencies import get_current_active_user, PermissionChecker

router = APIRouter(prefix="/api/offers", tags=["job-offers"])

@router.post("/", response_model=JobOfferResponse)
def create_offer(data: JobOfferCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Simple permissions check - admin or manager
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning')):
        raise HTTPException(status_code=403, detail="Forbidden")

    token = secrets.token_urlsafe(16)
    # Generate a 4-digit access code (PIN)
    import random
    access_code = "".join([str(random.randint(0, 9)) for _ in range(4)])
    
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
        custom_sections=[s.dict() for s in data.custom_sections],
        probation_period=data.probation_period,
        working_hours=data.working_hours,
        lunch_break=data.lunch_break,
        non_compete_text=data.non_compete_text,
        president_name=data.president_name,
        hr_name=data.hr_name,
        start_date=data.start_date,
        signatories=[s.dict() for s in data.signatories],
        status="pending"
    )
    db.add(new_offer)
    db.commit()
    db.refresh(new_offer)
    return new_offer

@router.get("/", response_model=List[JobOfferResponse])
def list_offers(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning')):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    return db.query(JobOffer).order_by(JobOffer.id.desc()).all()

@router.put("/{offer_id}", response_model=JobOfferResponse)
def update_offer(offer_id: int, data: JobOfferCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get('admin_access') or perms.get('manage_planning')):
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
    offer.custom_sections = [s.dict() for s in data.custom_sections]
    offer.probation_period = data.probation_period
    offer.working_hours = data.working_hours
    offer.lunch_break = data.lunch_break
    offer.non_compete_text = data.non_compete_text
    offer.president_name = data.president_name
    offer.hr_name = data.hr_name
    offer.start_date = data.start_date
    offer.signatories = [s.dict() for s in data.signatories]
    
    db.commit()
    db.refresh(offer)
    return offer

@router.get("/public/{token}")
def get_public_offer(token: str, pin: str = None, db: Session = Depends(get_db)):
    offer = db.query(JobOffer).filter(JobOffer.token == token).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # If PIN is not provided or incorrect, return partial "locked" response
    if pin != offer.access_code:
        return {
            "id": offer.id,
            "token": offer.token,
            "candidate_name": offer.candidate_name,
            "position_title": offer.position_title,
            "is_locked": True,
            "status": offer.status
        }
    
    # If PIN matches, return full object
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
        "signatories": offer.signatories
    }

@router.post("/public/{token}/action")
def job_offer_action(token: str, action: str, db: Session = Depends(get_db)):
    offer = db.query(JobOffer).filter(JobOffer.token == token).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer.status != "pending":
        raise HTTPException(status_code=400, detail="Offer is already closed")
    
    if action == "accept":
        offer.status = "accepted"
    elif action == "reject":
        offer.status = "rejected"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    db.commit()
    return {"status": offer.status}
