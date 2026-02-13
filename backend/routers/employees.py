from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database.database import get_db
from database.models import User, AuditLog, Employee, OrganizationUnit, Position
from schemas import EmployeeCreate, FinancialUpdate, EmployeeUpdate, EmpDetailsUpdate
from dependencies import get_current_active_user, get_user_scope, PermissionChecker
from services.employee_service import EmployeeService
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from io import BytesIO

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

@router.get("/employees/export")
def export_employees_excel(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user),
    scope: Optional[List[int]] = Depends(get_user_scope)
):
    # Get employees data using service
    employees_data = EmployeeService.get_employees(db, current_user, scope)
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Сотрудники"
    
    # Header styling
    header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    
    # Headers
    headers = [
        "ФИО", "Должность", "Филиал", "Отдел", "Статус",
        "Оклад (Нет)", "Оклад (Брут)", "KPI (Нет)", "KPI (Брут)",
        "Бонус (Нет)", "Бонус (Брут)", "Всего (Нет)", "Всего (Брут)"
    ]
    
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
    
    # Data rows
    for row_num, emp in enumerate(employees_data, 2):
        # position is returned as a string directly
        position_title = emp.get("position", "-")
        
        # branch and department are returned directly, not nested
        branch = emp.get("branch", "-")
        department = emp.get("department", "-")
        
        # Handle financials - these are dictionaries
        base = emp.get("base", {})
        kpi = emp.get("kpi", {})
        bonus = emp.get("bonus", {})
        total = emp.get("total", {})
        
        data = [
            emp.get("full_name", "-"),
            position_title,
            branch,
            department,
            emp.get("status", "-"),
            base.get("net", 0) if isinstance(base, dict) else 0,
            base.get("gross", 0) if isinstance(base, dict) else 0,
            kpi.get("net", 0) if isinstance(kpi, dict) else 0,
            kpi.get("gross", 0) if isinstance(kpi, dict) else 0,
            bonus.get("net", 0) if isinstance(bonus, dict) else 0,
            bonus.get("gross", 0) if isinstance(bonus, dict) else 0,
            total.get("net", 0) if isinstance(total, dict) else 0,
            total.get("gross", 0) if isinstance(total, dict) else 0
        ]
        
        for col_num, value in enumerate(data, 1):
            cell = ws.cell(row=row_num, column=col_num, value=value)
            if col_num >= 6:  # Number columns
                cell.number_format = '#,##0'
            cell.alignment = Alignment(horizontal="left" if col_num <= 5 else "right")
    
    # Column widths
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 25
    ws.column_dimensions['C'].width = 20
    ws.column_dimensions['D'].width = 20
    ws.column_dimensions['E'].width = 12
    for col in ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']:
        ws.column_dimensions[col].width = 14
    
    # Save to BytesIO
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    filename = f"Employees_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=excel_file.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
