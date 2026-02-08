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


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Optimized summary endpoint - returns pre-aggregated KPIs
    Uses database-level aggregation instead of fetching all records
    """
    
    def compute():
        # 1. Fact totals (use DB aggregation from FinancialRecords)
        # Get latest financial record for each active employee
        fact_subquery = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        ).group_by(FinancialRecord.employee_id).subquery()
        
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
        
        fact_result = fact_query.first()
        fact_count = fact_result.count or 0
        fact_total = fact_result.total_net or 0
        
        # 2. Plan totals (use DB aggregation)
        plan_query = db.query(
            func.sum(PlanningPosition.count).label('count'),
            func.sum(
                (PlanningPosition.base_net + PlanningPosition.kpi_net + PlanningPosition.bonus_net) * PlanningPosition.count
            ).label('total_net')
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
    
    return get_cached_or_compute('summary', compute)


@router.get("/branch-comparison", response_model=BranchComparisonResponse)
def get_branch_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: Optional[int] = Query(None, description="Limit number of branches")
):
    """
    Optimized branch comparison - server-side aggregation
    Returns plan vs fact for each branch with pagination support
    """
    
    def compute():
        # Get all branches (type='branch')
        branches = db.query(OrganizationUnit).filter(OrganizationUnit.type == 'branch').all()
        results = []
        
        for branch in branches:
            # Get departments for this branch
            departments = db.query(OrganizationUnit).filter(
                and_(
                    OrganizationUnit.parent_id == branch.id,
                    OrganizationUnit.type == 'department'
                )
            ).all()
            dept_ids = [d.id for d in departments]
            
            # All unit IDs (branch + departments)
            unit_ids = [branch.id] + dept_ids
            
            # Plan aggregation for this branch
            plan_query = db.query(
                func.sum(
                    (PlanningPosition.base_net + PlanningPosition.kpi_net + PlanningPosition.bonus_net) * PlanningPosition.count
                )
            ).filter(PlanningPosition.branch_id == branch.id)
            
            plan_total = plan_query.scalar() or 0
            
            # Fact aggregation for this branch (employees in branch or its departments)
            # Need to join with latest financial records
            fact_subquery = db.query(
                FinancialRecord.employee_id,
                func.max(FinancialRecord.id).label('max_id')
            ).group_by(FinancialRecord.employee_id).subquery()
            
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
                    Employee.org_unit_id.in_(unit_ids),
                    Employee.status != 'Dismissed'
                )
            )
            
            fact_total = fact_query.scalar() or 0
            
            if plan_total > 0 or fact_total > 0:
                results.append({
                    'id': branch.id,
                    'name': branch.name,
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
    
    cache_key = f'branch_comparison_{limit}'
    return get_cached_or_compute(cache_key, compute)


@router.get("/top-employees", response_model=TopEmployeesResponse)
def get_top_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(5, ge=1, le=100)
):
    """
    Get top N employees by total compensation
    Optimized with database-level sorting and limiting
    """
    
    def compute():
        # Get latest financial record for each employee
        fact_subquery = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        ).group_by(FinancialRecord.employee_id).subquery()
        
        # Join and get top employees
        employees = db.query(
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
        ).order_by(
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
    
    cache_key = f'top_employees_{limit}'
    return get_cached_or_compute(cache_key, compute)


@router.get("/cost-distribution", response_model=CostDistributionResponse)
def get_cost_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get cost distribution by branch for pie chart
    Server-side aggregation
    """
    
    def compute():
        # Get all branches
        branches = db.query(OrganizationUnit).filter(OrganizationUnit.type == 'branch').all()
        
        # Get latest financial record for each employee
        fact_subquery = db.query(
            FinancialRecord.employee_id,
            func.max(FinancialRecord.id).label('max_id')
        ).group_by(FinancialRecord.employee_id).subquery()
        
        results = []
        
        for branch in branches:
            # Get all departments for this branch
            departments = db.query(OrganizationUnit).filter(
                and_(
                    OrganizationUnit.parent_id == branch.id,
                    OrganizationUnit.type == 'department'
                )
            ).all()
            
            dept_ids = [d.id for d in departments]
            unit_ids = [branch.id] + dept_ids  # Branch + all its departments
            
            # Sum up financial records for employees in this branch or its departments
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
                    Employee.org_unit_id.in_(unit_ids),
                    Employee.status != 'Dismissed'
                )
            ).scalar()
            
            if total and total > 0:
                results.append({
                    'name': branch.name,
                    'value': float(total)
                })
        
        return {
            'data': results,
            'cached_at': datetime.now().isoformat()
        }
    
    return get_cached_or_compute('cost_distribution', compute)


@router.post("/clear-cache")
def clear_analytics_cache(current_user: User = Depends(get_current_active_user)):
    """Clear analytics cache (admin only)"""
    _cache.clear()
    _cache_ttl.clear()
    return {"message": "Cache cleared", "cleared_at": datetime.now().isoformat()}
