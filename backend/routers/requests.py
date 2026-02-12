from fastapi import APIRouter, Depends, HTTPException
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
def get_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Admin sees all. 
    # Approvers (anyone with a role that is in any approval step) should see pending requests assigned to their role.
    # Requesters see their own.
    
    is_admin = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': is_admin = True
        if current_user.role_rel.permissions.get('admin_access'): is_admin = True
        
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
        
        from sqlalchemy import or_
        from database.models import ApprovalStep
        
        # Check if user's role is involved in any current pending step
        # Logic: (requester_id == me) OR (status='pending' AND current_step.role_id == my_role)
        
        # Check if user involved in workflow (by user_id OR role_id)
        # 1. Requester
        # 2. Designated in current step by user_id
        # 3. Designated in current step by role_id
        
        query = query.join(SalaryRequest.current_step, isouter=True).filter(
            or_(
                SalaryRequest.requester_id == current_user.id,
                (SalaryRequest.status == 'pending') & (ApprovalStep.user_id == current_user.id), # Direct assignment
                (SalaryRequest.status == 'pending') & (ApprovalStep.role_id == user_role_id) & (ApprovalStep.user_id == None) # Role fallback
            )
        )
        
    requests = query.all()
    
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

        req_details = {
            "name": r.requester.full_name if r.requester else "Unknown",
            "position": "-", # simplified
            "branch": "-",
            "department": "-"
        }
        
        # Workflow info
        current_step_label = r.current_step.label if r.current_step else "Finished" if r.status != 'pending' else "No Step"
        
        # Check if current user can approve
        can_approve = False
        if r.status == 'pending' and r.current_step:
            step = r.current_step
            if step.user_id == current_user.id:
                can_approve = True
            elif step.role_id == current_user.role_id and step.user_id is None:
                can_approve = True
            # Admin override
            if is_admin: can_approve = True
            
        history = []
        for h in r.history:
            history.append({
                "id": h.id,
                "step_label": h.step.label if h.step else "System",
                "actor_name": h.actor.full_name if h.actor else "Unknown",
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
            "can_approve": can_approve,
            "history": history
        })
    return res

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
            comment="Rejected by user",
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
            comment="Approved step",
            created_at=datetime.now().strftime("%d.%m.%Y %H:%M")
        )
        db.add(log)
        
        # Check if final
        if current_step and current_step.is_final:
            req.status = 'approved'
            req.approved_at = datetime.now().strftime("%d.%m.%Y %H:%M")
            req.approver_id = current_user.id
            req.current_step_id = None
            
            # --- APPLY FINANCIAL CHANGES (Final Only) ---
            # DISABLED per user request (User: "после согласования заявки на зп не нужно автоматически менять записи в фот и сотрудники")
            # last_record = db.query(FinancialRecord).filter(FinancialRecord.employee_id == req.employee_id).order_by(FinancialRecord.id.desc()).first()
            
            # new_base_net = req.requested_value
            # new_base_gross = int(new_base_net / 0.81)
            
            # new_kpi_net = last_record.kpi_net if last_record else 0
            # new_kpi_gross = last_record.kpi_gross if last_record else 0
            # new_bonus_net = last_record.bonus_net if last_record else 0
            # new_bonus_gross = last_record.bonus_gross if last_record else 0
            
            # record = FinancialRecord(
            #     employee_id=req.employee_id,
            #     month=datetime.now().strftime("%Y-%m"), # Current month
            #     base_net=new_base_net,
            #     base_gross=new_base_gross,
            #     kpi_net=new_kpi_net,
            #     kpi_gross=new_kpi_gross,
            #     bonus_net=new_bonus_net,
            #     bonus_gross=new_bonus_gross,
            #     total_net=new_base_net + new_kpi_net + new_bonus_net,
            #     total_gross=new_base_gross + new_kpi_gross + new_bonus_gross
            # )
            # db.add(record)
            # ---------------------------------------------
            
            db.commit()
            return {"status": "approved_final"}
            
        else:
            # Move to next step
            next_step = db.query(ApprovalStep).filter(
                ApprovalStep.step_order > current_step.step_order
            ).order_by(ApprovalStep.step_order.asc()).first()
            
            if next_step:
                req.current_step_id = next_step.id
                db.commit()
                return {"status": "moved_to_next_step", "next_step": next_step.label}
            else:
                # No next step found but was not marked final? Treat as final fallback
                req.status = 'approved'
                req.current_step_id = None
                db.commit()

        # --- Notifications ---
        if req.status == 'approved':
             # Notify requester
             _notify(db, req.requester_id, f"Ваша заявка на {req.employee.full_name} была полностью одобрена!", link="/requests")
             
             # Notify those who should be notified on completion
             notify_steps = db.query(ApprovalStep).filter(ApprovalStep.notify_on_completion == True).all()
             for ns in notify_steps:
                 # Find users with this role
                 # This is potentially expensive if many users, but for MVP ok.
                 users_to_notify = db.query(User).filter(User.role_id == ns.role_id).all()
                 for u in users_to_notify:
                     _notify(db, u.id, f"Заявка на {req.employee.full_name} успешно утверждена.", link="/requests")
        
        elif req.current_step_id:
            # Notify people in the NEW current step
             new_step = db.query(ApprovalStep).get(req.current_step_id)
             if new_step:
                 # Check if user_id is set
                 if new_step.user_id:
                     _notify(db, new_step.user_id, f"Заявка согласована предыдущим этапом. Теперь ваша очередь: {req.employee.full_name}", link="/requests")
                 elif new_step.role_id:
                     users_to_notify = db.query(User).filter(User.role_id == new_step.role_id).all()
                     for u in users_to_notify:
                        _notify(db, u.id, f"Заявка согласована предыдущим этапом. Теперь ваша очередь: {req.employee.full_name}", link="/requests")
        
        return {"status": "updated"}

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
