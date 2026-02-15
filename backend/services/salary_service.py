from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from database.models import SalaryConfiguration, Position, Employee, FinancialRecord, PlanningPosition, AuditLog, User, OrganizationUnit

# --- Tax Calculation Logic ---

def calculate_taxes(gross: float, config: SalaryConfiguration, apply_deduction: bool = True):
    """
    Standard RK Calculation (2024)
    Returns dictionary with all tax components.
    """
    # 1. OPV (Pension)
    # Cap: 50 * MZP
    opv_base = min(gross, config.opv_limit_mzp * config.mzp)
    opv = opv_base * config.opv_rate
    
    # 2. VOSMS (Health Employee)
    # Cap: 10 * MZP
    vosms_base = min(gross, config.vosms_limit_mzp * config.mzp)
    vosms = vosms_base * config.vosms_rate
    
    # 3. IPN (Income Tax)
    # Base = Gross - OPV - VOSMS - Deduction (14 MRP)
    deduction = (config.ipn_deduction_mrp * config.mrp) if apply_deduction else 0
    ipn_base = gross - opv - vosms - deduction
    if ipn_base < 0: ipn_base = 0
    
    ipn = ipn_base * config.ipn_rate
    
    # 4. Net
    net = gross - opv - vosms - ipn
    
    # Employer Side
    # OSMS
    osms_base = min(gross, config.vosms_limit_mzp * config.mzp)
    osms = osms_base * config.vosms_employer_rate
    
    # SO (Social Insurance)
    # Base: Gross - OPV, Cap: 7 * MZP, Min: 1 * MZP
    so_base_raw = gross - opv
    so_cap = 7 * config.mzp
    so_min = config.mzp
    
    so_base = max(so_min, min(so_base_raw, so_cap))
    
    so = so_base * config.so_rate
    
    # SN (Social Tax)
    # Base: Gross - OPV - VOSMS (or just Gross - OPV? Rules vary by regime. General regime: Gross - OPV)
    # General Regime: SN = (Gross - OPV) * 9.5% - SO
    sn_base = gross - opv
    sn_calc = sn_base * config.sn_rate
    sn = max(0, sn_calc - so)
    
    # OPVR (Employer Pension)
    # Base = Gross, Cap = 50 MZP
    opvr_base = min(gross, getattr(config, 'opvr_limit_mzp', 50) * config.mzp)
    opvr = opvr_base * getattr(config, 'opvr_rate', 0.0)
    
    return {
        "gross": round(gross, 2),
        "net": round(net, 2),
        "opv": round(opv, 2),
        "vosms": round(vosms, 2),
        "ipn": round(ipn, 2),
        "osms": round(osms, 2),
        "so": round(so, 2),
        "sn": round(sn, 2),
        "opvr": round(opvr, 2),
        "deduction": deduction
    }

def solve_gross_from_net(target_net: float, config: SalaryConfiguration, apply_deduction: bool = True) -> float:
    """
    Reverse calculation.
    """
    # Initial guess: Net / 0.8
    guess = target_net / 0.8
    
    # Binary Search
    low = target_net
    high = target_net * 2.0
    
    for _ in range(20): # 20 iterations is plenty for float precision
        mid = (low + high) / 2
        res = calculate_taxes(mid, config, apply_deduction)
        calc_net = res['net']
        
        if abs(calc_net - target_net) < 0.01:
            return mid
            
        if calc_net < target_net:
            low = mid
        else:
            high = mid
            
    return (low + high) / 2

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
    # Resolve OrgUnit ID (Dept if exists, else Branch)
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
