from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from database.database import get_db
from database.models import User, AuditLog
from schemas import EmployeeCreate, FinancialUpdate, EmployeeUpdate, EmpDetailsUpdate
from dependencies import get_current_active_user, get_user_scope, PermissionChecker
from services.employee_service import EmployeeService

router = APIRouter(prefix="/api", tags=["employees"])

@router.get("/employees")
def get_employees(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    return EmployeeService.get_employees(db, current_user, scope)

@router.post("/employees", dependencies=[Depends(PermissionChecker('add_employees'))])
def create_employee(
    data: EmployeeCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    return EmployeeService.create_employee(db, current_user, data, scope)

@router.patch("/employees/{emp_id}/financials", dependencies=[Depends(PermissionChecker('edit_financials'))])
def update_financials(
    emp_id: int, 
    update: FinancialUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    return EmployeeService.update_financials(db, current_user, emp_id, update, scope)

@router.put("/employees/{emp_id}")
def update_employee(
    emp_id: int, 
    data: EmployeeUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    # This endpoint combines details + financials, so we need both perms?
    # Or just 'edit_financials' is enough?
    # Original code checked: admin_access OR add_employees OR edit_financials.
    # We should probably require at least one.
    # Let's do manual check here or assume if they have access to the UI they have one of these.
    # Ideally we should split this, but for backward compatibility:
    
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    has_perm = (
        current_user.role_rel.name == 'Administrator' or 
        perms.get('admin_access') or 
        perms.get('add_employees') or 
        perms.get('edit_financials')
    )
    if not has_perm:
        raise HTTPException(403, "Permission required (add_employees or edit_financials)")

    return EmployeeService.update_employee(db, current_user, emp_id, data, scope)

@router.patch("/employees/{emp_id}/details", dependencies=[Depends(PermissionChecker('add_employees'))])
def update_employee_details(
    emp_id: int, 
    data: EmpDetailsUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    return EmployeeService.update_details(db, current_user, emp_id, data, scope)

@router.post("/employees/{emp_id}/dismiss", dependencies=[Depends(PermissionChecker('add_employees'))])
def dismiss_employee(
    emp_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    return EmployeeService.dismiss_employee(db, current_user, emp_id, scope)

@router.get("/audit-logs/{emp_id}")
def get_audit_logs(emp_id: int, db: Session = Depends(get_db)):
    # Legacy logic, moving here or to service? 
    # It's unique formatting, let's keep it here or move to service if we want total purity.
    # Moving logic to here for now to keep service clean of View-Models if possible, 
    # but service is better.
    
    # Actually, let's just implement the query here for now as it doesn't involve much business logic, just formatting.
    logs = db.query(AuditLog).filter_by(target_entity_id=emp_id, target_entity="employee").all() 
    logs.reverse()
    formatted_logs = []
    
    user_ids = set(l.user_id for l in logs)
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u.full_name for u in users}

    for log in logs:
        if not log.new_values and not log.old_values: continue
        
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
