from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import SalaryRequest, User, Employee
from schemas import SalaryRequestCreate, SalaryRequestUpdate
from dependencies import get_current_active_user, require_admin
from utils.date_utils import now_iso, to_iso_utc, to_utc_datetime

def check_step_condition(step, req_data) -> bool:
    if not step.condition_type:
        return True
    
    if hasattr(req_data, 'requested_value') and hasattr(req_data, 'current_value'):
        # Usually checking the raise/change amount
        diff = (req_data.requested_value or 0) - (req_data.current_value or 0)
        
        if step.condition_type == 'amount_less_than' and step.condition_amount:
            return diff < step.condition_amount
        if step.condition_type == 'amount_greater_than_or_equal' and step.condition_amount:
            return diff >= step.condition_amount
            
    return True

router = APIRouter(prefix="/api/requests", tags=["requests"])


def _is_admin_user(current_user: User) -> bool:
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    return bool((current_user.role_rel and current_user.role_rel.name == "Administrator") or perms.get("admin_access"))

@router.post("")
def create_request(data: SalaryRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    can_create = bool(perms.get("admin_access") or perms.get("manage_planning") or perms.get("manage_requests"))
    if not can_create:
        raise HTTPException(403, "Permission 'manage_planning' required")

    # Check if employee exists
    emp = db.get(Employee, data.employee_id)
    if not emp: raise HTTPException(404, "Employee not found")
    
    # 1. Determine Initial Step
    from database.models import ApprovalStep, RequestHistory, User
    all_steps = db.query(ApprovalStep).order_by(ApprovalStep.step_order.asc()).all()
    
    first_step = None
    for s in all_steps:
        if check_step_condition(s, data):
            first_step = s
            break
    
    current_step_id = first_step.id if first_step else None
    req_created_at = now_iso()
    
    req = SalaryRequest(
        requester_id=current_user.id,
        employee_id=data.employee_id,
        type=data.type,
        current_value=data.current_value,
        requested_value=data.requested_value,
        reason=data.reason,
        status="pending",
        current_step_id=current_step_id,
        created_at=req_created_at,
        created_at_dt=to_utc_datetime(req_created_at)
    )
    db.add(req)
    db.flush()
    
    # 2. Add History Log
    log = RequestHistory(
        request_id=req.id,
        step_id=current_step_id,
        actor_id=current_user.id,
        action="created",
        comment="Created request",
        created_at=req_created_at,
        created_at_dt=to_utc_datetime(req_created_at)
    )
    db.add(log)
    db.commit()
    
    # Notify first step approver
    if first_step:
        if first_step.user_id:
            _notify(db, first_step.user_id, f"Новая заявка на согласование: {emp.full_name}", link="/requests")
        elif first_step.role_id:
            users = db.query(User).filter(User.role_id == first_step.role_id).all()
            for u in users:
                _notify(db, u.id, f"Новая заявка на согласование: {emp.full_name}", link="/requests")
                
    # Also notify ALL OTHER steps that a request is created (Visibility req)
    other_steps = db.query(ApprovalStep).filter(ApprovalStep.id != current_step_id).all()
    for s in other_steps:
         if s.user_id:
            _notify(db, s.user_id, f"Создана новая заявка (Ожидает {first_step.label if first_step else '?'})", link="/requests")
         elif s.role_id:
            users = db.query(User).filter(User.role_id == s.role_id).all()
            for u in users:
                _notify(db, u.id, f"Создана новая заявка (Ожидает {first_step.label if first_step else '?'})", link="/requests")

    db.commit()
    
    return req

@router.get("")
def get_requests(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), status: str = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # FIX #14: Refactored to eliminate N+1 queries using eager loading + pre-fetch maps
    from sqlalchemy.orm import joinedload, selectinload
    from database.models import OrganizationUnit, ApprovalStep, RequestHistory
    from sqlalchemy import or_, and_
    import math

    is_admin = False
    if current_user.role_rel and current_user.role_rel.permissions.get('admin_access'):
        is_admin = True
        
    query = db.query(SalaryRequest)
    
    # Filter logic
    if not is_admin:
        user_role_id = current_user.role_id
        
        history_query = db.query(RequestHistory.request_id).filter(RequestHistory.actor_id == current_user.id).distinct()
        
        query = query.outerjoin(SalaryRequest.current_step).filter(
            or_(
                SalaryRequest.requester_id == current_user.id,
                and_(SalaryRequest.status == 'pending', ApprovalStep.user_id == current_user.id),
                and_(SalaryRequest.status == 'pending', ApprovalStep.role_id == user_role_id, ApprovalStep.user_id == None),
                SalaryRequest.id.in_(history_query)
            )
        )

    # Status Filter
    if status == 'pending':
        query = query.filter(SalaryRequest.status == 'pending')
    elif status == 'history':
        query = query.filter(SalaryRequest.status != 'pending')

    # Count total
    total = query.count()
    
    # Paginate with eager loading (FIX #14: eliminates N+1)
    offset = (page - 1) * size
    requests = (
        query
        .options(
            joinedload(SalaryRequest.employee).joinedload(Employee.position),
            joinedload(SalaryRequest.employee).joinedload(Employee.org_unit).joinedload(OrganizationUnit.parent),
            joinedload(SalaryRequest.requester).joinedload(User.role_rel),
            joinedload(SalaryRequest.current_step),
            selectinload(SalaryRequest.history).joinedload(RequestHistory.actor).joinedload(User.role_rel),
            selectinload(SalaryRequest.history).joinedload(RequestHistory.step),
        )
        .order_by(SalaryRequest.id.desc())
        .offset(offset)
        .limit(size)
        .all()
    )
    
    # Pre-fetch all OrgUnits for scope lookups (replaces db.get() in loop)
    all_units = db.query(OrganizationUnit).all()
    unit_map = {u.id: u for u in all_units}
    
    res = []
    for r in requests:
        # Employee details (all pre-loaded via joinedload)
        emp_details = {
            "name": r.employee.full_name if r.employee else "Unknown",
            "position": r.employee.position.title if r.employee and r.employee.position else "-",
            "branch": "-",
            "department": "-"
        }
        if r.employee and r.employee.org_unit:
            if r.employee.org_unit.type == 'branch':
                emp_details["branch"] = r.employee.org_unit.name
            elif r.employee.org_unit.type == 'department':
                emp_details["department"] = r.employee.org_unit.name
                if r.employee.org_unit.parent:
                    emp_details["branch"] = r.employee.org_unit.parent.name

        # Requester Details (pre-loaded via joinedload)
        req_role = "-"
        req_branch = "-"
        req_dept = "-"
        
        if r.requester:
            if r.requester.role_rel:
                req_role = r.requester.role_rel.name
            
            # Scope lookups via pre-fetched unit_map (O(1) instead of db.get)
            s_br = r.requester.scope_branches or []
            if len(s_br) == 1:
                b_obj = unit_map.get(s_br[0])
                if b_obj: req_branch = b_obj.name
            elif len(s_br) > 1:
                req_branch = f"{len(s_br)} филиалов"
                
            s_dp = r.requester.scope_departments or []
            if len(s_dp) == 1:
                d_obj = unit_map.get(s_dp[0])
                if d_obj: req_dept = d_obj.name
            elif len(s_dp) > 1:
                req_dept = f"{len(s_dp)} отделов"

        req_details = {
            "name": r.requester.full_name if r.requester else "Unknown",
            "position": req_role,
            "branch": req_branch,
            "department": req_dept
        }
        
        # Workflow info (pre-loaded)
        current_step_label = r.current_step.label if r.current_step else "Finished" if r.status != 'pending' else "No Step"
        
        # Check if current user can approve
        can_approve = False
        if r.status == 'pending' and r.current_step:
            step = r.current_step
            if step.user_id == current_user.id:
                can_approve = True
            elif step.role_id == current_user.role_id and step.user_id is None:
                can_approve = True

        # History (pre-loaded via selectinload, actors via joinedload)
        history = []
        for h in sorted(r.history, key=lambda x: x.id, reverse=True):
            actor_role = "-"
            actor_branch = "-"
            if h.actor:
                if h.actor.role_rel: actor_role = h.actor.role_rel.name
                
                s_br = h.actor.scope_branches or []
                if len(s_br) == 1:
                    b_obj = unit_map.get(s_br[0])
                    if b_obj: actor_branch = b_obj.name
                elif len(s_br) > 1:
                    actor_branch = f"{len(s_br)} филиалов"

            history.append({
                "id": h.id,
                "step_label": h.step.label if h.step else "System",
                "actor_name": h.actor.full_name if h.actor else "Unknown",
                "actor_role": actor_role,
                "actor_branch": actor_branch,
                "action": h.action,
                "comment": h.comment,
                "created_at": to_iso_utc(h.created_at) or h.created_at
            })

        res.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_details": emp_details,
            "requester_details": req_details,
            "type": r.type,
            "current_value": r.current_value,
            "requested_value": r.requested_value,
            "reason": r.reason,
            "status": r.status,
            "created_at": to_iso_utc(r.created_at) or r.created_at,
            "current_step_label": current_step_label,
            "current_step_type": r.current_step.step_type if r.current_step else "approval",
            "is_final": r.current_step.is_final if r.current_step else False,
            "can_approve": can_approve,
            "analytics_context": None,
            "history": history
        })
        
    return {
        "items": res,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": math.ceil(total / size)
    }

@router.patch("/{req_id}/status")
def update_status(req_id: int, data: SalaryRequestUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from database.models import ApprovalStep, RequestHistory, FinancialRecord
    
    req = db.get(SalaryRequest, req_id)
    if not req: raise HTTPException(404, "Request not found")
    
    # 1. Validate permissions
    # If status is changing to 'approved' or 'rejected', it must be a valid step transition
    
    current_step = req.current_step
    
    # Admin override or correct role/user
    is_approver = False
    if current_step:
        if current_step.user_id == current_user.id:
            is_approver = True
        elif current_step.role_id == current_user.role_id and current_step.user_id is None:
            is_approver = True
    
    # Check Admin
    is_admin = _is_admin_user(current_user)
    
    if not is_approver and not is_admin:
        raise HTTPException(403, "You are not the designated approver for this step.")

    # 2. Handle Rejection
    if data.status == 'rejected':
        rejected_at = now_iso()
        req.status = 'rejected'
        req.current_step_id = None # Workflow ends
        
        # Log
        log = RequestHistory(
            request_id=req.id,
            step_id=current_step.id if current_step else None,
            actor_id=current_user.id,
            action="rejected",
            comment=data.comment if data.comment else "Отклонено пользователем",
            created_at=rejected_at,
            created_at_dt=to_utc_datetime(rejected_at)
        )
        db.add(log)
        db.commit()
        return {"status": "rejected"}

    # 3. Handle Approval
    if data.status == 'approved':
        approved_action_at = now_iso()
        # Log approval
        log = RequestHistory(
            request_id=req.id,
            step_id=current_step.id if current_step else None,
            actor_id=current_user.id,
            action="approved",
            comment=data.comment if data.comment else "Этап согласован",
            created_at=approved_action_at,
            created_at_dt=to_utc_datetime(approved_action_at)
        )
        db.add(log)
        
        # Check if final
        response_data = {}
        # Check if final
        if current_step and current_step.is_final:
            req.status = 'approved'
            req.approved_at = now_iso()
            req.approved_at_dt = to_utc_datetime(req.approved_at)
            req.approver_id = current_user.id
            req.current_step_id = None
            response_data = {"status": "approved_final"}
            
        else:
            # Move to next step
            all_higher_steps = db.query(ApprovalStep).filter(
                ApprovalStep.step_order > current_step.step_order
            ).order_by(ApprovalStep.step_order.asc()).all()
            
            next_step = None
            for s in all_higher_steps:
                if check_step_condition(s, req):
                    next_step = s
                    break
            
            if next_step:
                req.current_step_id = next_step.id
                response_data = {"status": "moved_to_next_step", "next_step": next_step.label}
            else:
                # Fallback
                req.status = 'approved'
                req.current_step_id = None
                response_data = {"status": "approved_fallback"}

        # --- Notifications ---
        if req.status == 'approved':
              # Notify requester
              _notify(db, req.requester_id, f"Ваша заявка на {req.employee.full_name} была полностью одобрена!", link="/requests")
              
              # Notify those who should be notified on completion
              notify_steps = db.query(ApprovalStep).filter(ApprovalStep.notify_on_completion == True).all()
              for ns in notify_steps:
                  users_to_notify = db.query(User).filter(User.role_id == ns.role_id).all()
                  for u in users_to_notify:
                      _notify(db, u.id, f"Заявка на {req.employee.full_name} успешно утверждена.", link="/requests")
         
        elif req.current_step_id:
            # Notify people in the NEW current step
              new_step = db.get(ApprovalStep, req.current_step_id)
              if new_step:
                  if new_step.user_id:
                      _notify(db, new_step.user_id, f"Заявка согласована предыдущим этапом. Теперь ваша очередь: {req.employee.full_name}", link="/requests")
                  elif new_step.role_id:
                      users_to_notify = db.query(User).filter(User.role_id == new_step.role_id).all()
                      for u in users_to_notify:
                         _notify(db, u.id, f"Заявка согласована предыдущим этапом. Теперь ваша очередь: {req.employee.full_name}", link="/requests")

        db.commit()
         
        return response_data

def _notify(db: Session, user_id: int, message: str, link: str = None):
    from database.models import Notification
    created_at = now_iso()
    note = Notification(
        user_id=user_id,
        message=message,
        created_at=created_at,
        created_at_dt=to_utc_datetime(created_at),
        link=link
    )
    db.add(note)

@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    req = db.get(SalaryRequest, req_id)
    if not req: raise HTTPException(404, "Not found")
    
    # Only Owner can delete pending? Or Admin anywhere?
    if req.requester_id != current_user.id:
         # Check admin
         is_admin = _is_admin_user(current_user)
         if not is_admin:
             raise HTTPException(403, "Not allowed")
             
    # Cleanup history? Cascade should handle but SQLite needs PRAGMA. 
    # Let's delete manually to be safe or rely on cascade if configured. 
    # Models didn't specify cascade for history (back_populates only). 
    # So we should delete history items first.
    from database.models import RequestHistory
    db.query(RequestHistory).filter(RequestHistory.request_id == req.id).delete()
             
    db.delete(req)
    db.commit()
    return {"status": "deleted"}

@router.get("/{req_id}/analytics")
def get_request_analytics(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    r = db.get(SalaryRequest, req_id)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
        
    # Permission Check
    can_approve = False
    if r.status == 'pending' and r.current_step:
        step = r.current_step
        if step.user_id == current_user.id:
            can_approve = True
        elif step.role_id == current_user.role_id and step.user_id is None:
            can_approve = True
    
    is_admin = _is_admin_user(current_user)
        
    if not (can_approve or is_admin):
        return None  

    # --- Analytics Logic ---
    analytics_data = {
        "market": None,
        "internal": None,
        "budget": None
    }
    
    if r.employee:
        from database.models import MarketData, FinancialRecord, Employee, PlanningPosition, OrganizationUnit, Position
        from sqlalchemy import func, and_
        
        # Identify Branch ID for market data (Branch Level)
        branch_id = None
        if r.employee.org_unit:
            if r.employee.org_unit.type == 'branch':
                branch_id = r.employee.org_unit.id
            elif r.employee.org_unit.parent_id:
                branch_id = r.employee.org_unit.parent_id
        
        # 1. Market Data
        if r.employee.position:
            market = db.query(MarketData).filter(
                MarketData.position_title == r.employee.position.title,
                MarketData.branch_id == branch_id
            ).first()
            
            if not market:
                # Fallback to general market data if no branch-specific data exists
                market = db.query(MarketData).filter(
                    MarketData.position_title == r.employee.position.title
                ).first()
            if market:
                analytics_data["market"] = {
                    "min": market.min_salary,
                    "max": market.max_salary,
                    "median": market.median_salary
                }
                
        # 2. Internal Stats (Same Position in Same Unit/Branch)
        if branch_id and r.employee.position:
            # Subquery for latest financial record
            fact_sub = db.query(
                FinancialRecord.employee_id,
                func.max(FinancialRecord.id).label('max_id')
            ).group_by(FinancialRecord.employee_id).subquery()
            
            # Get average salary for this position in this branch
            unit_ids = [branch_id]
            # Add departments
            depts = db.query(OrganizationUnit).filter(OrganizationUnit.parent_id == branch_id).all()
            unit_ids.extend([d.id for d in depts])
            
            stats = db.query(
                func.avg(FinancialRecord.total_net),
                func.count(FinancialRecord.employee_id)
            ).join(
                fact_sub, 
                and_(FinancialRecord.employee_id == fact_sub.c.employee_id, FinancialRecord.id == fact_sub.c.max_id)
            ).join(
                Employee, Employee.id == FinancialRecord.employee_id
            ).join(
                Position, Employee.position_id == Position.id
            ).filter(
                Employee.org_unit_id.in_(unit_ids),
                Position.title == r.employee.position.title,
                Employee.status != 'Dismissed'
            ).first()
            
            if stats and stats[1] > 0:
                analytics_data["internal"] = {
                    "avg_total_net": int(stats[0]),
                    "count": stats[1]
                }

        # 3. Budget (Plan vs Fact for the Unit)
        if branch_id:
            plan_sum = db.query(
                func.sum(
                    (PlanningPosition.base_net + PlanningPosition.kpi_net) * PlanningPosition.count + \
                    PlanningPosition.bonus_net * func.coalesce(PlanningPosition.bonus_count, PlanningPosition.count)
                )
            ).filter(PlanningPosition.branch_id == branch_id).scalar() or 0
            
            # Fact Sum 
            fact_sub_b = db.query(
                FinancialRecord.employee_id,
                func.max(FinancialRecord.id).label('max_id')
            ).group_by(FinancialRecord.employee_id).subquery()
            
            # Safe re-definition of units
            unit_ids = [branch_id]
            depts = db.query(OrganizationUnit).filter(OrganizationUnit.parent_id == branch_id).all()
            unit_ids.extend([d.id for d in depts])
            
            fact_sum = db.query(func.sum(FinancialRecord.total_net)).join(
                fact_sub_b,
                and_(FinancialRecord.employee_id == fact_sub_b.c.employee_id, FinancialRecord.id == fact_sub_b.c.max_id)
            ).join(Employee).filter(
                Employee.org_unit_id.in_(unit_ids), 
                Employee.status != 'Dismissed'
            ).scalar() or 0
            
            analytics_data["budget"] = {
                "plan": int(plan_sum),
                "fact": int(fact_sum),
                "balance": int(plan_sum - fact_sum)
            }
            
    return analytics_data
