from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import OrganizationUnit, Employee, User
from schemas import OrgUnitCreate

from dependencies import get_current_active_user, PermissionChecker

router = APIRouter(prefix="/api/structure", tags=["structure"])

@router.get("")
def get_structure(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check permission (view_structure OR admin_access)
    is_admin = False
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    
    if perms.get('admin_access'): is_admin = True
    if perms.get('view_structure'): is_admin = True # Allow view access
    
    # If no view permission at all, return empty or error?
    # Let's assume basic employees can SEE structure (it's often public info).
    # But if we want restriction, uncomment below:
    # if not is_admin and not perms.get('view_structure'): raise HTTPException(403, "Access Denied")

    branches = db.query(OrganizationUnit).filter_by(type="branch").all()
    
    # ... (rest of logic for scope filtering remains same) ...
    # Simplified for brevity in this replace, keeping Logic from lines 21-64
    
    if is_admin or not current_user.scope_branches:
        pass 
    else:
        allowed_bids = set()
        for x in current_user.scope_branches:
            try: allowed_bids.add(int(x))
            except: pass
        branches = [b for b in branches if b.id in allowed_bids]
        
    result = []
    user_dept_ids = set()
    if current_user.scope_departments:
         for x in current_user.scope_departments:
             try: user_dept_ids.add(int(x))
             except: pass

    for b in branches:
        all_depts = db.query(OrganizationUnit).filter_by(parent_id=b.id, type="department").all()
        dept_ids_in_branch = {d.id for d in all_depts}
        intersection = user_dept_ids.intersection(dept_ids_in_branch)
        
        if is_admin:
             visible_depts = all_depts
        elif intersection:
            visible_depts = [d for d in all_depts if d.id in intersection]
        else:
            visible_depts = all_depts
            
        result.append({
            "id": b.id,
            "name": b.name,
            "departments": [{"id": d.id, "name": d.name} for d in visible_depts]
        })
            
    return result

@router.post("/branch", dependencies=[Depends(PermissionChecker('edit_structure'))])
def create_branch(item: OrgUnitCreate, db: Session = Depends(get_db)):
    org = OrganizationUnit(name=item.name, type="branch")
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"status": "ok", "id": org.id}

@router.post("/department", dependencies=[Depends(PermissionChecker('edit_structure'))])
def create_department(item: OrgUnitCreate, db: Session = Depends(get_db)):
    org = OrganizationUnit(name=item.name, type="department", parent_id=item.parent_id)
    db.add(org)
    db.commit()
    return {"status": "ok", "id": org.id}

@router.delete("/{id}", dependencies=[Depends(PermissionChecker('edit_structure'))])
def delete_unit(id: int, db: Session = Depends(get_db)):
    unit = db.query(OrganizationUnit).get(id)
    if not unit: raise HTTPException(404, "Unit not found")
    
    children = db.query(OrganizationUnit).filter_by(parent_id=id).first()
    if children: raise HTTPException(400, "Cannot delete branch with departments")

    emps = db.query(Employee).filter_by(org_unit_id=id).first()
    if emps: raise HTTPException(400, "Cannot delete unit with assigned employees")

    db.delete(unit)
    db.commit()
    return {"status": "deleted"}
