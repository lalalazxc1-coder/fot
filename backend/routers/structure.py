from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import OrganizationUnit, Employee, User
from schemas import OrgUnitCreate

from dependencies import require_admin, get_current_active_user

router = APIRouter(prefix="/api/structure", tags=["structure"])

@router.get("")
def get_structure(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    branches = db.query(OrganizationUnit).filter_by(type="branch").all()
    
    # 1. No Restrictions if Admin or no scope
    is_admin = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': is_admin = True
        if current_user.role_rel.permissions.get('admin_access'): is_admin = True
    
    if is_admin or not current_user.scope_branches:
        pass 
    else:
        # Filter Branches (safe cast)
        allowed_bids = set()
        for x in current_user.scope_branches:
            try: allowed_bids.add(int(x))
            except: pass
            
        branches = [b for b in branches if b.id in allowed_bids]
        
    result = []
    
    # Pre-fetch user department scope for faster lookup
    user_dept_ids = set()
    if current_user.scope_departments:
         for x in current_user.scope_departments:
             try: user_dept_ids.add(int(x))
             except: pass

    for b in branches:
        all_depts = db.query(OrganizationUnit).filter_by(parent_id=b.id, type="department").all()
        
        # Determine which departments to show
        # Logic: If user has specific departments for THIS branch in scope, show only them. 
        # If no departments for this branch in scope, show ALL (assuming "Branch Access" implies full access unless refined).
        
        dept_ids_in_branch = {d.id for d in all_depts}
        intersection = user_dept_ids.intersection(dept_ids_in_branch)
        
        if is_admin:
             visible_depts = all_depts
        elif intersection:
            visible_depts = [d for d in all_depts if d.id in intersection]
        else:
            visible_depts = all_depts # Show all if none specifically restricted
            
        result.append({
            "id": b.id,
            "name": b.name,
            "departments": [{"id": d.id, "name": d.name} for d in visible_depts]
        })
            
    return result

@router.post("/branch")
def create_branch(item: OrgUnitCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    org = OrganizationUnit(name=item.name, type="branch")
    db.add(org)
    db.commit()
    return {"status": "ok", "id": org.id}

@router.post("/department")
def create_department(item: OrgUnitCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    org = OrganizationUnit(name=item.name, type="department", parent_id=item.parent_id)
    db.add(org)
    db.commit()
    return {"status": "ok", "id": org.id}

@router.delete("/{id}")
def delete_unit(id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    unit = db.query(OrganizationUnit).get(id)
    if not unit: raise HTTPException(404, "Unit not found")
    
    # Check if has children (for branches)
    children = db.query(OrganizationUnit).filter_by(parent_id=id).first()
    if children: raise HTTPException(400, "Cannot delete branch with departments")

    # Check if employees assigned
    emps = db.query(Employee).filter_by(org_unit_id=id).first()
    if emps: raise HTTPException(400, "Cannot delete unit with assigned employees")

    db.delete(unit)
    db.commit()
    return {"status": "deleted"}
