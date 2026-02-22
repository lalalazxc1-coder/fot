from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database.database import get_db
from database import models
import schemas
from datetime import datetime

router = APIRouter(prefix="/api/offer-templates", tags=["Job Offer Templates"])

@router.post("/", response_model=schemas.JobOfferTemplateResponse)
def create_template(data: schemas.JobOfferTemplateCreate, db: Session = Depends(get_db)):
    db_template = models.JobOfferTemplate(
        name=data.name,
        company_name=data.company_name,
        benefits=data.benefits,
        welcome_text=data.welcome_text,
        description_text=data.description_text,
        theme_color=data.theme_color,
        custom_sections=[s.dict() for s in data.custom_sections] if data.custom_sections else [],
        probation_period=data.probation_period,
        working_hours=data.working_hours,
        lunch_break=data.lunch_break,
        non_compete_text=data.non_compete_text,
        signatories=[s.dict() for s in data.signatories] if data.signatories else []
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    
    # Format created_at to string for response model
    db_template.created_at = db_template.created_at.isoformat()
    return db_template

@router.get("/", response_model=List[schemas.JobOfferTemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(models.JobOfferTemplate).all()
    for t in templates:
        t.created_at = t.created_at.isoformat()
    return templates

@router.get("/{template_id}", response_model=schemas.JobOfferTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.JobOfferTemplate).filter(models.JobOfferTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.created_at = template.created_at.isoformat()
    return template

@router.put("/{template_id}", response_model=schemas.JobOfferTemplateResponse)
def update_template(template_id: int, data: schemas.JobOfferTemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(models.JobOfferTemplate).filter(models.JobOfferTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template.name = data.name
    template.company_name = data.company_name
    template.benefits = data.benefits
    template.welcome_text = data.welcome_text
    template.description_text = data.description_text
    template.theme_color = data.theme_color
    template.custom_sections = [s.dict() for s in data.custom_sections] if data.custom_sections else []
    template.probation_period = data.probation_period
    template.working_hours = data.working_hours
    template.lunch_break = data.lunch_break
    template.non_compete_text = data.non_compete_text
    template.signatories = [s.dict() for s in data.signatories] if data.signatories else []
    
    db.commit()
    db.refresh(template)
    template.created_at = template.created_at.isoformat()
    return template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.JobOfferTemplate).filter(models.JobOfferTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return {"status": "success"}
