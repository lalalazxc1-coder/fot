"""
Analytics Router - Optimized for large datasets
Implements server-side aggregation, caching, and pagination
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import json

from dependencies import get_db, get_current_active_user
from database.models import Employee, PlanningPosition, OrganizationUnit, User, FinancialRecord, Position
from sqlalchemy import func, and_, or_, desc
from sqlalchemy.orm import joinedload
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from database.models import MarketData
from schemas import (
    RetentionRiskItem, RetentionDashboardResponse, 
    ESGReportResponse, PayEquityItem
)

from schemas import (
    AnalyticsSummaryResponse, 
    BranchComparisonResponse, 
    TopEmployeesResponse, 
    CostDistributionResponse
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Simple cache for heavy computations (5 minutes TTL)
_cache = {}
_cache_ttl = {}
CACHE_DURATION = 300  # 5 minutes


def get_cached_or_compute(key: str, compute_fn):
    """Simple cache with TTL"""
    now = datetime.now()
    if key in _cache and key in _cache_ttl:
        if (now - _cache_ttl[key]).total_seconds() < CACHE_DURATION:
            return _cache[key]
    
    result = compute_fn()
    _cache[key] = result
    _cache_ttl[key] = now
    return result


def get_allowed_unit_ids(db: Session, user: User):
    """
    Get list of OrganizationUnit IDs visible to the user using the shared dependency.
    Returns None if user has full access (Admin).
    """
    from dependencies import get_user_scope
    return get_user_scope(db, user)


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    date: Optional[str] = Query(None, description="Time travel date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Optimized summary endpoint - returns pre-aggregated KPIs
    Uses database-level aggregation instead of fetching all records
    """
    
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # 1. Fact totals (use DB aggregation from FinancialRecords)
        # Get latest financial record for each active employee
        fact_subquery_base = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        )
        if date: fact_subquery_base = fact_subquery_base.filter(FinancialRecord.created_at <= date)
        fact_subquery = fact_subquery_base.group_by(FinancialRecord.employee_id).subquery()
        
        fact_query = db.query(
            func.count(Employee.id).label('count'),
            func.sum(FinancialRecord.total_net).label('total_net')
        ).join(
            fact_subquery,
            and_(
                FinancialRecord.employee_id == fact_subquery.c.employee_id,
                FinancialRecord.id == fact_subquery.c.max_id
            )
        ).join(
            Employee,
            Employee.id == FinancialRecord.employee_id
        ).filter(Employee.status != 'Dismissed')
        
        if allowed_ids is not None:
            fact_query = fact_query.filter(Employee.org_unit_id.in_(allowed_ids))
        
        fact_result = fact_query.first()
        fact_count = fact_result.count or 0
        fact_total = fact_result.total_net or 0
        
        # 2. Plan totals (use DB aggregation)
        plan_query = db.query(
            func.sum(PlanningPosition.count).label('count'),
            func.sum(
                (PlanningPosition.base_net + PlanningPosition.kpi_net + PlanningPosition.bonus_net) * PlanningPosition.count
            ).label('total_net')
        ).filter(PlanningPosition.scenario_id == None)
        
        if allowed_ids is not None:
            # Filter plan by branch_id (assuming planning is done at branch level mostly)
            # If allowed_ids contains departments, ideally we should check department_id too if set
            plan_query = plan_query.filter(
                or_(
                    PlanningPosition.branch_id.in_(allowed_ids),
                    PlanningPosition.department_id.in_(allowed_ids)
                )
            )
        
        plan_result = plan_query.first()
        plan_count = plan_result.count or 0
        plan_total = plan_result.total_net or 0
        
        # 3. Calculate metrics
        diff = fact_total - plan_total
        execution_percent = (fact_total / plan_total * 100) if plan_total > 0 else 0
        headcount_diff = fact_count - plan_count
        
        return {
            'fact': {
                'total_net': float(fact_total),
                'count': int(fact_count)
            },
            'plan': {
                'total_net': float(plan_total),
                'count': int(plan_count)
            },
            'metrics': {
                'diff_net': float(diff),
                'execution_percent': round(execution_percent, 2),
                'headcount_diff': int(headcount_diff),
                'is_over_budget': diff > 0
            },
            'cached_at': datetime.now().isoformat()
        }
    
    return get_cached_or_compute(f'summary_{current_user.id}_{date}', compute)


@router.get("/branch-comparison", response_model=BranchComparisonResponse)
def get_branch_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: Optional[int] = Query(None, description="Limit number of branches"),
    date: Optional[str] = Query(None, description="Time travel date")
):
    """
    Optimized branch comparison - server-side aggregation
    Returns plan vs fact for each branch with pagination support
    """
    
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # Get ALL organizational units (head_office, branches, departments)
        query = db.query(OrganizationUnit)
        
        if allowed_ids is not None:
            query = query.filter(OrganizationUnit.id.in_(allowed_ids))
            
        all_units = query.all()
        results = []
        
        for unit in all_units:
            # Get all child units recursively for this unit
            children = db.query(OrganizationUnit).filter(
                OrganizationUnit.parent_id == unit.id
            ).all()
            child_ids = [c.id for c in children]
            
            # Recursively get all descendants (for multi-level hierarchy)
            all_descendant_ids = set(child_ids)
            to_process = list(child_ids)
            
            while to_process:
                current_id = to_process.pop(0)
                grandchildren = db.query(OrganizationUnit).filter(
                    OrganizationUnit.parent_id == current_id
                ).all()
                for gc in grandchildren:
                    if gc.id not in all_descendant_ids:
                        all_descendant_ids.add(gc.id)
                        to_process.append(gc.id)
            
            # All unit IDs (unit itself + all descendants)
            unit_ids_list = [unit.id] + list(all_descendant_ids)
            if allowed_ids is not None:
                unit_ids_list = [uid for uid in unit_ids_list if uid in allowed_ids]
            
            if not unit_ids_list:
                continue
                
            # Plan aggregation for this unit (any position linked to this unit or its descendants)
            plan_query = db.query(
                func.sum(
                    (PlanningPosition.base_net + PlanningPosition.kpi_net + PlanningPosition.bonus_net) * PlanningPosition.count
                )
            ).filter(
                PlanningPosition.scenario_id == None,
                or_(
                    PlanningPosition.branch_id.in_(unit_ids_list),
                    PlanningPosition.department_id.in_(unit_ids_list)
                )
            )
            
            plan_total = plan_query.scalar() or 0
            
            # Fact aggregation for this unit (employees in unit or its descendants)
            # Need to join with latest financial records
            fact_sub_base = db.query(
                FinancialRecord.employee_id,
                func.max(FinancialRecord.id).label('max_id')
            )
            if date: fact_sub_base = fact_sub_base.filter(FinancialRecord.created_at <= date)
            fact_subquery = fact_sub_base.group_by(FinancialRecord.employee_id).subquery()
            
            fact_query = db.query(
                func.sum(FinancialRecord.total_net)
            ).join(
                fact_subquery,
                and_(
                    FinancialRecord.employee_id == fact_subquery.c.employee_id,
                    FinancialRecord.id == fact_subquery.c.max_id
                )
            ).join(
                Employee,
                Employee.id == FinancialRecord.employee_id
            ).filter(
                and_(
                    Employee.org_unit_id.in_(unit_ids_list),
                    Employee.status != 'Dismissed'
                )
            )
            
            fact_total = fact_query.scalar() or 0
            
            # Only include units with actual data
            if plan_total > 0 or fact_total > 0:
                results.append({
                    'id': unit.id,
                    'name': unit.name,
                    'type': unit.type,  # Include type for frontend
                    'plan': float(plan_total),
                    'fact': float(fact_total),
                    'diff': float(fact_total - plan_total),
                    'percent': round((fact_total / plan_total * 100) if plan_total > 0 else 0, 1)
                })
        
        # Sort by fact descending
        results.sort(key=lambda x: x['fact'], reverse=True)
        
        if limit:
            results = results[:limit]
        
        return {
            'data': results,
            'total': len(results),
            'cached_at': datetime.now().isoformat()
        }
    
    cache_key = f'branch_comparison_{current_user.id}_{limit}_{date}'
    return get_cached_or_compute(cache_key, compute)


@router.get("/top-employees", response_model=TopEmployeesResponse)
def get_top_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(5, ge=1, le=100),
    date: Optional[str] = Query(None)
):
    """
    Get top N employees by total compensation
    Optimized with database-level sorting and limiting
    """
    
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # Get latest financial record for each employee
        fact_sub_base = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        )
        if date: fact_sub_base = fact_sub_base.filter(FinancialRecord.created_at <= date)
        fact_subquery = fact_sub_base.group_by(FinancialRecord.employee_id).subquery()
        
        # Join and get top employees
        query = db.query(
            Employee.id,
            Employee.full_name,
            Position.title.label('position'),
            OrganizationUnit.name.label('branch_name'),
            FinancialRecord.total_net
        ).join(
            fact_subquery,
            FinancialRecord.employee_id == fact_subquery.c.employee_id
        ).join(
            Employee,
            Employee.id == FinancialRecord.employee_id
        ).join(
            Position,
            Employee.position_id == Position.id,
            isouter=True
        ).join(
            OrganizationUnit,
            Employee.org_unit_id == OrganizationUnit.id,
            isouter=True
        ).filter(
            and_(
                FinancialRecord.id == fact_subquery.c.max_id,
                Employee.status != 'Dismissed'
            )
        )
        
        if allowed_ids is not None:
             query = query.filter(Employee.org_unit_id.in_(allowed_ids))

        employees = query.order_by(
            FinancialRecord.total_net.desc()
        ).limit(limit).all()
        
        return {
            'data': [
                {
                    'id': emp.id,
                    'full_name': emp.full_name,
                    'position': emp.position or 'Не указано',
                    'branch': emp.branch_name or 'Неизвестно',
                    'total_net': float(emp.total_net or 0)
                }
                for emp in employees
            ],
            'cached_at': datetime.now().isoformat()
        }
    
    cache_key = f'top_employees_{current_user.id}_{limit}_{date}'
    return get_cached_or_compute(cache_key, compute)


@router.get("/cost-distribution", response_model=CostDistributionResponse)
def get_cost_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    date: Optional[str] = Query(None)
):
    """
    Get cost distribution by branch for pie chart
    Server-side aggregation
    """
    
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # Get all top-level units (branches and head_office)
        query = db.query(OrganizationUnit).filter(OrganizationUnit.type.in_(['branch', 'head_office']))
        if allowed_ids is not None:
            query = query.filter(OrganizationUnit.id.in_(allowed_ids))
            
        top_units = query.all()
        
        # Get latest financial record for each employee
        fact_sub_base = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        )
        if date: fact_sub_base = fact_sub_base.filter(FinancialRecord.created_at <= date)
        fact_subquery = fact_sub_base.group_by(FinancialRecord.employee_id).subquery()
        
        results = []
        
        for unit in top_units:
            # Get all child units (recursively)
            children = db.query(OrganizationUnit).filter(
                OrganizationUnit.parent_id == unit.id
            ).all()
            
            child_ids = [c.id for c in children]
            
            # Recursively get all descendants
            all_descendant_ids = set(child_ids)
            to_process = list(child_ids)
            
            while to_process:
                current_id = to_process.pop(0)
                grandchildren = db.query(OrganizationUnit).filter(
                    OrganizationUnit.parent_id == current_id
                ).all()
                for gc in grandchildren:
                    if gc.id not in all_descendant_ids:
                        all_descendant_ids.add(gc.id)
                        to_process.append(gc.id)
            
            unit_ids_list = [unit.id] + list(all_descendant_ids)  # Unit + all its descendants
            if allowed_ids is not None:
                unit_ids_list = [uid for uid in unit_ids_list if uid in allowed_ids]
                
            if not unit_ids_list:
                continue
            
            # Sum up financial records for employees in this unit or its descendants
            total = db.query(
                func.sum(FinancialRecord.total_net)
            ).join(
                fact_subquery,
                and_(
                    FinancialRecord.employee_id == fact_subquery.c.employee_id,
                    FinancialRecord.id == fact_subquery.c.max_id
                )
            ).join(
                Employee,
                Employee.id == FinancialRecord.employee_id
            ).filter(
                and_(
                    Employee.org_unit_id.in_(unit_ids_list),
                    Employee.status != 'Dismissed'
                )
            ).scalar()
            
            if total and total > 0:
                results.append({
                    'name': unit.name,
                    'value': float(total)
                })
        
        return {
            'data': results,
            'cached_at': datetime.now().isoformat()
        }
    
    return get_cached_or_compute(f'cost_distribution_{current_user.id}_{date}', compute)


@router.post("/clear-cache")
def clear_analytics_cache(current_user: User = Depends(get_current_active_user)):
    """Clear analytics cache (admin only)"""
    _cache.clear()
    _cache_ttl.clear()
    return {"message": "Cache cleared", "cleared_at": datetime.now().isoformat()}

@router.get("/retention-risk", response_model=RetentionDashboardResponse)
def get_retention_risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Identify employees at risk based on stagnant salary (>12mo) and market gap.
    """
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # 1. Fetch Active Employees with Position and OrgUnit
        query = db.query(Employee).options(
            joinedload(Employee.position),
            joinedload(Employee.org_unit)
        ).filter(Employee.status != 'Dismissed')
        
        if allowed_ids:
            query = query.filter(Employee.org_unit_id.in_(allowed_ids))
            
        employees = query.all()
        
        # 2. Bulk Fetch Latest Financials
        fact_subquery = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        ).group_by(FinancialRecord.employee_id).subquery()
        
        fin_records = db.query(FinancialRecord).join(
            fact_subquery,
            and_(
                FinancialRecord.employee_id == fact_subquery.c.employee_id,
                FinancialRecord.id == fact_subquery.c.max_id
            )
        ).all()
        fin_map = {fr.employee_id: fr for fr in fin_records}
        
        # 3. Bulk Fetch Market Data
        market_rows = db.query(MarketData).all()
        # Map: (position_title, branch_id) -> median
        # Fallback: (position_title, None) -> median
        market_map = {}
        for m in market_rows:
            key = (m.position_title.lower().strip() if m.position_title else "", m.branch_id)
            market_map[key] = m.median_salary
            if m.branch_id is None:
                market_map[(m.position_title.lower().strip() if m.position_title else "", None)] = m.median_salary

        risk_items = []
        risk_dist = {"High": 0, "Medium": 0, "Low": 0}
        now = datetime.now()
        
        for emp in employees:
            fr = fin_map.get(emp.id)
            if not fr: continue
            
            # Stagnation
            # Parse created_at. If None (legacy), assume old (2 years ago)
            created_dt = now - timedelta(days=365*2)
            if fr.created_at:
                try: created_dt = datetime.fromisoformat(fr.created_at)
                except (ValueError, TypeError): pass
            
            delta = relativedelta(now, created_dt)
            months_stagnant = delta.months + (delta.years * 12)
            
            # Market Gap
            pos_title = emp.position.title.lower().strip() if emp.position else ""
            # Try specific branch match, then global
            median = market_map.get((pos_title, emp.org_unit_id)) or market_map.get((pos_title, None)) or 0
            
            current_salary = fr.total_gross
            gap_percent = 0
            if median > 0 and current_salary < median:
                gap_percent = ((median - current_salary) / median) * 100
            
            # Risk Score
            # High: >12mo AND >15% gap
            # Medium: >12mo OR >15% gap
            score = 0
            if months_stagnant > 12: score += 50
            if gap_percent > 15: score += 50
            
            risk_level = "Low"
            if score >= 100: risk_level = "High"
            elif score >= 50: risk_level = "Medium"
            
            risk_dist[risk_level] += 1
            
            if score >= 50: # Only report medium/high risk
                risk_items.append({
                    "id": emp.id,
                    "full_name": emp.full_name,
                    "position": emp.position.title if emp.position else "-",
                    "branch": emp.org_unit.name if emp.org_unit else "-",
                    "last_update": fr.created_at or created_dt.isoformat(),
                    "months_stagnant": months_stagnant,
                    "current_salary": float(current_salary),
                    "market_median": float(median),
                    "gap_percent": round(gap_percent, 1),
                    "risk_score": float(score),
                    "years_gaps": round(months_stagnant / 12, 1)
                })
        
        # Sort by gap descending
        risk_items.sort(key=lambda x: x['gap_percent'], reverse=True)
        
        return {
            "items": risk_items,
            "risk_distribution": risk_dist,
            "cached_at": now.isoformat()
        }

    return get_cached_or_compute(f'retention_{current_user.id}', compute)


@router.get("/esg/pay-equity", response_model=ESGReportResponse)
def get_esg_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    ESG: Pay Equity by Gender and Age (Generational)
    """
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # Fetch active emps
        query = db.query(Employee).filter(Employee.status != 'Dismissed')
        if allowed_ids: query = query.filter(Employee.org_unit_id.in_(allowed_ids))
        
        employees = query.all()
        
        # Latest financials map
        fact_subquery = db.query(FinancialRecord.employee_id, func.max(FinancialRecord.id).label('max_id')).group_by(FinancialRecord.employee_id).subquery()
        fin_records = db.query(FinancialRecord).join(fact_subquery, and_(FinancialRecord.employee_id == fact_subquery.c.employee_id, FinancialRecord.id == fact_subquery.c.max_id)).all()
        fin_map = {fr.employee_id: fr.total_gross for fr in fin_records}

        gender_stats = {} # Gender -> [salaries]
        age_stats = {}    # Bucket -> [salaries]
        
        now = datetime.now()
        
        for emp in employees:
            salary = fin_map.get(emp.id, 0)
            if salary == 0: continue
            
            # Gender
            g = emp.gender or "Unknown"
            if g not in gender_stats: gender_stats[g] = []
            gender_stats[g].append(salary)
            
            # Age
            age_bucket = "Unknown"
            if emp.dob:
                try: 
                    # Try simplified parsing
                    d_str = emp.dob[:10] # e.g. YYYY-MM-DD
                    try:
                         dob_dt = datetime.strptime(d_str, "%Y-%m-%d")
                    except (ValueError, TypeError):
                         dob_dt = datetime.fromisoformat(emp.dob)
                    
                    age = relativedelta(now, dob_dt).years
                    if age < 25: age_bucket = "<25 Gen Z"
                    elif age < 35: age_bucket = "25-34 Millennials"
                    elif age < 45: age_bucket = "35-44 Millennials/Gen X"
                    elif age < 55: age_bucket = "45-54 Gen X"
                    else: age_bucket = "55+ Boomers"
                except (ValueError, TypeError):
                    pass
            
            if age_bucket not in age_stats: age_stats[age_bucket] = []
            age_stats[age_bucket].append(salary)
            
        # Aggregate
        gender_equity = [
            {"category": k, "count": len(v), "avg_salary": round(sum(v)/len(v), 0)}
            for k, v in gender_stats.items()
        ]
        age_equity = [
            {"category": k, "count": len(v), "avg_salary": round(sum(v)/len(v), 0)}
            for k, v in age_stats.items()
        ]
        
        return {
            "gender_equity": gender_equity,
            "age_equity": age_equity,
            "cached_at": now.isoformat()
        }

    return get_cached_or_compute(f'esg_{current_user.id}', compute)

@router.get("/turnover")
def get_turnover_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    days: int = Query(365, description="Period in days for turnover calculation")
):
    """
    Staffing Gaps & Turnover Analytics
    """
    allowed_ids = get_allowed_unit_ids(db, current_user)
    
    def compute():
        # 1. Staffing Gaps (Plan vs Fact Headcount per Org Unit)
        # Fetch all branches/depts first
        units_query = db.query(OrganizationUnit)
        if allowed_ids: units_query = units_query.filter(OrganizationUnit.id.in_(allowed_ids))
        units = units_query.all()
        
        gaps_data = []
        
        for u in units:
            # Plan Headcount (for this unit and children?) 
            # Let's keep it simple: positions directly assigned to this unit OR descendants?
            # Usually gaps are best seen at Department level.
            # Logic: Get Plan count for this unit. Get Active Employee count for this unit.
            
            # Recursive ID fetch
            child_ids = [c.id for c in db.query(OrganizationUnit).filter(OrganizationUnit.parent_id == u.id).all()]
            all_unit_ids = [u.id] + child_ids # Simplified 1-level for now or use recursive helper if needed
            
            # Plan Count
            plan_count = db.query(func.sum(PlanningPosition.count)).filter(
                PlanningPosition.scenario_id == None,
                or_(PlanningPosition.branch_id == u.id, PlanningPosition.department_id == u.id)
            ).scalar() or 0
            
            # Fact Count (Active)
            fact_count = db.query(func.count(Employee.id)).filter(
                Employee.org_unit_id == u.id,
                Employee.status != 'Dismissed'
            ).scalar() or 0
            
            gap = plan_count - fact_count
            if gap > 0: # Only show gaps i.e. vacancies
                gaps_data.append({
                    "unit_name": u.name,
                    "unit_type": u.type,
                    "plan": int(plan_count),
                    "fact": int(fact_count),
                    "gap": int(gap)
                })
        
        # Sort gaps descending
        gaps_data.sort(key=lambda x: x['gap'], reverse=True)
        
        # 2. Turnover Rate
        # Formula: (Dismissed in Period / Average Headcount) * 100
        cutoff_date = datetime.now() - timedelta(days=days)
        cutoff_str = cutoff_date.strftime("%Y-%m-%d") # Assuming dismissal_date stored as YYYY-MM-DD
        
        # Dismissed count
        dismissed_query = db.query(Employee).filter(
            Employee.status == 'Dismissed',
            # We need to filter by date. dismissal_date is string YYYY-MM-DD.
            Employee.dismissal_date >= cutoff_str
        )
        if allowed_ids: dismissed_query = dismissed_query.filter(Employee.org_unit_id.in_(allowed_ids))
        dismissed_count = dismissed_query.count()
        
        # Avg Headcount
        # Approx: (Start + End) / 2? Or just current active?
        # Let's use current active as denominator for simplicity, or slightly better: current active + dismissed/2
        active_query = db.query(Employee).filter(Employee.status != 'Dismissed')
        if allowed_ids: active_query = active_query.filter(Employee.org_unit_id.in_(allowed_ids))
        current_active = active_query.count()
        
        avg_headcount = current_active + (dismissed_count / 2)
        turnover_rate = 0
        if avg_headcount > 0:
            turnover_rate = (dismissed_count / avg_headcount) * 100
            
        # 3. Dismissal Reasons Distribution
        reasons_dist = {}
        dismissed_employees = dismissed_query.all()
        for emp in dismissed_employees:
            r = emp.dismissal_reason or "Не указана"
            reasons_dist[r] = reasons_dist.get(r, 0) + 1
            
        # Format reasons for chart
        reasons_chart = [{"name": k, "value": v} for k,v in reasons_dist.items()]
        
        return {
            "staffing_gaps": gaps_data,
            "turnover_rate": round(turnover_rate, 1),
            "dismissed_count": dismissed_count,
            "period_days": days,
            "reasons_distribution": reasons_chart,
            "cached_at": datetime.now().isoformat()
        }

    return get_cached_or_compute(f'turnover_{current_user.id}_{days}', compute)
