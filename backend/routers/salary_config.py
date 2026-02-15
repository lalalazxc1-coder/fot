from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, root_validator
import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from dependencies import get_db, require_admin
from database.models import SalaryConfiguration, User, AuditLog, PlanningPosition, Employee, FinancialRecord

router = APIRouter(prefix="/api/salary-config", tags=["salary-config"])

# --- Models ---

class SalaryConfigUpdate(BaseModel):
    mrp: Optional[int] = None
    mzp: Optional[int] = None
    
    opv_rate: Optional[float] = None
    opvr_rate: Optional[float] = None
    vosms_rate: Optional[float] = None
    vosms_employer_rate: Optional[float] = None
    so_rate: Optional[float] = None
    sn_rate: Optional[float] = None
    ipn_rate: Optional[float] = None
    
    opv_limit_mzp: Optional[int] = None
    opvr_limit_mzp: Optional[int] = None
    vosms_limit_mzp: Optional[int] = None
    ipn_deduction_mrp: Optional[int] = None

class SalaryCalculationInput(BaseModel):
    amount: float
    type: str  # 'net' or 'gross'
    year: int = 2024
    
    # Flags
    apply_deduction: bool = True
    pensioner: bool = False

class SalaryBreakdown(BaseModel):
    gross: float
    net: float
    
    # Employee Taxes
    opv: float
    vosms: float
    ipn: float
    
    # Employer Taxes
    osms: float
    so: float
    sn: float
    opvr: float
    
    # Details
    deduction_applied: float

# --- Helpers ---

def get_or_create_config(db: Session) -> SalaryConfiguration:
    config = db.query(SalaryConfiguration).first()
    if not config:
        config = SalaryConfiguration(
            mrp=4325,
            mzp=85000,
            opv_rate=0.1,
            opvr_rate=0.025,
            vosms_rate=0.02,
            vosms_employer_rate=0.03,
            so_rate=0.035,
            sn_rate=0.095,
            ipn_rate=0.1,
            opv_limit_mzp=50,
            opvr_limit_mzp=50,
            vosms_limit_mzp=10,
            ipn_deduction_mrp=14,
            updated_at=datetime.now().isoformat()
        )
        db.add(config)
        db.commit()
    return config

def calculate_taxes(gross_val: float, config: SalaryConfiguration, apply_deduction: bool = True):
    """
    Standard RK Calculation (2024) using Decimal for precision.
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
    
    # 1. OPV (Pension)
    # Cap: 50 * MZP
    opv_limit = Decimal(str(config.opv_limit_mzp)) * mzp
    opv_base = min(gross, opv_limit)
    opv = (opv_base * opv_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # 2. VOSMS (Health Employee)
    # Cap: 10 * MZP
    vosms_limit = Decimal(str(config.vosms_limit_mzp)) * mzp
    vosms_base = min(gross, vosms_limit)
    vosms = (vosms_base * vosms_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # 3. IPN (Income Tax)
    # Base = Gross - OPV - VOSMS - Deduction (14 MRP)
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
    
    # SO (Social Insurance)
    # Base: Gross - OPV, Cap: 7 * MZP, Min: 1 * MZP
    so_base_raw = gross - opv
    so_cap = Decimal(7) * mzp
    so_min = mzp
    
    so_base = max(so_min, min(so_base_raw, so_cap))
    so = (so_base * so_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # SN (Social Tax)
    # General Regime: SN = (Gross - OPV) * 9.5% - SO
    sn_base = gross - opv
    sn_calc = (sn_base * sn_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sn = max(Decimal(0), sn_calc - so)
    
    # OPVR (Employer Pension)
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
    Reverse calculation with Decimal precision using iterative approximation.
    """
    target_net = Decimal(str(target_net_val))
    
    # Initial guess
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

# --- Background Task ---

def recalculate_database(config_id: int, user_id: int, db: Session):
    """
    Heavy background task to recalculate all salaries based on new config.
    """
    print(f"Starting background recalculation for config {config_id}")
    config = db.get(SalaryConfiguration, config_id)
    if not config: return

    # 1. Update Planning Positions
    planning_rows = db.query(PlanningPosition).all()
    count = 0
    for row in planning_rows:
        old_gross = row.base_gross + row.kpi_gross + row.bonus_gross
        
        row.base_gross = int(round(solve_gross_from_net(row.base_net, config)))
        row.kpi_gross = int(round(solve_gross_from_net(row.kpi_net, config)))
        row.bonus_gross = int(round(solve_gross_from_net(row.bonus_net, config)))
        
        new_gross = row.base_gross + row.kpi_gross + row.bonus_gross
        if abs(old_gross - new_gross) > 1:
            count += 1
            
    # 2. Update Employees
    employees = db.query(Employee).filter(Employee.status != "Dismissed").all()
    emp_count = 0
    for emp in employees:
        fin = db.query(FinancialRecord).filter_by(employee_id=emp.id).order_by(FinancialRecord.id.desc()).first()
        if fin:
            old_gross = fin.total_gross
            
            fin.base_gross = int(round(solve_gross_from_net(fin.base_net, config)))
            fin.kpi_gross = int(round(solve_gross_from_net(fin.kpi_net, config)))
            fin.bonus_gross = int(round(solve_gross_from_net(fin.bonus_net, config)))
            
            fin.total_gross = fin.base_gross + fin.kpi_gross + fin.bonus_gross
            
            if abs(old_gross - fin.total_gross) > 1:
                emp_count += 1
                
    db.commit()
    print(f"Recalculation complete. Updated {count} plans and {emp_count} employees.")

# --- Endpoints ---

@router.get("/")
def get_config(db: Session = Depends(get_db)):
    return get_or_create_config(db)

@router.post("/")
def update_config(
    update: SalaryConfigUpdate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    config = get_or_create_config(db)
    changes = {}
    data = update.dict(exclude_unset=True)
    
    for k, v in data.items():
        old_val = getattr(config, k)
        if old_val != v:
            setattr(config, k, v)
            changes[k] = {'old': old_val, 'new': v}
            
    if changes:
        config.updated_at = datetime.now().isoformat()
        config.updated_by = current_user.id
        
        db.add(AuditLog(
            user_id=current_user.id,
            target_entity="salary_config",
            target_entity_id=config.id,
            timestamp=datetime.now().isoformat(),
            old_values={k: v['old'] for k,v in changes.items()},
            new_values={k: v['new'] for k,v in changes.items()}
        ))
        
        db.commit()
        
        # Offload heavyweight recalculation to background task
        background_tasks.add_task(recalculate_database, config.id, current_user.id, db)
        
    return config

@router.get("/history")
def get_config_history(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.target_entity == "salary_config").order_by(AuditLog.timestamp.desc()).limit(50).all()
    result = []
    for log in logs:
        user_name = "Unknown"
        try:
            if log.user: user_name = log.user.full_name or log.user.email
        except: pass
        result.append({
            "id": log.id, 
            "timestamp": log.timestamp, 
            "user": user_name,
            "old_values": log.old_values, 
            "new_values": log.new_values
        })
    return result

@router.post("/calculate", response_model=SalaryBreakdown)
def calculate_salary(input: SalaryCalculationInput, db: Session = Depends(get_db)):
    config = get_or_create_config(db)
    gross = 0.0
    if input.type.lower() == 'gross':
        gross = input.amount
    else:
        gross = solve_gross_from_net(input.amount, config, input.apply_deduction)
    
    result = calculate_taxes(gross, config, input.apply_deduction)
    return {
        "gross": result['gross'], "net": result['net'],
        "opv": result['opv'], "vosms": result['vosms'], "ipn": result['ipn'],
        "osms": result['osms'], "so": result['so'], "sn": result['sn'],
        "opvr": result['opvr'], "deduction_applied": result['deduction']
    }
