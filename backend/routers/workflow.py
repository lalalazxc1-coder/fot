from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import ApprovalStep, Role, User
from schemas import ApprovalStepCreate, ApprovalStepResponse
from dependencies import get_current_active_user

router = APIRouter(prefix="/api/workflow", tags=["workflow"])

@router.get("/steps", response_model=list[ApprovalStepResponse])
def get_approval_steps(db: Session = Depends(get_db)):
    steps = db.query(ApprovalStep).order_by(ApprovalStep.step_order).all()
    # Populate role_name
    for s in steps:
        s.role_name = s.role.name if s.role else None
        s.user_name = s.user.full_name if s.user else None
    return steps

@router.post("/steps")
def create_approval_step(step: ApprovalStepCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check admin
    if current_user.role_rel.name != "Administrator":
        raise HTTPException(403, "Only Admin")
    
    # Validate either role or user
    if not step.role_id and not step.user_id:
        raise HTTPException(400, "Must provide either role_id or user_id")
        
    new_step = ApprovalStep(
        step_order=step.step_order,
        role_id=step.role_id,
        user_id=step.user_id,
        label=step.label,
        is_final=step.is_final,
        step_type=step.step_type,
        notify_on_completion=step.notify_on_completion
    )
    db.add(new_step)
    db.commit()
    db.refresh(new_step)
    return new_step

@router.put("/steps/{id}")
def update_approval_step(id: int, step: ApprovalStepCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role_rel.name != "Administrator": raise HTTPException(403, "Only Admin")
    
    existing = db.query(ApprovalStep).get(id)
    if not existing: raise HTTPException(404, "Step not found")
    
    existing.step_order = step.step_order
    existing.role_id = step.role_id
    existing.user_id = step.user_id
    existing.label = step.label
    existing.is_final = step.is_final
    existing.step_type = step.step_type
    existing.notify_on_completion = step.notify_on_completion
    
    db.commit()
    return existing

@router.delete("/steps/{id}")
def delete_approval_step(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role_rel.name != "Administrator": raise HTTPException(403, "Only Admin")
    
    existing = db.query(ApprovalStep).get(id)
    if not existing: raise HTTPException(404, "Step not found")
    
    db.delete(existing)
    db.commit()
    return {"status": "deleted"}
