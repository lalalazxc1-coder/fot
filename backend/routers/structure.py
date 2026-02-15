from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import func
from sqlalchemy.sql import func as sql_func
from typing import List, Optional, Set, Dict

from database.database import get_db
from database.models import OrganizationUnit, Employee, User, FinancialRecord
from schemas import OrgUnitCreate, OrgUnitUpdate

from dependencies import get_current_active_user, PermissionChecker

router = APIRouter(prefix="/api/structure", tags=["structure"])

@router.get("")
def get_structure(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check permission (view_structure OR admin_access)
    is_admin = False
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    
    if perms.get('admin_access'): is_admin = True
    if perms.get('view_structure'): is_admin = True # Allow view access
    
    branches = db.query(OrganizationUnit).filter(OrganizationUnit.type.in_(['branch', 'head_office'])).all()
    
    if is_admin or not current_user.scope_branches:
        pass 
    else:
        allowed_bids = set()
        for x in current_user.scope_branches:
            try: allowed_bids.add(int(x))
            except (ValueError, TypeError): pass
        branches = [b for b in branches if b.id in allowed_bids]
        
    # Pre-fetch ALL units to build hierarchy in memory (avoid N+1)
    all_units = db.query(OrganizationUnit).all()
    children_map = {}
    for u in all_units:
        if u.parent_id:
            if u.parent_id not in children_map: children_map[u.parent_id] = []
            children_map[u.parent_id].append(u)

    def get_all_descendants(unit_id):
        descendants = []
        if unit_id in children_map:
            for child in children_map[unit_id]:
                descendants.append(child)
                descendants.extend(get_all_descendants(child.id))
        return descendants

    result = []
    user_dept_ids = set()
    if current_user.scope_departments:
         for x in current_user.scope_departments:
             try: user_dept_ids.add(int(x))
             except (ValueError, TypeError): pass

    for b in branches:
        # Get ALL descendants (recursive)
        all_descendants = get_all_descendants(b.id)
        
        # Filter visibility
        if is_admin:
             visible_depts = all_descendants
        elif user_dept_ids:
            # If user has specific department scope, only show those interacting with this branch's descendants
            visible_depts = [d for d in all_descendants if d.id in user_dept_ids]
        else:
            visible_depts = all_descendants
            
        result.append({
            "id": b.id,
            "name": b.name,
            # Include parent_id for hierarchy reconstruction on frontend
            "departments": [{"id": d.id, "name": d.name, "parent_id": d.parent_id, "type": d.type} for d in visible_depts]
        })
            
    return result

@router.get("/flat", dependencies=[Depends(PermissionChecker('view_financial_reports'))])
def get_structure_flat(
    date: Optional[str] = Query(None, description="ISO Date for historical reconstruction"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns a flat list of all organization units for visual structure building.
    Includes head of unit info and employee counts.
    Protected by 'view_financial_reports' as it exposes salary data.
    If 'date' is provided, reconstructs financial state at that date.
    """
    # 1. Fetch all units with head loaded
    units = db.query(OrganizationUnit).options(joinedload(OrganizationUnit.head).joinedload(Employee.position)).all()
    
    # 2. Get direct employee counts for all units
    direct_counts_query = db.query(Employee.org_unit_id, func.count(Employee.id)).filter(Employee.status != 'Dismissed').group_by(Employee.org_unit_id).all()
    direct_counts = {r[0]: r[1] for r in direct_counts_query}

    # 3. Pre-fetch Heads' salaries (Batch Query) to avoid N+1
    head_ids = [u.head_id for u in units if u.head_id]
    head_salaries = {}
    
    if head_ids:
        # Subquery to identify the latest financial record ID for each head
        base_sub = db.query(
            FinancialRecord.employee_id,
            sql_func.max(FinancialRecord.id).label('max_id')
        ).filter(FinancialRecord.employee_id.in_(head_ids))
        
        if date:
             base_sub = base_sub.filter(FinancialRecord.created_at <= date)

        head_latest_sub = base_sub.group_by(FinancialRecord.employee_id).subquery()

        # Fetch the actual total_net from those records
        head_salary_query = db.query(
            FinancialRecord.employee_id,
            FinancialRecord.total_net
        ).join(
            head_latest_sub,
            (FinancialRecord.employee_id == head_latest_sub.c.employee_id) &
            (FinancialRecord.id == head_latest_sub.c.max_id)
        ).all()
        
        head_salaries = {r[0]: r[1] for r in head_salary_query}

    # 4. Get total salaries per unit (sum of total_net from latest financial records for ALL employees)
    base_sub_all = db.query(
        FinancialRecord.employee_id,
        sql_func.max(FinancialRecord.id).label('max_id')
    )
    if date:
        base_sub_all = base_sub_all.filter(FinancialRecord.created_at <= date)
        
    latest_finance = base_sub_all.group_by(FinancialRecord.employee_id).subquery()
    
    salary_query = db.query(
        Employee.org_unit_id,
        sql_func.sum(FinancialRecord.total_net).label('total_salary')
    ).join(
        FinancialRecord, Employee.id == FinancialRecord.employee_id
    ).join(
        latest_finance, 
        (FinancialRecord.employee_id == latest_finance.c.employee_id) & 
        (FinancialRecord.id == latest_finance.c.max_id)
    ).filter(
        Employee.status != 'Dismissed'
    ).group_by(Employee.org_unit_id).all()
    
    direct_salaries = {r[0]: int(r[1]) if r[1] else 0 for r in salary_query}

    # 5. Build hierarchy map
    children_map = {}
    for u in units:
        if u.parent_id:
            if u.parent_id not in children_map: children_map[u.parent_id] = []
            children_map[u.parent_id].append(u.id)
            
    # 6. Recursive count and salary functions with Memoization
    memo_counts = {}
    memo_salaries = {}

    def get_total_count(uid):
        if uid in memo_counts: return memo_counts[uid]
        count = direct_counts.get(uid, 0)
        children = children_map.get(uid, [])
        for child_id in children:
            count += get_total_count(child_id)
        memo_counts[uid] = count
        return count
    
    def get_total_salary(uid):
        if uid in memo_salaries: return memo_salaries[uid]
        salary = direct_salaries.get(uid, 0)
        children = children_map.get(uid, [])
        for child_id in children:
            salary += get_total_salary(child_id)
        memo_salaries[uid] = salary
        return salary

    # 7. Build Result
    result = []
    for u in units:
        head_info = None
        if u.head:
            pos_title = u.head.position.title if u.head.position else "Руководитель"
            salary = head_salaries.get(u.head.id, 0) # Fetched from batch map
            
            head_info = {
                "id": u.head.id,
                "full_name": u.head.full_name,
                "position": pos_title,
                "salary": salary
            }

        result.append({
            "id": u.id,
            "name": u.name,
            "type": u.type,
            "parent_id": u.parent_id,
            "head_id": u.head_id,
            "head": head_info,
            "employee_count": get_total_count(u.id),
            "direct_count": direct_counts.get(u.id, 0),
            "total_salary": get_total_salary(u.id)
        })
    return result

@router.post("/head_office", dependencies=[Depends(PermissionChecker('edit_structure'))])
def create_head_office(item: OrgUnitCreate, db: Session = Depends(get_db)):
    """Create a Head Office (top-level organizational unit)"""
    org = OrganizationUnit(name=item.name, type="head_office", parent_id=None, head_id=item.head_id)
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"status": "ok", "id": org.id}

@router.post("/branch", dependencies=[Depends(PermissionChecker('edit_structure'))])
def create_branch(item: OrgUnitCreate, db: Session = Depends(get_db)):
    """Create a Branch (can be under head_office or standalone)"""
    org = OrganizationUnit(name=item.name, type="branch", parent_id=item.parent_id, head_id=item.head_id)
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"status": "ok", "id": org.id}

@router.post("/department", dependencies=[Depends(PermissionChecker('edit_structure'))])
def create_department(item: OrgUnitCreate, db: Session = Depends(get_db)):
    org = OrganizationUnit(name=item.name, type="department", parent_id=item.parent_id, head_id=item.head_id)
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"status": "ok", "id": org.id}

@router.patch("/{id}", dependencies=[Depends(PermissionChecker('edit_structure'))])
def update_unit(id: int, item: OrgUnitUpdate, db: Session = Depends(get_db)):
    unit = db.get(OrganizationUnit, id) # SQLAlchemy 2.0 style
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    if item.name is not None:
        unit.name = item.name
    
    if item.parent_id is not None:
        # Check 1: Cannot be parent to itself
        if item.parent_id == id:
             raise HTTPException(status_code=400, detail="Cannot be parent to itself")
             
        # Check 2: Advanced Circular Dependency (Cannot move under its own descendant)
        # Build hierarchy map to check descendants
        all_units = db.query(OrganizationUnit.id, OrganizationUnit.parent_id).all()
        children_map = {}
        for uid, pid in all_units:
            if pid:
                if pid not in children_map: children_map[pid] = []
                children_map[pid].append(uid)
        
        def is_descendant(target_id, current_root):
            if current_root == target_id: return True
            children = children_map.get(current_root, [])
            for child in children:
                if is_descendant(target_id, child):
                   return True
            return False

        # If we are moving 'unit' (id) to 'item.parent_id', 
        # check if 'item.parent_id' is one of the descendants of 'id'
        if is_descendant(item.parent_id, id):
             raise HTTPException(status_code=400, detail="Circular dependency detected: Cannot move unit under its own descendant")

        unit.parent_id = item.parent_id

    if item.head_id is not None:
        unit.head_id = item.head_id if item.head_id > 0 else None

    db.commit()
    db.refresh(unit)
    return {"status": "updated", "id": unit.id}

@router.delete("/{id}", dependencies=[Depends(PermissionChecker('edit_structure'))])
def delete_unit(id: int, db: Session = Depends(get_db)):
    unit = db.get(OrganizationUnit, id) # SQLAlchemy 2.0 style
    if not unit: raise HTTPException(404, "Unit not found")
    
    # Check for children
    children = db.query(OrganizationUnit).filter_by(parent_id=id).first()
    if children: raise HTTPException(400, "Cannot delete unit with sub-units")

    emps = db.query(Employee).filter_by(org_unit_id=id).first()
    if emps: raise HTTPException(400, "Cannot delete unit with assigned employees")

    db.delete(unit)
    db.commit()
    return {"status": "deleted"}
