from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from database.database import get_db
from database.models import User, OrganizationUnit
from schemas import UserCreate, UserUpdate
from dependencies import require_admin
from security import get_password_hash  # Single source of truth

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])

@router.get("")
def get_users(db: Session = Depends(get_db)):
    # Optimized: Use joinedload for role to avoid N+1
    users = db.scalars(
        select(User).options(joinedload(User.role_rel))
    ).all()
    
    res = []
    
    # Pre-fetch units for name resolution
    units = db.scalars(select(OrganizationUnit)).all()
    unit_map = {u.id: u.name for u in units}
    
    for u in users:
        scope_str = "Все филиалы"
        
        if u.scope_branches:
            branch_names = [unit_map.get(int(bid), str(bid)) for bid in u.scope_branches if str(bid).isdigit()]
            scope_str = ", ".join(branch_names)
            if u.scope_departments:
                 dept_names = [unit_map.get(int(did), str(did)) for did in u.scope_departments if str(did).isdigit()]
                 scope_str += f" ({', '.join(dept_names)})"
        
        res.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role_name": u.role_rel.name if u.role_rel else "No Role",
            "role_id": u.role_id,
            "scope_branches": u.scope_branches,
            "scope_departments": u.scope_departments,
            "scope_unit_name": scope_str
        })
    return res

@router.post("")
def create_user(u: UserCreate, db: Session = Depends(get_db)):
    if db.scalars(select(User).filter_by(email=u.email)).first():
        raise HTTPException(400, "Email already registered")
    
    # Secure: Hash password before saving
    hashed = get_password_hash(u.password)
        
    new_user = User(
        email=u.email, 
        full_name=u.full_name, 
        hashed_password=hashed, 
        role_id=u.role_id,
        scope_branches=u.scope_branches or [],
        scope_departments=u.scope_departments or []
    )
    db.add(new_user)
    db.commit()
    return {"status": "ok"}

@router.put("/{user_id}")
def update_user(user_id: int, u: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user: raise HTTPException(404, "User not found")

    user.email = u.email
    user.full_name = u.full_name
    user.role_id = u.role_id
    
    user.scope_branches = u.scope_branches or []
    user.scope_departments = u.scope_departments or []

    if u.password:
        # Secure: Hash new password
        user.hashed_password = get_password_hash(u.password)
    
    db.commit()
    return {"status": "updated"}

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user: raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}
