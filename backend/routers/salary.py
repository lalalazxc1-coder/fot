from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, root_validator
import math
from typing import Optional

from dependencies import get_db, require_admin
from database.models import SalaryConfiguration, User, AuditLog, PlanningPosition, Employee, FinancialRecord

router = APIRouter(prefix="/api/salary-config", tags=["salary-config"])

# --- Models ---

class SalaryConfigUpdate(BaseModel):
    mrp: Optional[int] = None
    mzp: Optional[int] = None
    
    opv_rate: Optional[float] = None
    opvr_rate: Optional[float] = None  # NEW
    vosms_rate: Optional[float] = None
    vosms_employer_rate: Optional[float] = None
    so_rate: Optional[float] = None
    sn_rate: Optional[float] = None
    ipn_rate: Optional[float] = None
    
    opv_limit_mzp: Optional[int] = None
    opvr_limit_mzp: Optional[int] = None # NEW
    vosms_limit_mzp: Optional[int] = None
    ipn_deduction_mrp: Optional[int] = None

class SalaryCalculationInput(BaseModel):
    amount: float
    type: str  # 'net' or 'gross'
    year: int = 2024
    
    # Flags
    apply_deduction: bool = True  # Apply 14 MRP deduction (main job)
    pensioner: bool = False       # No OPV, etc. (Not implemented fully yet)
    
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
    opvr: float # NEW
    
    # Details
    deduction_applied: float
    
# --- Helpers ---

from services.salary_service import calculate_taxes, solve_gross_from_net

def get_or_create_config(db: Session) -> SalaryConfiguration:
    config = db.query(SalaryConfiguration).first()
    if not config:
        # Defaults for 2026
        config = SalaryConfiguration(
            mrp=4325,
            mzp=85000,
            opv_rate=0.1,
            opvr_rate=0.025, # 2026 rate
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

# --- Endpoints ---

@router.get("/")
def get_config(db: Session = Depends(get_db)):
    """Get current salary configuration"""
    return get_or_create_config(db)

@router.post("/")
def update_config(
    update: SalaryConfigUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin)
):
    """Update salary configuration (Admin only)"""
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
        
        # Log
        db.add(AuditLog(
            user_id=current_user.id,
            target_entity="salary_config",
            target_entity_id=config.id,
            timestamp=datetime.now().isoformat(),
            old_values={k: v['old'] for k,v in changes.items()},
            new_values={k: v['new'] for k,v in changes.items()}
        ))
        
        # --- RECALCULATION ROUTINE ---
        # 1. Update Planning Positions ("FOT" Page)
        # We assume NET is the master value (Employee agreement). Recalculate GROSS.
        planning_rows = db.query(PlanningPosition).all()
        for row in planning_rows:
            old_gross = row.base_gross + row.kpi_gross + row.bonus_gross
            
            # Base
            row.base_gross = int(round(solve_gross_from_net(row.base_net, config)))
            
            # KPI
            row.kpi_gross = int(round(solve_gross_from_net(row.kpi_net, config)))
            
            # Bonus
            row.bonus_gross = int(round(solve_gross_from_net(row.bonus_net, config)))
            
            new_gross = row.base_gross + row.kpi_gross + row.bonus_gross
            
            if abs(old_gross - new_gross) > 1:
                db.add(AuditLog(
                    user_id=current_user.id,
                    target_entity="planning",
                    target_entity_id=row.id,
                    timestamp=datetime.now().strftime("%d.%m.%Y %H:%M"),
                    old_values={"Total Gross": int(old_gross)},
                    new_values={"Total Gross": int(new_gross), "Note": "Авто-пересчет Gross (смена настроек)"}
                ))
            
        # 2. Update Employees ("Employees" Page - Financial Records)
        # Update LATEST record for each active employee
        employees = db.query(Employee).filter(Employee.status != "Dismissed").all()
        for emp in employees:
            # Get latest financial record
            fin = db.query(FinancialRecord).filter_by(employee_id=emp.id).order_by(FinancialRecord.id.desc()).first()
            if fin:
                old_total_gross = fin.total_gross
                
                # Base
                fin.base_gross = int(round(solve_gross_from_net(fin.base_net, config)))
                
                # KPI
                fin.kpi_gross = int(round(solve_gross_from_net(fin.kpi_net, config)))
                
                # Bonus
                fin.bonus_gross = int(round(solve_gross_from_net(fin.bonus_net, config)))
                
                # Update Totals
                # fin.total_net remains the same (conceptually)
                fin.total_gross = fin.base_gross + fin.kpi_gross + fin.bonus_gross
                
                # Legacy Sync (gross might update)
                fin.salary_gross = fin.total_gross # if legacy used this
                
                if abs(old_total_gross - fin.total_gross) > 1:
                    db.add(AuditLog(
                        user_id=current_user.id,
                        target_entity="employee",
                        target_entity_id=emp.id,
                        timestamp=datetime.now().strftime("%d.%m.%Y %H:%M"),
                        old_values={"Total Gross": int(old_total_gross)},
                        new_values={"Total Gross": int(fin.total_gross), "Note": "Авто-пересчет Gross (смена настроек)"}
                    ))

        db.commit()
        
    return config

@router.get("/history")
def get_config_history(db: Session = Depends(get_db)):
    """Get history of salary configuration changes"""
    logs = db.query(AuditLog).filter(AuditLog.target_entity == "salary_config").order_by(AuditLog.timestamp.desc()).limit(50).all()
    
    result = []
    for log in logs:
        user_name = "Unknown"
        # Access relationship if it works, else fallback. Try/Except to avoid crashes if model not reloaded cleanly in dev
        try:
            if log.user:
                user_name = log.user.full_name or log.user.email
        except:
            pass
            
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
    """
    Calculate salary breakdown.
    Can convert Net -> Gross or Gross -> Net.
    """
    config = get_or_create_config(db)
    
    gross = 0.0
    
    if input.type.lower() == 'gross':
        gross = input.amount
    else:
        # Net -> Gross
        gross = solve_gross_from_net(input.amount, config, input.apply_deduction)
        
    result = calculate_taxes(gross, config, input.apply_deduction)
    
    return {
        "gross": result['gross'],
        "net": result['net'],
        "opv": result['opv'],
        "vosms": result['vosms'],
        "ipn": result['ipn'],
        "osms": result['osms'],
        "so": result['so'],
        "sn": result['sn'],
        "opvr": result['opvr'],
        "deduction_applied": result['deduction']
    }
