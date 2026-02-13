from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from database.database import get_db
from database.models import PlanningPosition, User, OrganizationUnit, AuditLog
from routers.auth import get_current_active_user
from pydantic import BaseModel
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from io import BytesIO

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
    if user.role_rel and user.role_rel.permissions.get('admin_access'): return True
    return user.role_rel.permissions.get('manage_planning', False) if user.role_rel and user.role_rel.permissions else False

def filter_by_scope(query, user: User, db: Session):
    is_admin = False
    if user.role_rel:
        if user.role_rel.permissions.get('admin_access'): is_admin = True
        
    if is_admin: return query
    
    allowed_branch_ids = []
    
    if user.scope_branches:
        for bid_raw in user.scope_branches:
            bid = int(bid_raw)
            allowed_branch_ids.append(bid)
            
    # Simple branch filtering for now. Department level filtering could be added if needed.
    if allowed_branch_ids:
        return query.filter(PlanningPosition.branch_id.in_(allowed_branch_ids))
    
    # If no scope defined but not admin - allow access to all branches
    # This is logical: no restriction = access to everything
    return query 


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

    # Validation
    if not plan.schedule:
        raise HTTPException(400, "Необходимо указать график работы")
        
    if plan.base_net <= 0 and plan.base_gross <= 0:
        raise HTTPException(400, "Необходимо указать оклад (Net или Gross)")

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
    db.refresh(new_plan)
    
    # CLEANUP: Remove old logs if ID was reused (SQLite quirk)
    db.query(AuditLog).filter_by(target_entity="planning", target_entity_id=new_plan.id).delete()
    
    # Audit
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    audit = AuditLog(
        user_id=current_user.id,
        target_entity="planning",
        target_entity_id=new_plan.id,
        timestamp=ts,
        old_values=None,
        new_values={
            "Событие": "Создана позиция",
            "Должность": plan.position,
            "Филиал (ID)": plan.branch_id,
            "Отдел (ID)": plan.department_id,
            "График": plan.schedule,
            "Количество": plan.count,
            "Оклад (Net)": plan.base_net,
            "Оклад (Gross)": plan.base_gross,
            "KPI (Net)": plan.kpi_net,
            "KPI (Gross)": plan.kpi_gross,
            "Доплаты (Net)": plan.bonus_net,
            "Доплаты (Gross)": plan.bonus_gross
        }
    )
    db.add(audit)
    db.commit()
    
    return {"status": "success", "id": new_plan.id}

# --- Private Helpers ---

def _sync_employee_financials(db: Session, plan: PlanningPosition, changes: dict, user: User, audit_ts: str):
    """
    Synchronizes financial changes from a Plan to all relevant Employees.
    Only triggered if financial fields are modified.
    """
    fin_fields = {'base_net', 'base_gross', 'kpi_net', 'kpi_gross', 'bonus_net', 'bonus_gross'}
    changed_fin_fields = set(changes.keys()).intersection(fin_fields)
    
    if not changed_fin_fields:
        return 0
        
    # Find matching employees
    from database.models import Position, Employee, FinancialRecord
    pos = db.query(Position).filter_by(title=plan.position_title).first()
    
    # Resolve OrgUnit ID (Dept if exists, else Branch)
    target_org_id = plan.department_id if plan.department_id else plan.branch_id
    
    if not pos or not target_org_id:
        return 0
        
    # Find active employees in this position & unit
    employees = db.query(Employee).filter(
        Employee.position_id == pos.id,
        Employee.org_unit_id == target_org_id,
        Employee.status != 'Dismissed'
    ).all()
    
    sync_count = 0
    for emp in employees:
        # Get latest financial record
        fin = db.query(FinancialRecord).filter_by(employee_id=emp.id).order_by(desc(FinancialRecord.id)).first()
        if fin:
            emp_audit_changes = {}

            def apply_chamge_val(field, new_val):
                old_val = getattr(fin, field)
                if old_val != new_val:
                    setattr(fin, field, new_val)
                    emp_audit_changes[field] = {'old': old_val, 'new': new_val}

            # Apply updates
            if 'base_net' in changes: apply_chamge_val('base_net', plan.base_net)
            if 'base_gross' in changes: apply_chamge_val('base_gross', plan.base_gross)
            
            if 'kpi_net' in changes: apply_chamge_val('kpi_net', plan.kpi_net)
            if 'kpi_gross' in changes: apply_chamge_val('kpi_gross', plan.kpi_gross)
            
            if 'bonus_net' in changes: apply_chamge_val('bonus_net', plan.bonus_net)
            if 'bonus_gross' in changes: apply_chamge_val('bonus_gross', plan.bonus_gross)
            
            if emp_audit_changes:
                # Recalc totals
                fin.total_net = fin.base_net + fin.kpi_net + fin.bonus_net
                fin.total_gross = fin.base_gross + fin.kpi_gross + fin.bonus_gross
                
                # Legacy Sync (for backward compatibility)
                fin.base_salary = fin.base_net
                fin.kpi_amount = fin.kpi_net
                fin.total_payment = fin.total_net

                sync_count += 1
                
                # Add metadata
                emp_audit_changes['sync_source'] = {'old': '', 'new': f'План (ID: {plan.id})'}

                # Create Audit Log for Employee update
                db.add(AuditLog(
                    user_id=user.id,
                    target_entity="employee",
                    target_entity_id=emp.id,
                    timestamp=audit_ts,
                    old_values={k: v['old'] for k,v in emp_audit_changes.items()},
                    new_values={k: v['new'] for k,v in emp_audit_changes.items()}
                ))
    
    return sync_count


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
    
    for key, val in update_data.items():
        db_key = key
        # Handle field mapping
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
        
        # Auto-sync logic moved to helper
        synced = _sync_employee_financials(db, db_plan, changes, current_user, ts)
        if synced > 0:
            print(f"Auto-synced {synced} employees for plan {plan_id}")

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
             
    # Delete associated history
    db.query(AuditLog).filter_by(target_entity="planning", target_entity_id=plan_id).delete()
    
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

@router.get("/planning/export")
def export_planning_excel(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    try:
        # Get planning data with scope filtering
        query = db.query(PlanningPosition)
        query = filter_by_scope(query, current_user, db)
        plans = query.all()
        
        print(f"Found {len(plans)} planning positions to export")
        
        # Create workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "ФОТ Планирование"
        
        # Header styling
        header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True, size=11)
        
        # Headers
        headers = [
            "Позиция", "Филиал", "Отдел", "График", "Кол-во",
            "Оклад (Нет)", "Оклад (Брут)", "KPI (Нет)", "KPI (Брут)",
            "Бонус (Нет)", "Бонус (Брут)", "Всего (Нет)", "Всего (Брут)"
        ]
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
        
        # Data rows
        for row_num, plan in enumerate(plans, 2):
            branch_name = "-"
            dept_name = "-"
            
            if plan.branch_id:
                branch = db.query(OrganizationUnit).get(plan.branch_id)
                if branch:
                    branch_name = branch.name
            
            if plan.department_id:
                dept = db.query(OrganizationUnit).get(plan.department_id)
                if dept:
                    dept_name = dept.name
            
            total_net = plan.base_net + plan.kpi_net + plan.bonus_net
            total_gross = plan.base_gross + plan.kpi_gross + plan.bonus_gross
            
            data = [
                plan.position_title,
                branch_name,
                dept_name,
                plan.schedule or "-",
                plan.count,
                plan.base_net,
                plan.base_gross,
                plan.kpi_net,
                plan.kpi_gross,
                plan.bonus_net,
                plan.bonus_gross,
                total_net,
                total_gross
            ]
            
            for col_num, value in enumerate(data, 1):
                cell = ws.cell(row=row_num, column=col_num, value=value)
                if col_num >= 5:  # Number columns
                    cell.number_format = '#,##0'
                cell.alignment = Alignment(horizontal="left" if col_num <= 4 else "right")
        
        # Column widths
        ws.column_dimensions['A'].width = 30
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 20
        ws.column_dimensions['D'].width = 12
        for col in ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']:
            ws.column_dimensions[col].width = 14
        
        # Save to BytesIO
        excel_file = BytesIO()
        wb.save(excel_file)
        excel_content = excel_file.getvalue()
        
        print(f"Excel file size: {len(excel_content)} bytes")
        
        filename = f"FOT_Planning_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return Response(
            content=excel_content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"Error exporting planning: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
