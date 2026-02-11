from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from fastapi import HTTPException
from datetime import datetime
from typing import List, Optional, Any

from database.models import Employee, FinancialRecord, Position, OrganizationUnit, AuditLog, User
from schemas import EmployeeCreate, FinancialUpdate, EmployeeUpdate, EmpDetailsUpdate

class EmployeeService:
    @staticmethod
    def get_employees(db: Session, current_user: User, scope_ids: Optional[List[int]]) -> List[Any]:
        """
        Retrieves employees with optimizations (joinedload) and scope filtering.
        """
        query = db.query(Employee).options(
            joinedload(Employee.financial_records),
            joinedload(Employee.org_unit),
            joinedload(Employee.position)
        )

        # Apply Scope Filter
        # scope_ids is calculated by dependency. If None -> Admin/All access.
        if scope_ids is not None:
             query = query.filter(Employee.org_unit_id.in_(scope_ids))

        employees = query.all()
        results = []
        
        # We need to pre-fetch Organization structure to resolve parent names efficiently
        # Or we can rely on lazy loading since we reduced valid queries to N, but let's try to be efficient.
        # Although Employee.org_unit is joined loaded, we might need parent of org_unit.
        # Let's trust joinedload(Employee.org_unit) for now, and if we need parent name, 
        # accessing org.parent might trigger lazy load. 
        # To avoid N+1 for org parents, we could eager load org_unit.parent too? 
        # options(joinedload(Employee.org_unit).joinedload(OrganizationUnit.parent)) isn't directly possibly easily 
        # if using self-referential without clear relationship name in model.
        # Let's stick to simple logic for now, much better than loop over financials.

        for emp in employees:
            # Financials: In One-to-Many, we usually want the LATEST record.
            # Python side filtering/sorting might be faster than subquery for small N, 
            # but ideally we should have a relationship 'current_financial_record'.
            # For now, we sort in Python since we joined loaded them.
            fin = None
            if emp.financial_records:
                # Assuming ID is increasing with time, or sort by ID desc
                fin = sorted(emp.financial_records, key=lambda x: x.id, reverse=True)[0]
            
            pos_name = emp.position.title if emp.position else "Не указано"
            
            org = emp.org_unit
            branch_name = "Неизвестно"
            dept_name = "-"
            branch_id = None
            department_id = None

            if org:
                # Naive resolution, might trigger manageable lazy loads
                if org.type == 'branch':
                    branch_name = org.name
                    branch_id = org.id
                elif org.type == 'department':
                    dept_name = org.name
                    department_id = org.id
                    # This might trigger a query if parent not loaded. 
                    # Acceptable for now as it's cached in session identity map often.
                    if org.parent_id:
                        # We can try to fetch from session or simple query
                        # Since we don't have parent relationship explicitly loaded in query above easily without alias
                       parent = db.query(OrganizationUnit).get(org.parent_id)
                       if parent: 
                           branch_name = parent.name
                           branch_id = parent.id

            base_n = fin.base_net if fin else 0
            base_g = fin.base_gross if fin else 0
            kpi_n = fin.kpi_net if fin else 0
            kpi_g = fin.kpi_gross if fin else 0
            bonus_n = fin.bonus_net if fin else 0
            bonus_g = fin.bonus_gross if fin else 0

            # Calculate Totals on the fly
            total_n = base_n + kpi_n + bonus_n
            total_g = base_g + kpi_g + bonus_g

            results.append({
                "id": emp.id,
                "org_unit_id": emp.org_unit_id,
                "branch_id": branch_id,
                "department_id": department_id,
                "full_name": emp.full_name,
                "position": pos_name,
                "branch": branch_name,
                "department": dept_name,
                "base": {"net": base_n, "gross": base_g},
                "kpi": {"net": kpi_n, "gross": kpi_g},
                "bonus": {"net": bonus_n, "gross": bonus_g},
                "total": {"net": total_n, "gross": total_g},
                "status": emp.status or "Активен",
                "hire_date": emp.hire_date
            })
        return results

    @staticmethod
    def create_employee(db: Session, user: User, data: EmployeeCreate, scope_ids: Optional[List[int]]) -> dict:
        target_org_id = data.department_id if data.department_id else data.branch_id
        
        # Scope Check
        if scope_ids is not None:
             if target_org_id not in scope_ids:
                 raise HTTPException(403, "You cannot add employees outside your scope")

        # Position
        pos = db.query(Position).filter_by(title=data.position_title).first()
        if not pos:
            pos = Position(title=data.position_title)
            db.add(pos)
            db.flush()
        
        new_emp = Employee(
            full_name=data.full_name, 
            position_id=pos.id, 
            org_unit_id=target_org_id, 
            status=data.status, 
            hire_date=data.hire_date
        )
        db.add(new_emp)
        db.commit()
        db.refresh(new_emp)

        # Financials
        total_n = data.base_net + data.kpi_net + data.bonus_net
        total_g = data.base_gross + data.kpi_gross + data.bonus_gross
        
        fin = FinancialRecord(
            employee_id=new_emp.id,
            month=datetime.now().strftime("%Y-%m"),
            base_net=data.base_net, base_gross=data.base_gross,
            kpi_net=data.kpi_net, kpi_gross=data.kpi_gross,
            bonus_net=data.bonus_net, bonus_gross=data.bonus_gross,
            additional_payments={"net": data.bonus_net, "gross": data.bonus_gross},
            total_net=total_n, total_gross=total_g,
            # Legacy
            base_salary=data.base_net, kpi_amount=data.kpi_net, total_payment=total_n
        )
        db.add(fin)
        
        # Log
        EmployeeService._log_change(db, user, new_emp.id, 
            new_values={
                "created": f"Создан сотрудник: {new_emp.full_name}",
                "position": pos.title,
                "hire_date": new_emp.hire_date or "-"
            }
        )
        db.commit()

        return {"status": "success", "id": new_emp.id}

    @staticmethod
    def update_financials(db: Session, user: User, emp_id: int, update: FinancialUpdate, scope_ids: Optional[List[int]]) -> dict:
        emp = db.query(Employee).get(emp_id)
        if not emp: raise HTTPException(404, "Employee not found")

        if scope_ids is not None:
             if emp.org_unit_id not in scope_ids:
                  raise HTTPException(403, "Access denied to this employee")

        fin_record = db.query(FinancialRecord).filter_by(employee_id=emp_id).order_by(desc(FinancialRecord.id)).first()
        if not fin_record: raise HTTPException(404, "No financial record found")

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

        # Recalc
        fin_record.total_net = fin_record.base_net + fin_record.kpi_net + fin_record.bonus_net
        fin_record.total_gross = fin_record.base_gross + fin_record.kpi_gross + fin_record.bonus_gross
        # Legacy
        fin_record.base_salary = fin_record.base_net
        fin_record.kpi_amount = fin_record.kpi_net
        fin_record.total_payment = fin_record.total_net

        if changes:
             EmployeeService._log_changes_dict(db, user, emp_id, changes)
             db.commit()
             
        return {"status": "updated"}

    @staticmethod
    def update_employee(db: Session, user: User, emp_id: int, data: EmployeeUpdate, scope_ids: Optional[List[int]]):
        emp = db.query(Employee).get(emp_id)
        if not emp: raise HTTPException(404, "Employee not found")

        if scope_ids is not None:
             if emp.org_unit_id not in scope_ids:
                  raise HTTPException(403, "Access denied (Out of scope)")

        changes = {}
        
        # Basic Info
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
             # Check if new org is in scope? 
             if scope_ids is not None and new_org_id not in scope_ids:
                  raise HTTPException(403, "Cannot move employee to a branch/dept outside your scope")
             
             changes['Подразделение (ID)'] = {'old': emp.org_unit_id, 'new': new_org_id}
             emp.org_unit_id = new_org_id

        # Financials (Create or Update)
        # Reusing similar logic but integrated
        fin = db.query(FinancialRecord).filter_by(employee_id=emp_id).order_by(desc(FinancialRecord.id)).first()
        
        if not fin:
             # Create new
             total_n = data.base_net + data.kpi_net + data.bonus_net
             total_g = data.base_gross + data.kpi_gross + data.bonus_gross
             fin = FinancialRecord(
                employee_id=emp_id, month=datetime.now().strftime("%Y-%m"),
                base_net=data.base_net, base_gross=data.base_gross,
                kpi_net=data.kpi_net, kpi_gross=data.kpi_gross,
                bonus_net=data.bonus_net, bonus_gross=data.bonus_gross,
                total_net=total_n, total_gross=total_g,
                base_salary=data.base_net, kpi_amount=data.kpi_net, total_payment=total_n
             )
             db.add(fin)
             changes['Финансы'] = {'old': 'Не было', 'new': 'Создана запись'}
        else:
            # Update Helper
            def upd(fld, val, old, model_fld, label):
                 if val != old:
                      changes[label] = {'old': old, 'new': val}
                      setattr(fin, model_fld, val)
            
            upd('base_net', data.base_net, fin.base_net, 'base_net', 'Оклад (Net)')
            upd('base_gross', data.base_gross, fin.base_gross, 'base_gross', 'Оклад (Gross)')
            upd('kpi_net', data.kpi_net, fin.kpi_net, 'kpi_net', 'KPI (Net)')
            upd('kpi_gross', data.kpi_gross, fin.kpi_gross, 'kpi_gross', 'KPI (Gross)')
            upd('bonus_net', data.bonus_net, fin.bonus_net, 'bonus_net', 'Доплаты (Net)')
            upd('bonus_gross', data.bonus_gross, fin.bonus_gross, 'bonus_gross', 'Доплаты (Gross)')
            
            fin.total_net = fin.base_net + fin.kpi_net + fin.bonus_net
            fin.total_gross = fin.base_gross + fin.kpi_gross + fin.bonus_gross
            fin.base_salary = fin.base_net; fin.kpi_amount = fin.kpi_net; fin.total_payment = fin.total_net

        if changes:
             EmployeeService._log_changes_dict(db, user, emp_id, changes)
             db.commit()

        return {"status": "updated"}

    @staticmethod
    def update_details(db: Session, user: User, emp_id: int, data: EmpDetailsUpdate, scope_ids: Optional[List[int]]):
        emp = db.query(Employee).get(emp_id)
        if not emp: raise HTTPException(404, "Not found")
        
        if scope_ids is not None:
             if emp.org_unit_id not in scope_ids: raise HTTPException(403, "Access Denied")

        changes = {}
        if data.full_name != emp.full_name:
             changes['ФИО'] = {'old': emp.full_name, 'new': data.full_name}
             emp.full_name = data.full_name
             
        current_pos = emp.position.title if emp.position else ""
        if data.position_title != current_pos:
             # Find pos
             pos = db.query(Position).filter_by(title=data.position_title).first()
             if not pos:
                  pos = Position(title=data.position_title); db.add(pos); db.flush()
             changes['Должность'] = {'old': current_pos, 'new': data.position_title}
             emp.position_id = pos.id
             
        new_org_id = data.department_id if data.department_id else data.branch_id
        if new_org_id and new_org_id != emp.org_unit_id:
             if scope_ids is not None and new_org_id not in scope_ids: raise HTTPException(403, "Cannot move to out of scope")
             changes['Подразделение'] = {'old': emp.org_unit_id, 'new': new_org_id}
             emp.org_unit_id = new_org_id
        
        if changes:
             EmployeeService._log_changes_dict(db, user, emp_id, changes)
             db.commit()
        return {"status": "details_updated"}

    @staticmethod
    def dismiss_employee(db: Session, user: User, emp_id: int, scope_ids: Optional[List[int]]):
        emp = db.query(Employee).get(emp_id)
        if not emp: raise HTTPException(404, "Not found")
        
        if scope_ids is not None:
             if emp.org_unit_id not in scope_ids: raise HTTPException(403, "Access Denied")
             
        if emp.status == "Dismissed": return {"status": "already_dismissed"}
        
        emp.status = "Dismissed"
        EmployeeService._log_change(db, user, emp_id, old_values={"Status": "Active"}, new_values={"Status": "Dismissed"})
        db.commit()
        return {"status": "dismissed"}

    @staticmethod
    def _log_change(db: Session, user: User, emp_id: int, old_values: dict = None, new_values: dict = None):
        if not old_values: old_values = {}
        if not new_values: new_values = {}
        log = AuditLog(
             user_id=user.id, target_entity="employee", target_entity_id=emp_id,
             timestamp=datetime.now().strftime("%d.%m.%Y %H:%M"),
             old_values=old_values, new_values=new_values
        )
        db.add(log)
        
    @staticmethod
    def _log_changes_dict(db: Session, user: User, emp_id: int, changes: dict):
        for field, vals in changes.items():
            EmployeeService._log_change(db, user, emp_id, old_values={field: vals['old']}, new_values={field: vals['new']})
