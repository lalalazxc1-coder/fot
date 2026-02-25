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
    max_ids_query = db.query(func.max(FinancialRecord.id)).group_by(FinancialRecord.employee_id)
    budget_query = db.query(func.sum(FinancialRecord.total_net)).join(Employee).filter(
        Employee.status != 'Dismissed',
        FinancialRecord.id.in_(max_ids_query)
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

@router.get("/logs")
def get_extended_logs(page: int = 1, limit: int = 50, entity: str = None, db: Session = Depends(get_db)):
    offset = (page - 1) * limit
    logs_query = db.query(AuditLog).order_by(desc(AuditLog.id))
    if entity:
        logs_query = logs_query.filter(AuditLog.target_entity == entity)
    total_logs = logs_query.count()
    logs = logs_query.offset(offset).limit(limit).all()

    user_ids = {l.user_id for l in logs}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: (u.full_name or u.email) for u in users}

    entity_map = {
        'employee': 'Сотрудник',
        'planning': 'Планирование',
        'auth': 'Система',
        'users': 'Пользователь',
        'org_unit': 'Структура',
        'salary_request': 'Заявка',
        'salary_config': 'Настройки ФОТ'
    }

    result = []
    for log in logs:
        entity_name = entity_map.get(log.target_entity, log.target_entity.upper() if log.target_entity else "N/A")
        result.append({
            "id": log.id,
            "user": user_map.get(log.user_id, "Система"),
            "entity": entity_name,
            "entity_raw": log.target_entity,
            "target_entity_id": log.target_entity_id,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "timestamp": log.timestamp,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
        })

    return {
        "logs": result,
        "total": total_logs,
        "page": page,
        "limit": limit,
        "total_pages": (total_logs + limit - 1) // limit
    }


def _parse_ua(ua_string: str | None) -> dict:
    """Простой парсинг User-Agent без внешних библиотек."""
    if not ua_string:
        return {"browser": "Неизвестно", "os": "Неизвестно", "device": "Desktop"}
    ua = ua_string.lower()
    # Browser
    if "edg/" in ua or "edge/" in ua:
        browser = "Edge"
    elif "chrome" in ua and "safari" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "opera" in ua or "opr/" in ua:
        browser = "Opera"
    else:
        browser = "Другой"
    # OS
    if "windows" in ua:
        os_name = "Windows"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "mac os" in ua or "macos" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Другое"
    # Device type
    if "mobile" in ua or "android" in ua or "iphone" in ua:
        device = "Mobile"
    elif "tablet" in ua or "ipad" in ua:
        device = "Tablet"
    else:
        device = "Desktop"
    return {"browser": browser, "os": os_name, "device": device}


@router.get("/login-logs")
def get_login_logs(page: int = 1, limit: int = 50, action: str = None, db: Session = Depends(get_db)):
    """История входов/выходов пользователей."""
    from database.models import LoginLog
    offset = (page - 1) * limit
    q = db.query(LoginLog).order_by(desc(LoginLog.id))
    if action:
        q = q.filter(LoginLog.action == action)
    total = q.count()
    logs = q.offset(offset).limit(limit).all()

    user_ids = {l.user_id for l in logs if l.user_id}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: (u.full_name or u.email) for u in users}

    action_labels = {
        "login_success": {"label": "Вход", "color": "green"},
        "login_failed":  {"label": "Неудача", "color": "red"},
        "login_blocked": {"label": "Заблокирован", "color": "orange"},
        "logout":        {"label": "Выход", "color": "slate"},
    }

    result = []
    for log in logs:
        ua_info = _parse_ua(log.user_agent)
        action_info = action_labels.get(log.action, {"label": log.action, "color": "slate"})
        result.append({
            "id": log.id,
            "user": user_map.get(log.user_id, log.user_email or "Неизвестно"),
            "user_email": log.user_email,
            "action": log.action,
            "action_label": action_info["label"],
            "action_color": action_info["color"],
            "ip_address": log.ip_address or "—",
            "browser": ua_info["browser"],
            "os": ua_info["os"],
            "device": ua_info["device"],
            "user_agent_full": log.user_agent,
            "timestamp": log.timestamp,
        })

    return {
        "logs": result,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }
