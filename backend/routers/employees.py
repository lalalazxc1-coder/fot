from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from datetime import datetime
from database.database import get_db
from database.models import Employee, FinancialRecord, Position, OrganizationUnit, AuditLog, User
from schemas import EmployeeCreate, FinancialUpdate
from dependencies import get_current_active_user

router = APIRouter(prefix="/api", tags=["employees"])

# Helper to get all child unit IDs (recursive)
def get_subtree_ids(db: Session, root_id: int):
    ids = [root_id]
    children = db.query(OrganizationUnit).filter(OrganizationUnit.parent_id == root_id).all()
    for child in children:
        ids.extend(get_subtree_ids(db, child.id))
    return ids

@router.get("/employees")
def get_employees(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    
    query = db.query(Employee).options(joinedload(Employee.financial_records), joinedload(Employee.org_unit))

    # Apply Scope Filter
    if current_user.scope_branches:
        allowed_ids = []
        # Ensure we have a set of ints for departments
        user_dept_ids = set()
        if current_user.scope_departments:
             user_dept_ids = {int(x) for x in current_user.scope_departments}
        
        for bid_raw in current_user.scope_branches:
            bid = int(bid_raw)
            
            # Get Depts
            depts = db.query(OrganizationUnit).filter_by(parent_id=bid, type="department").all()
            dept_ids = {d.id for d in depts}
            
            intersection = user_dept_ids.intersection(dept_ids)
            if intersection:
                # User has specific departments in this branch -> Limit to ONLY those departments
                allowed_ids.extend(list(intersection))
            else:
                # User has NO specific departments -> Full Access to Branch
                allowed_ids.append(bid) # Branch Itself
                allowed_ids.extend(list(dept_ids)) # All Departments
                
        query = query.filter(Employee.org_unit_id.in_(allowed_ids))

    employees = query.all()
    results = []
    
    for emp in employees:
        fin = db.query(FinancialRecord).filter_by(employee_id=emp.id).order_by(desc(FinancialRecord.id)).first()
        pos_name = db.query(Position).get(emp.position_id).title if emp.position_id else "Не указано"
        
        org = emp.org_unit
        branch_name = "Неизвестно"
        dept_name = "-"
        if org:
            if org.type == 'branch':
                branch_name = org.name
            elif org.type == 'department':
                dept_name = org.name
                parent = db.query(OrganizationUnit).get(org.parent_id)
                if parent: branch_name = parent.name

        base_n = fin.base_net if fin else 0
        base_g = fin.base_gross if fin else 0
        kpi_n = fin.kpi_net if fin else 0
        kpi_g = fin.kpi_gross if fin else 0
        bonus_n = fin.bonus_net if fin else 0
        bonus_g = fin.bonus_gross if fin else 0

        # Calculate Totals on the fly if not stored, or trust stored
        total_n = base_n + kpi_n + bonus_n
        total_g = base_g + kpi_g + bonus_g

        results.append({
            "id": emp.id,
            "full_name": emp.full_name,
            "position": pos_name,
            "branch": branch_name,
            "department": dept_name,
            "base": {"net": base_n, "gross": base_g},
            "kpi": {"net": kpi_n, "gross": kpi_g},
            "bonus": {"net": bonus_n, "gross": bonus_g},
            "total": {"net": total_n, "gross": total_g},
            "status": emp.status or "Активен"
        })
    return results

@router.post("/employees")
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # 1. Check Permissions: 'add_employees' OR 'Administrator' role
    has_perm = False
    if current_user.role_rel and current_user.role_rel.name == 'Administrator':
        has_perm = True
    elif current_user.role_rel and current_user.role_rel.permissions.get('add_employees'):
        has_perm = True
        
    if not has_perm:
        raise HTTPException(403, "Permission 'add_employees' required")

    target_org_id = data.department_id if data.department_id else data.branch_id
    
    # Restrict creation to own scope
    if current_user.scope_branches:
        # Re-calculate allowed IDs (should extract to function, but inline for now)
        allowed_ids = []
        user_dept_ids = set()
        if current_user.scope_departments:
             user_dept_ids = {int(x) for x in current_user.scope_departments}

        for bid_raw in current_user.scope_branches:
            bid = int(bid_raw)
            depts = db.query(OrganizationUnit).filter_by(parent_id=bid, type="department").all()
            dept_ids = {d.id for d in depts}
            intersection = user_dept_ids.intersection(dept_ids)
            if intersection:
                allowed_ids.extend(list(intersection))
            else:
                allowed_ids.append(bid)
                allowed_ids.extend(list(dept_ids))
        
        if target_org_id not in allowed_ids:
            raise HTTPException(403, "You cannot add employees outside your scope")

    pos = db.query(Position).filter_by(title=data.position_title).first()
    if not pos:
        pos = Position(title=data.position_title)
        db.add(pos)
        db.flush()
    
    new_emp = Employee(full_name=data.full_name, position_id=pos.id, org_unit_id=target_org_id, status=data.status)
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    bonus_dict = {"net": data.bonus_net, "gross": data.bonus_gross} 
    
    total_n = data.base_net + data.kpi_net + data.bonus_net
    total_g = data.base_gross + data.kpi_gross + data.bonus_gross

    fin = FinancialRecord(
        employee_id=new_emp.id,
        month=datetime.now().strftime("%Y-%m"),
        
        base_net=data.base_net,
        base_gross=data.base_gross,
        
        kpi_net=data.kpi_net,
        kpi_gross=data.kpi_gross,
        
        bonus_net=data.bonus_net,
        bonus_gross=data.bonus_gross,
        
        additional_payments=bonus_dict, # Keeping legacy field populated just in case with json
        
        total_net=total_n,
        total_gross=total_g,
        
        # Legacy fills (approx)
        base_salary=data.base_net,
        kpi_amount=data.kpi_net,
        total_payment=total_n
    )
    db.add(fin)
    db.commit()
    return {"status": "success", "id": new_emp.id}

@router.patch("/employees/{emp_id}/financials")
def update_financials(emp_id: int, update: FinancialUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # 1. Check Permissions: 'edit_financials' OR 'Administrator' role
    has_perm = False
    if current_user.role_rel and current_user.role_rel.name == 'Administrator':
        has_perm = True
    elif current_user.role_rel and current_user.role_rel.permissions.get('edit_financials'):
        has_perm = True
        
    if not has_perm:
        raise HTTPException(403, "Permission 'edit_financials' required")

    # Check Scope
    emp = db.query(Employee).get(emp_id)
    if not emp: raise HTTPException(404, "Employee not found")
    
    if current_user.scope_branches:
        allowed_ids = []
        user_dept_ids = set()
        if current_user.scope_departments:
             user_dept_ids = {int(x) for x in current_user.scope_departments}

        for bid_raw in current_user.scope_branches:
            bid = int(bid_raw)
            depts = db.query(OrganizationUnit).filter_by(parent_id=bid, type="department").all()
            dept_ids = {d.id for d in depts}
            intersection = user_dept_ids.intersection(dept_ids)
            if intersection:
                allowed_ids.extend(list(intersection))
            else:
                allowed_ids.append(bid)
                allowed_ids.extend(list(dept_ids))
                
        if emp.org_unit_id not in allowed_ids:
             raise HTTPException(403, "Access denied to this employee")

    fin_record = db.query(FinancialRecord).filter_by(employee_id=emp_id).order_by(desc(FinancialRecord.id)).first()
    if not fin_record: raise HTTPException(404, "No record")
    
    changes = {}
    
    def check_update(field_name, new_val, old_val, model_field):
        if new_val is not None and new_val != old_val:
            changes[field_name] = {'old': old_val, 'new': new_val}
            setattr(fin_record, model_field, new_val)

    check_update('Оклад (Net)', update.base_net, fin_record.base_net, 'base_net')
    check_update('Оклад (Gross)', update.base_gross, fin_record.base_gross, 'base_gross')
    
    check_update('KPI (Net)', update.kpi_net, fin_record.kpi_net, 'kpi_net')
    check_update('KPI (Gross)', update.kpi_gross, fin_record.kpi_gross, 'kpi_gross')
    
    check_update('Бонус (Net)', update.bonus_net, fin_record.bonus_net, 'bonus_net')
    check_update('Бонус (Gross)', update.bonus_gross, fin_record.bonus_gross, 'bonus_gross')

    # Recalculate totals
    fin_record.total_net = fin_record.base_net + fin_record.kpi_net + fin_record.bonus_net
    fin_record.total_gross = fin_record.base_gross + fin_record.kpi_gross + fin_record.bonus_gross
    
    # Legacy sync
    fin_record.base_salary = fin_record.base_net
    fin_record.kpi_amount = fin_record.kpi_net
    fin_record.total_payment = fin_record.total_net
    
    if changes:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        for field, vals in changes.items():
            audit = AuditLog(
                user_id=current_user.id, 
                target_entity="employee",
                target_entity_id=emp_id,
                timestamp=ts,
                old_values={field: vals['old']},
                new_values={field: vals['new']}
            )
            db.add(audit)
        db.commit()
    return {"status": "updated"}

from pydantic import BaseModel
class EmpDetailsUpdate(BaseModel):
    full_name: str
    position_title: str
    branch_id: int | None = None
    department_id: int | None = None

@router.patch("/employees/{emp_id}/details")
def update_employee_details(emp_id: int, data: EmpDetailsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    has_perm = current_user.role_rel.name == 'Administrator' or current_user.role_rel.permissions.get('add_employees')
    if not has_perm: raise HTTPException(403, "Permission 'add_employees' required")

    emp = db.query(Employee).get(emp_id)
    if not emp: raise HTTPException(404, "Employee not found")
    
    changes = {}
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")

    if data.full_name != emp.full_name:
        changes['ФИО'] = {'old': emp.full_name, 'new': data.full_name}
        emp.full_name = data.full_name

    current_pos_title = emp.position.title if emp.position else ""
    if data.position_title != current_pos_title:
        pos = db.query(Position).filter_by(title=data.position_title).first()
        if not pos:
            pos = Position(title=data.position_title)
            db.add(pos)
            db.flush()
        changes['Должность'] = {'old': current_pos_title, 'new': data.position_title}
        emp.position_id = pos.id
        
    new_org_id = data.department_id if data.department_id else data.branch_id
    if new_org_id and new_org_id != emp.org_unit_id:
        changes['Подрезделение (ID)'] = {'old': emp.org_unit_id, 'new': new_org_id}
        emp.org_unit_id = new_org_id

    if changes:
        for field, vals in changes.items():
            audit = AuditLog(user_id=current_user.id, target_entity="employee", target_entity_id=emp_id, timestamp=ts, old_values={field: vals['old']}, new_values={field: vals['new']})
            db.add(audit)
        db.commit()

    return {"status": "details_updated"}

@router.post("/employees/{emp_id}/dismiss")
def dismiss_employee(emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    has_perm = current_user.role_rel.name == 'Administrator' or current_user.role_rel.permissions.get('add_employees')
    if not has_perm: raise HTTPException(403, "Permission required")
    
    emp = db.query(Employee).get(emp_id)
    if not emp: raise HTTPException(404, "Not found")
    
    if emp.status == "Dismissed":
        return {"status": "already_dismissed"}

    emp.status = "Dismissed"
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    audit = AuditLog(user_id=current_user.id, target_entity="employee", target_entity_id=emp_id, timestamp=ts, old_values={"Status": "Active"}, new_values={"Status": "Dismissed"})
    db.add(audit)
    db.commit()
    return {"status": "dismissed"}

@router.get("/audit-logs/{emp_id}")
def get_audit_logs(emp_id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter_by(target_entity_id=emp_id, target_entity="employee").all() 
    logs.reverse()
    formatted_logs = []
    
    user_ids = set(l.user_id for l in logs)
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u.full_name for u in users}

    for log in logs:
        # If new_values is null, it might be a deletion? But for employees we usually don't delete physically? 
        # Actually dismiss is an update.
        if not log.new_values and not log.old_values: continue
        
        # Determine fields from new_values or old_values
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


