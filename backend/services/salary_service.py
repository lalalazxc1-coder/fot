"""
FIX #26: Single source of truth for salary/tax calculation.
This module is the ONLY place where calculate_taxes() and solve_gross_from_net() are defined.
Uses Decimal for precision in all calculations.
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from database.models import SalaryConfiguration, Position, Employee, FinancialRecord, PlanningPosition, AuditLog, User, OrganizationUnit

# --- Tax Calculation Logic (Decimal precision) ---

def calculate_taxes(gross_val: float, config: SalaryConfiguration, apply_deduction: bool = True):
    """
    Standard RK Calculation (2024) using Decimal for precision.
    Returns dictionary with all tax components as float values.
    """
    gross = Decimal(str(gross_val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    mrp = Decimal(str(config.mrp))
    mzp = Decimal(str(config.mzp))
    
    # Rates
    opv_rate = Decimal(str(config.opv_rate))
    opvr_rate = Decimal(str(config.opvr_rate or 0))
    vosms_rate = Decimal(str(config.vosms_rate))
    vosms_emp_rate = Decimal(str(config.vosms_employer_rate))
    so_rate = Decimal(str(config.so_rate))
    sn_rate = Decimal(str(config.sn_rate))
    ipn_rate = Decimal(str(config.ipn_rate))
    
    # 1. OPV (Pension) — Cap: opv_limit_mzp * MZP
    opv_limit = Decimal(str(config.opv_limit_mzp)) * mzp
    opv_base = min(gross, opv_limit)
    opv = (opv_base * opv_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # 2. VOSMS (Health Employee) — Cap: vosms_limit_mzp * MZP
    vosms_limit = Decimal(str(config.vosms_limit_mzp)) * mzp
    vosms_base = min(gross, vosms_limit)
    vosms = (vosms_base * vosms_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # 3. IPN (Income Tax) — Base = Gross - OPV - VOSMS - Deduction (ipn_deduction_mrp * MRP)
    deduction_amt = (Decimal(str(config.ipn_deduction_mrp)) * mrp) if apply_deduction else Decimal(0)
    ipn_base = gross - opv - vosms - deduction_amt
    if ipn_base < 0: ipn_base = Decimal(0)
    
    ipn = (ipn_base * ipn_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # 4. Net
    net = gross - opv - vosms - ipn
    
    # Employer Side
    # OSMS
    osms_base = min(gross, vosms_limit)
    osms = (osms_base * vosms_emp_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # SO (Social Insurance) — Base: Gross - OPV, Cap: 7 * MZP, Min: 1 * MZP
    so_base_raw = gross - opv
    so_cap = Decimal(7) * mzp
    so_min = mzp
    
    so_base = max(so_min, min(so_base_raw, so_cap))
    so = (so_base * so_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # SN (Social Tax) — General Regime: SN = (Gross - OPV) * sn_rate - SO
    sn_base = gross - opv
    sn_calc = (sn_base * sn_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sn = max(Decimal(0), sn_calc - so)
    
    # OPVR (Employer Pension) — Cap = opvr_limit_mzp * MZP
    opvr_limit = Decimal(str(getattr(config, 'opvr_limit_mzp', 50))) * mzp
    opvr_base = min(gross, opvr_limit)
    opvr = (opvr_base * opvr_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    return {
        "gross": float(gross),
        "net": float(net),
        "opv": float(opv),
        "vosms": float(vosms),
        "ipn": float(ipn),
        "osms": float(osms),
        "so": float(so),
        "sn": float(sn),
        "opvr": float(opvr),
        "deduction": float(deduction_amt)
    }

def solve_gross_from_net(target_net_val: float, config: SalaryConfiguration, apply_deduction: bool = True) -> float:
    """
    Reverse calculation: given target net, find the gross using binary search.
    Uses Decimal precision for iterative approximation.
    """
    target_net = Decimal(str(target_net_val))
    
    low = target_net
    high = target_net * Decimal("2.0")
    
    mid = Decimal(0)
    
    for _ in range(25):
        mid = (low + high) / Decimal(2)
        res = calculate_taxes(float(mid), config, apply_deduction)
        calc_net = Decimal(str(res['net']))
        
        if abs(calc_net - target_net) < Decimal("0.01"):
            return float(mid)
            
        if calc_net < target_net:
            low = mid
        else:
            high = mid
            
    return float((low + high) / Decimal(2))

# --- Sync Logic ---

def sync_employee_financials(db: Session, plan: PlanningPosition, changes: dict, user: User, audit_ts: str):
    """
    Synchronizes financial changes from a Plan to all relevant Employees.
    Only triggered if financial fields are modified.
    """
    fin_fields = {'base_net', 'base_gross', 'kpi_net', 'kpi_gross', 'bonus_net', 'bonus_gross'}
    changed_fin_fields = set(changes.keys()).intersection(fin_fields)
    
    if not changed_fin_fields:
        return 0
        
    # Find active employees in this position & unit
    target_org_id = plan.department_id if plan.department_id else plan.branch_id
    
    if not plan.position_title or not target_org_id:
        return 0
    
    # Join Position table to match title
    employees = db.query(Employee).join(Position).filter(
        Position.title == plan.position_title,
        Employee.org_unit_id == target_org_id,
        Employee.status != 'Dismissed'
    ).all()
    
    sync_count = 0
    for emp in employees:
        # Get latest financial record
        fin = db.query(FinancialRecord).filter_by(employee_id=emp.id).order_by(desc(FinancialRecord.id)).first()
        if fin:
            emp_audit_changes = {}

            def apply_change_val(field, new_val):
                old_val = getattr(fin, field)
                if old_val != new_val:
                    setattr(fin, field, new_val)
                    emp_audit_changes[field] = {'old': old_val, 'new': new_val}

            # Apply updates
            if 'base_net' in changes: apply_change_val('base_net', plan.base_net)
            if 'base_gross' in changes: apply_change_val('base_gross', plan.base_gross)
            
            if 'kpi_net' in changes: apply_change_val('kpi_net', plan.kpi_net)
            if 'kpi_gross' in changes: apply_change_val('kpi_gross', plan.kpi_gross)
            
            if 'bonus_net' in changes: apply_change_val('bonus_net', plan.bonus_net)
            if 'bonus_gross' in changes: apply_change_val('bonus_gross', plan.bonus_gross)
            
            if emp_audit_changes:
                # FIX #M1: Корректный пересчёт total с учётом bonus_count
                # bonus_count в плане = кол-во получателей доплаты (не все).
                # При синхронизации с конкретным сотрудником мы записываем
                # ему full bonus_net (как у него персонально), т.к. bonus_net
                # в FinancialRecord хранится на единицу, а не с умножением.
                # Итого корректно: base + kpi + bonus (на одного сотрудника).
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
                if user:
                    db.add(AuditLog(
                        user_id=user.id,
                        target_entity="employee",
                        target_entity_id=emp.id,
                        timestamp=audit_ts,
                        old_values={k: v['old'] for k,v in emp_audit_changes.items()},
                        new_values={k: v['new'] for k,v in emp_audit_changes.items()}
                    ))
    
    return sync_count
