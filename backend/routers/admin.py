from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.database import get_db
from sqlalchemy.sql import func, desc
from datetime import datetime
from database.models import Employee, User, OrganizationUnit, FinancialRecord, SalaryRequest, AuditLog, Role
from dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    # 1. System Counts
    total_employees = db.query(Employee).count()
    total_users = db.query(User).count()
    total_branches = db.query(OrganizationUnit).filter_by(type="branch").count()
    pending_requests = db.query(SalaryRequest).filter(SalaryRequest.status == "pending").count()
    
    # 2. Financial Overview (Quick snapshot)
    # Use optimized query from analytics or simple aggregation here
    # Total Active Employees Budget
    budget_query = db.query(func.sum(FinancialRecord.total_net)).join(Employee).filter(
        Employee.status != 'Dismissed',
        FinancialRecord.id == db.query(func.max(FinancialRecord.id)).group_by(FinancialRecord.employee_id).scalar_subquery()
    )
    total_budget = budget_query.scalar() or 0
    avg_salary = total_budget / total_employees if total_employees > 0 else 0

    # 3. Recent Activity (Audit Logs)
    # Get last 10 actions
    logs = db.query(AuditLog).order_by(desc(AuditLog.id)).limit(10).all()
    
    # Pre-fetch users for logs
    user_ids = {l.user_id for l in logs}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u.full_name for u in users}

    entity_map = {
        'employee': 'Сотрудник',
        'planning': 'План',
        'auth': 'Система',
        'users': 'Пользователь',
        'org_unit': 'Структура',
        'salary_request': 'Заявка'
    }

    activity_log = []
    for log in logs:
        # Format a readable message
        nv = log.new_values or {}
        msg = "Действие"
        
        if log.target_entity == 'auth':
             msg = nv.get('event') or 'Авторизация'
        elif 'created' in nv:
             msg = nv['created']
        elif 'Событие' in nv:
             msg = nv['Событие']
        elif nv:
             # Get first few keys
             keys = [k for k in nv.keys() if k not in ['id', 'updated_at', 'created_at']]
             if keys:
                 msg = f"Изменено: {', '.join(keys[:3])}" + ("..." if len(keys) > 3 else "")
             else:
                 msg = "Обновление данных"
        else:
             msg = log.target_entity or "Действие"

        # Readable Entity
        entity_name = entity_map.get(log.target_entity, log.target_entity.upper() if log.target_entity else "N/A")
        
        activity_log.append({
            "id": log.id,
            "user": user_map.get(log.user_id, "Unknown"),
            "action": msg,
            "entity": entity_name,
            "time": log.timestamp
        })

    # 4. Chart: Requests Trend (Last 6 months)
    # Group by created_at (simplified string parsing or just recent count types)
    # For MVP, let's just group by Status distribution
    req_stats = db.query(
        SalaryRequest.status, func.count(SalaryRequest.id)
    ).group_by(SalaryRequest.status).all()
    
    req_chart = {
        "labels": ["Ожидает", "Согласовано", "Отклонено"],
        "data": [0, 0, 0]
    }
    
    status_map = {"pending": 0, "approved": 1, "rejected": 2}
    for status, count in req_stats:
        if status in status_map:
            req_chart["data"][status_map[status]] = count

    # 5. User Roles Distribution
    role_stats = db.query(Role.name, func.count(User.id))\
        .join(User, User.role_id == Role.id)\
        .group_by(Role.name).all()
        
    role_chart = {
        "labels": [r[0] for r in role_stats],
        "data": [r[1] for r in role_stats]
    }

    return {
        "counts": {
            "employees": total_employees,
            "users": total_users,
            "branches": total_branches,
            "pending_requests": pending_requests
        },
        "budget": {
            "total": total_budget,
            "avg": avg_salary
        },
        "activity": activity_log,
        "charts": {
            "requests": req_chart,
            "roles": role_chart
        }
    }
