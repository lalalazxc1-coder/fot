from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from database.database import get_db
from database.models import PlanningPosition, User, OrganizationUnit, AuditLog
from routers.auth import get_current_active_user
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["planning"])

# --- Schemas ---
class PlanCreate(BaseModel):
    position: str
    branch_id: int
    department_id: int | None = None
    schedule: str | None = None
    count: int = 1
    
    base_net: int = 0
    base_gross: int = 0
    kpi_net: int = 0
    kpi_gross: int = 0
    bonus_net: int = 0
    bonus_gross: int = 0

class PlanUpdate(BaseModel):
    position: str | None = None
    branch_id: int | None = None
    department_id: int | None = None
    schedule: str | None = None
    count: int | None = None
    
    base_net: int | None = None
    base_gross: int | None = None
    kpi_net: int | None = None
    kpi_gross: int | None = None
    bonus_net: int | None = None
    bonus_gross: int | None = None

# --- Helpers ---
def check_manage_permission(user: User):
    if user.role_rel.name == 'Administrator': return True
    return user.role_rel.permissions.get('manage_planning', False)

def filter_by_scope(query, user: User, db: Session):
    if user.role_rel.name == 'Administrator': return query
    
    allowed_branch_ids = []
    
    if user.scope_branches:
        for bid_raw in user.scope_branches:
            bid = int(bid_raw)
            allowed_branch_ids.append(bid)
            
    # Simple branch filtering for now. Department level filtering could be added if needed.
    if allowed_branch_ids:
        return query.filter(PlanningPosition.branch_id.in_(allowed_branch_ids))
    
    # If no scope defined but not admin? allow nothing or everything? 
    # Usually empty scope = nothing.
    return query.filter(PlanningPosition.id == -1) 


# --- Endpoints ---

@router.get("/planning")
def get_planning(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Everyone with access to system can view? Or restricted?
    # Let's apply scope filtering.
    q = db.query(PlanningPosition)
    q = filter_by_scope(q, current_user, db)
    plans = q.all()
    
    # Format for frontend
    res = []
    for p in plans:
        res.append({
            "id": p.id,
            "position": p.position_title,
            "branch_id": p.branch_id,
            "department_id": p.department_id,
            "schedule": p.schedule,
            "count": p.count,
            "base_net": p.base_net,
            "base_gross": p.base_gross,
            "kpi_net": p.kpi_net,
            "kpi_gross": p.kpi_gross,
            "bonus_net": p.bonus_net,
            "bonus_gross": p.bonus_gross
        })
    return res

@router.post("/planning")
def create_plan(plan: PlanCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not check_manage_permission(current_user):
        raise HTTPException(403, "Permission 'manage_planning' required")
        
    # Scope Check for Creation: Can user add to this branch?
    if current_user.scope_branches:
        if str(plan.branch_id) not in [str(b) for b in current_user.scope_branches]:
             raise HTTPException(403, "Cannot create plan for this branch (Out of scope)")

    new_plan = PlanningPosition(
        position_title=plan.position,
        branch_id=plan.branch_id,
        department_id=plan.department_id,
        schedule=plan.schedule,
        count=plan.count,
        base_net=plan.base_net,
        base_gross=plan.base_gross,
        kpi_net=plan.kpi_net,
        kpi_gross=plan.kpi_gross,
        bonus_net=plan.bonus_net,
        bonus_gross=plan.bonus_gross
    )
    db.add(new_plan)
    db.commit()
    
    # Audit
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    audit = AuditLog(
        user_id=current_user.id,
        target_entity="planning",
        target_entity_id=new_plan.id,
        timestamp=ts,
        old_values=None,
        new_values=plan.dict()
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "id": new_plan.id}

@router.patch("/planning/{plan_id}")
def update_plan(plan_id: int, plan: PlanUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not check_manage_permission(current_user):
        raise HTTPException(403, "Permission 'manage_planning' required")
        
    db_plan = db.query(PlanningPosition).get(plan_id)
    if not db_plan: raise HTTPException(404, "Plan not found")
    
    # Scope Check
    if current_user.scope_branches:
        if str(db_plan.branch_id) not in [str(b) for b in current_user.scope_branches]:
             raise HTTPException(403, "Out of scope")

    changes = {}
    
    update_data = plan.dict(exclude_unset=True)
    
    # Map pydantic fields to DB fields if names differ
    # Here names are mostly same, except 'position' -> 'position_title'
    
    for key, val in update_data.items():
        db_key = key
        if key == 'position': db_key = 'position_title'
        
        old_val = getattr(db_plan, db_key)
        if old_val != val:
            changes[key] = {'old': old_val, 'new': val}
            setattr(db_plan, db_key, val)
            
    if changes:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        audit = AuditLog(
            user_id=current_user.id,
            target_entity="planning",
            target_entity_id=plan_id,
            timestamp=ts,
            old_values={k: v['old'] for k,v in changes.items()},
            new_values={k: v['new'] for k,v in changes.items()}
        )
        db.add(audit)
        db.commit()
        
    return {"status": "updated"}

@router.delete("/planning/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if not check_manage_permission(current_user):
        raise HTTPException(403, "Permission 'manage_planning' required")

    db_plan = db.query(PlanningPosition).get(plan_id)
    if not db_plan: raise HTTPException(404, "Plan not found")
    
    # Scope Check
    if current_user.scope_branches:
        if str(db_plan.branch_id) not in [str(b) for b in current_user.scope_branches]:
             raise HTTPException(403, "Out of scope")
             
    # Audit Deletion
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    audit = AuditLog(
        user_id=current_user.id,
        target_entity="planning",
        target_entity_id=plan_id,
        timestamp=ts,
        old_values={"deleted": True, "position": db_plan.position_title},
        new_values=None
    )
    db.add(audit)
    
    db.delete(db_plan)
    db.commit()
    
    return {"status": "deleted"}

@router.get("/planning/{plan_id}/history")
def get_plan_history(plan_id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter_by(target_entity_id=plan_id, target_entity="planning").all()
    logs.reverse()
    formatted_logs = []
    
    user_ids = set(l.user_id for l in logs)
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u.full_name for u in users}

    for log in logs:
        # Determine fields. For creation new_values has all. For update only changes.
        keys = set()
        if log.new_values: keys.update(log.new_values.keys())
        if log.old_values: keys.update(log.old_values.keys())
        
        for k in keys:
             formatted_logs.append({
                "date": log.timestamp,
                "user": user_map.get(log.user_id, "Unknown"),
                "field": k,
                "oldVal": str(log.old_values.get(k, '') if log.old_values else ''),
                "newVal": str(log.new_values.get(k, '') if log.new_values else '')
            })
            
    return formatted_logs
