from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime
from database.database import get_db
from database.models import Scenario, PlanningPosition, SalaryConfiguration, User, AuditLog
from routers.auth import get_current_active_user
from services.salary_service import calculate_taxes, solve_gross_from_net, sync_employee_financials
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])

# --- Schemas ---

class ScenarioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    
class MassUpdateInput(BaseModel):
    target_branch_id: Optional[int] = None
    target_department_id: Optional[int] = None
    position_filter: Optional[str] = None
    
    field: str # 'base_net', 'base_gross', etc.
    change_type: str # 'percent', 'fixed_add', 'fixed_set'
    value: float

# --- Endpoints ---

@router.get("/")
def list_scenarios(db: Session = Depends(get_db)):
    return db.query(Scenario).filter(Scenario.status != 'archived').all()

@router.post("/")
def create_scenario(
    input: ScenarioCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # 1. Create Scenario Record
    scenario = Scenario(
        name=input.name,
        description=input.description,
        status="draft",
        created_at=datetime.now().isoformat()
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    
    # 2. Clone Live Budget
    live_positions = db.query(PlanningPosition).filter(PlanningPosition.scenario_id == None).all()
    
    cloned_count = 0
    for pos in live_positions:
        new_pos = PlanningPosition(
            scenario_id=scenario.id,
            position_title=pos.position_title,
            branch_id=pos.branch_id,
            department_id=pos.department_id,
            schedule=pos.schedule,
            count=pos.count,
            base_net=pos.base_net,
            base_gross=pos.base_gross,
            kpi_net=pos.kpi_net,
            kpi_gross=pos.kpi_gross,
            bonus_net=pos.bonus_net,
            bonus_gross=pos.bonus_gross
        )
        db.add(new_pos)
        cloned_count += 1
        
    db.commit()
    return {"id": scenario.id, "cloned_positions": cloned_count}

@router.delete("/{id}")
def delete_scenario(
    id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    scenario = db.get(Scenario, id)
    if not scenario: raise HTTPException(404, "Scenario not found")
    
    db.delete(scenario) # Cascades to planning_positions due to model settings 'delete-orphan' assumption or DB FK? 
    # SQLAlchemy relationship says cascade="all, delete-orphan", so it should handle it.
    db.commit()
    return {"status": "deleted"}

@router.get("/{id}/comparison")
def compare_scenario(id: int, db: Session = Depends(get_db)):
    """
    Compare Scenario vs Live
    """
    # Helper to aggregate
    def aggregate(scenario_id):
        return db.query(
            func.sum(PlanningPosition.count).label('headcount'),
            func.sum(
                (PlanningPosition.base_net + PlanningPosition.kpi_net + PlanningPosition.bonus_net) * PlanningPosition.count
            ).label('total_net'),
            func.sum(
                (PlanningPosition.base_gross + PlanningPosition.kpi_gross + PlanningPosition.bonus_gross) * PlanningPosition.count
            ).label('total_gross')
        ).filter(PlanningPosition.scenario_id == scenario_id).first()

    live_agg = aggregate(None)
    scenario_agg = aggregate(id)
    
    # Detailed tax calculation for totals?
    # Simple Estimate: Total Gross - Total Net = Taxes (roughly)
    # For accurate taxes, we'd need to sum calculated taxes per line.
    
    # Let's do a smarter aggregation for taxes using Python for accuracy (piecewise logic hard in SQL without stored procs)
    def calc_detailed(scenario_id):
        rows = db.query(PlanningPosition).filter(PlanningPosition.scenario_id == scenario_id).all()
        config = db.query(SalaryConfiguration).first()
        
        total_taxes = 0
        total_net = 0
        total_gross = 0
        
        for r in rows:
            # We assume stored Gross is correct. 
            # Total Cost for Company = Gross + Employer Taxes
            # Taxes = (Gross - Net) [Employee Side] + Employer Side
            
            # Recalc line tax to be sure?
            line_gross = r.base_gross + r.kpi_gross + r.bonus_gross
            line_net = r.base_net + r.kpi_net + r.bonus_net
            
            # Rough employer tax calc
            res = calculate_taxes(line_gross, config)
            employer_taxes = res['osms'] + res['so'] + res['sn'] + res['opvr']
            
            line_total_cost = line_gross + employer_taxes
            
            total_net += line_net * r.count
            total_gross += line_gross * r.count
            total_taxes += (line_total_cost - line_net) * r.count
            
        return {
            "total_net": total_net,
            "total_gross": total_gross,
            "total_taxes": total_taxes,
            "total_budget": total_net + total_taxes
        }
        
    stats_live = calc_detailed(None)
    stats_scenario = calc_detailed(id)
    
    return {
        "live": stats_live,
        "scenario": stats_scenario,
        "delta": {
            "net": stats_scenario["total_net"] - stats_live["total_net"],
            "budget": stats_scenario["total_budget"] - stats_live["total_budget"],
            "percent": ((stats_scenario["total_budget"] - stats_live["total_budget"]) / stats_live["total_budget"] * 100) if stats_live["total_budget"] else 0
        }
    }

@router.post("/{id}/apply-change")
def mass_update_scenario(
    id: int, 
    input: MassUpdateInput, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Mass update rows in a scenario.
    Example: Increase base_net by 10% for Department X.
    """
    scenario = db.get(Scenario, id)
    if not scenario: raise HTTPException(404, "Scenario not found")
    
    query = db.query(PlanningPosition).filter(PlanningPosition.scenario_id == id)
    
    if input.target_branch_id:
        query = query.filter(PlanningPosition.branch_id == input.target_branch_id)
        
    if input.target_department_id:
        query = query.filter(PlanningPosition.department_id == input.target_department_id)
        
    if input.position_filter:
        query = query.filter(PlanningPosition.position_title.ilike(f"%{input.position_filter}%"))
        
    positions = query.all()
    config = db.query(SalaryConfiguration).first()
    
    updated_count = 0
    
    for pos in positions:
        current_val = getattr(pos, input.field)
        new_val = current_val
        
        if input.change_type == 'percent':
            new_val = current_val * (1 + input.value / 100.0)
        elif input.change_type == 'fixed_add':
            new_val = current_val + input.value
        elif input.change_type == 'fixed_set':
            new_val = input.value
            
        new_val = int(round(new_val))
        
        if new_val != current_val:
            setattr(pos, input.field, new_val)
            
            # Recalculate Logic
            # If we changed NET, solve GROSS. If GROSS, solve NET.
            # Assuming standard fields: base, kpi, bonus
            
            prefix = input.field.split('_')[0] # base, kpi, bonus
            suffix = input.field.split('_')[1] # net, gross
            
            other_suffix = 'gross' if suffix == 'net' else 'net'
            other_field = f"{prefix}_{other_suffix}"
            
            if suffix == 'net':
                # Recalc Gross
                new_gross = solve_gross_from_net(new_val, config)
                setattr(pos, other_field, int(round(new_gross)))
            else:
                # Recalc Net
                res = calculate_taxes(new_val, config)
                setattr(pos, other_field, int(round(res['net'])))
                
            updated_count += 1
            
    db.commit()
    return {"updated": updated_count}

@router.post("/{id}/commit")
def commit_scenario(
    id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Apply Scenario to Live Budget.
    1. Backup Live to 'Archived {Date}'
    2. Move Scenario rows to Live
    3. Sync with Employees
    """
    scenario = db.get(Scenario, id)
    if not scenario: raise HTTPException(404, "Scenario not found")
    
    # 1. Backup Live
    backup_name = f"Backup {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    backup_scenario = Scenario(name=backup_name, status="archived", description="Auto-backup before commit")
    db.add(backup_scenario)
    db.flush()
    
    # Move current Live rows to Backup
    db.query(PlanningPosition).filter(PlanningPosition.scenario_id == None).update(
        {PlanningPosition.scenario_id: backup_scenario.id}, 
        synchronize_session=False
    )
    
    # 2. Promote Scenario rows to Live
    # We clone them to Live (keeping the scenario record intact as history? or moving them?)
    # "Commit" usually implies the scenario IS now the live version.
    # Let's clone so the Scenario record remains as a snapshot of what was approved.
    
    scenario_rows = db.query(PlanningPosition).filter(PlanningPosition.scenario_id == id).all()
    
    sync_total = 0
    now_ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    
    for row in scenario_rows:
        new_live = PlanningPosition(
            scenario_id=None, # Live
            position_title=row.position_title,
            branch_id=row.branch_id,
            department_id=row.department_id,
            schedule=row.schedule,
            count=row.count,
            base_net=row.base_net,
            base_gross=row.base_gross,
            kpi_net=row.kpi_net,
            kpi_gross=row.kpi_gross,
            bonus_net=row.bonus_net,
            bonus_gross=row.bonus_gross
        )
        db.add(new_live)
        db.flush() # get ID
        
        # 3. Sync with Employees
        # We treat this as a change from "Previous Live" to "New Live".
        # Since we don't track 1:1 map easily, we just ensure Employee matches this new Plan.
        # But wait, sync_employee_financials is designed to apply a CHANGE delta.
        # Here we have a whole new state.
        # Logic: For this position, find employees. Update their financials to match this plan.
        # This acts as an enforcement of the new plan.
        
        changes_dummy = {
            'base_net': row.base_net, 'base_gross': row.base_gross,
            'kpi_net': row.kpi_net, 'kpi_gross': row.kpi_gross,
            'bonus_net': row.bonus_net, 'bonus_gross': row.bonus_gross
        }
        
        sync_count = sync_employee_financials(db, new_live, changes_dummy, current_user, now_ts)
        sync_total += sync_count
        
    scenario.status = "committed"
    db.commit()
    
    return {"status": "committed", "backup_id": backup_scenario.id, "synced_employees": sync_total}
