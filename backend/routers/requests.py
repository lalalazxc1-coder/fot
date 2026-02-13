from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from database.database import get_db
from database.models import SalaryRequest, User, Employee
from schemas import SalaryRequestCreate, SalaryRequestUpdate
from dependencies import get_current_active_user, require_admin

router = APIRouter(prefix="/api/requests", tags=["requests"])

@router.post("")
def create_request(data: SalaryRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check if employee exists
    emp = db.query(Employee).get(data.employee_id)
    if not emp: raise HTTPException(404, "Employee not found")
    
    # 1. Determine Initial Step
    from database.models import ApprovalStep, RequestHistory, User
    first_step = db.query(ApprovalStep).order_by(ApprovalStep.step_order.asc()).first()
    
    current_step_id = first_step.id if first_step else None
    
    req = SalaryRequest(
        requester_id=current_user.id,
        employee_id=data.employee_id,
        type=data.type,
        current_value=data.current_value,
        requested_value=data.requested_value,
        reason=data.reason,
        status="pending",
        current_step_id=current_step_id,
        created_at=datetime.now().strftime("%d.%m.%Y %H:%M")
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    
    # 2. Add History Log
    log = RequestHistory(
        request_id=req.id,
        step_id=current_step_id,
        actor_id=current_user.id,
        action="created",
        comment="Created request",
        created_at=datetime.now().strftime("%d.%m.%Y %H:%M")
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
    
    return req

@router.get("")
@router.get("")
def get_requests(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), status: str = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Admin sees all. 
    # Approvers (anyone with a role that is in any approval step) should see pending requests assigned to their role.
    # Requesters see their own.
    
    is_admin = False
    if current_user.role_rel and current_user.role_rel.permissions.get('admin_access'):
        is_admin = True
        
    query = db.query(SalaryRequest)
    
    # Filter logic
    if not is_admin:
        # If user is requester, show.
        # OR if user is current approver, show.
        # Simple for now: If not admin, verify ownership OR if they have permission to 'manage_requests'
        # But for workflow, we ideally want "My Pending Approvals".
        # Let's show:
        # 1. Requests I created
        # 2. Requests waiting at a step where role_id == my_role_id
        
        user_role_id = current_user.role_id
        

        from sqlalchemy import or_, and_ 
        # 1. Requester (created the request)
        # 2. Current Approver (User ID match OR Role ID match if no user)
        # 3. Past Participant (In History)
        
        from database.models import RequestHistory, ApprovalStep
        
        # Subquery for history participation
        # Use simple scalar list of IDs or a proper scalar subquery
        history_query = db.query(RequestHistory.request_id).filter(RequestHistory.actor_id == current_user.id).distinct()
        
        query = query.outerjoin(SalaryRequest.current_step).filter(
            or_(
                SalaryRequest.requester_id == current_user.id,
                # Current Step Assignment
                and_(SalaryRequest.status == 'pending', ApprovalStep.user_id == current_user.id),
                and_(SalaryRequest.status == 'pending', ApprovalStep.role_id == user_role_id, ApprovalStep.user_id == None),
                # History Participation
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
    
    # Paginate
    offset = (page - 1) * size
    requests = query.order_by(SalaryRequest.id.desc()).offset(offset).limit(size).all()
    
    res = []
    for r in requests:
        # Helper to get emp/req details (same as before)
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

        # Requester Details Logic
        req_role = "-"
        req_branch = "-"
        req_dept = "-"
        
        # Requester Details Logic
        req_role = "-"
        req_branch = "-"
        req_dept = "-"
        
        # Import models needed for requester logic
        from database.models import OrganizationUnit
        
        if r.requester:
            # Position -> Role
            if r.requester.role_rel:
                req_role = r.requester.role_rel.name
            
            # Branch/Dept from Scope
            # Optimize: avoid too many queries, just show count or first one
            s_br = r.requester.scope_branches or []
            if len(s_br) == 1:
                # Fetch branch name
                b_obj = db.query(OrganizationUnit).get(s_br[0])
                if b_obj: req_branch = b_obj.name
            elif len(s_br) > 1:
                req_branch = f"{len(s_br)} филиалов"
                
            s_dp = r.requester.scope_departments or []
            if len(s_dp) == 1:
                d_obj = db.query(OrganizationUnit).get(s_dp[0])
                if d_obj: req_dept = d_obj.name
            elif len(s_dp) > 1:
                req_dept = f"{len(s_dp)} отделов"

        req_details = {
            "name": r.requester.full_name if r.requester else "Unknown",
            "position": req_role,
            "branch": req_branch,
            "department": req_dept
        }
        
        # Workflow info
        current_step_label = r.current_step.label if r.current_step else "Finished" if r.status != 'pending' else "No Step"
        
        # Check if current user can approve
        can_approve = False
        if r.status == 'pending' and r.current_step:
            step = r.current_step
            # By User
            if step.user_id == current_user.id:
                can_approve = True
            # By Role (if user match)
            elif step.role_id == current_user.role_id and step.user_id is None:
                can_approve = True
        
        # --- Analytics Context ---
        analytics_data = None
        
        # Analytics lazy loaded separately
        if can_approve or is_admin:
            # We set a flag or just leave it None/Empty, frontend will fetch if needed
            pass

            
        history = []
        history = []
        for h in sorted(r.history, key=lambda x: x.id, reverse=True):
            # Actor Details
            actor_role = "-"
            actor_branch = "-"
            if h.actor:
                if h.actor.role_rel: actor_role = h.actor.role_rel.name
                
                s_br = h.actor.scope_branches or []
                if len(s_br) == 1:
                    b_obj = db.query(OrganizationUnit).get(s_br[0])
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
                "created_at": h.created_at
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
            "created_at": r.created_at,
            # New fields
            "current_step_label": current_step_label,
            "current_step_type": r.current_step.step_type if r.current_step else "approval",
            "is_final": r.current_step.is_final if r.current_step else False,
            "can_approve": can_approve,
            "analytics_context": analytics_data,
            "history": history
        })
        
    import math
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
    
    req = db.query(SalaryRequest).get(req_id)
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
    is_admin = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': is_admin = True
        if current_user.role_rel.permissions.get('admin_access'): is_admin = True
    
    if not is_approver and not is_admin:
        raise HTTPException(403, "You are not the designated approver for this step.")

    # 2. Handle Rejection
    if data.status == 'rejected':
        req.status = 'rejected'
        req.current_step_id = None # Workflow ends
        
        # Log
        log = RequestHistory(
            request_id=req.id,
            step_id=current_step.id if current_step else None,
            actor_id=current_user.id,
            action="rejected",
            comment=data.comment if data.comment else "Отклонено пользователем",
            created_at=datetime.now().strftime("%d.%m.%Y %H:%M")
        )
        db.add(log)
        db.commit()
        return {"status": "rejected"}

    # 3. Handle Approval
    if data.status == 'approved':
        # Log approval
        log = RequestHistory(
            request_id=req.id,
            step_id=current_step.id if current_step else None,
            actor_id=current_user.id,
            action="approved",
            comment=data.comment if data.comment else "Этап согласован",
            created_at=datetime.now().strftime("%d.%m.%Y %H:%M")
        )
        db.add(log)
        
        # Check if final
        response_data = {}
        # Check if final
        if current_step and current_step.is_final:
            req.status = 'approved'
            req.approved_at = datetime.now().strftime("%d.%m.%Y %H:%M")
            req.approver_id = current_user.id
            req.current_step_id = None
            db.commit()
            response_data = {"status": "approved_final"}
            
        else:
            # Move to next step
            next_step = db.query(ApprovalStep).filter(
                ApprovalStep.step_order > current_step.step_order
            ).order_by(ApprovalStep.step_order.asc()).first()
            
            if next_step:
                req.current_step_id = next_step.id
                db.commit()
                response_data = {"status": "moved_to_next_step", "next_step": next_step.label}
            else:
                # Fallback
                req.status = 'approved'
                req.current_step_id = None
                db.commit()
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
             new_step = db.query(ApprovalStep).get(req.current_step_id)
             if new_step:
                 if new_step.user_id:
                     _notify(db, new_step.user_id, f"Заявка согласована предыдущим этапом. Теперь ваша очередь: {req.employee.full_name}", link="/requests")
                 elif new_step.role_id:
                     users_to_notify = db.query(User).filter(User.role_id == new_step.role_id).all()
                     for u in users_to_notify:
                        _notify(db, u.id, f"Заявка согласована предыдущим этапом. Теперь ваша очередь: {req.employee.full_name}", link="/requests")
        
        return response_data

def _notify(db: Session, user_id: int, message: str, link: str = None):
    from database.models import Notification
    note = Notification(
        user_id=user_id,
        message=message,
        created_at=datetime.now().strftime("%d.%m.%Y %H:%M"),
        link=link
    )
    db.add(note)
    db.commit()

@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    req = db.query(SalaryRequest).get(req_id)
    if not req: raise HTTPException(404, "Not found")
    
    # Only Owner can delete pending? Or Admin anywhere?
    if req.requester_id != current_user.id:
         # Check admin
         is_admin = False
         if current_user.role_rel:
            if current_user.role_rel.name == 'Administrator': is_admin = True
            if current_user.role_rel.permissions.get('admin_access'): is_admin = True
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
    r = db.query(SalaryRequest).get(req_id)
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
    
    is_admin = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': is_admin = True
        if current_user.role_rel.permissions.get('admin_access'): is_admin = True
        
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
            # Plan Sum
            plan_sum = db.query(
                func.sum((PlanningPosition.base_net + PlanningPosition.kpi_net + PlanningPosition.bonus_net) * PlanningPosition.count)
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
