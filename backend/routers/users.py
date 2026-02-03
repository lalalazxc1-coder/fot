from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database.database import get_db
from database.models import User, OrganizationUnit
from schemas import UserCreate, UserUpdate

from dependencies import require_admin

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])

@router.get("")
def get_users(db: Session = Depends(get_db)):
    # Remove joinedload for scope_unit since it's removed/changed
    users = db.query(User).options(joinedload(User.role_rel)).all()
    res = []
    
    # Pre-fetch units for name resolution
    units = db.query(OrganizationUnit).all()
    unit_map = {u.id: u.name for u in units}
    
    for u in users:
        scope_str = "Все филиалы"
        
        # Format Scope String
        if u.scope_branches:
            branch_names = [unit_map.get(bid, str(bid)) for bid in u.scope_branches]
            scope_str = ", ".join(branch_names)
            if u.scope_departments:
                 dept_names = [unit_map.get(did, str(did)) for did in u.scope_departments]
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
    if db.query(User).filter_by(email=u.email).first():
        raise HTTPException(400, "Email already registered")
        
    new_user = User(
        email=u.email, 
        full_name=u.full_name, 
        hashed_password=u.password, 
        role_id=u.role_id,
        # scope_unit_id is deprecated
        scope_branches=u.scope_branches or [],
        scope_departments=u.scope_departments or []
    )
    db.add(new_user)
    db.commit()
    return {"status": "ok"}

@router.put("/{user_id}")
def update_user(user_id: int, u: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user: raise HTTPException(404, "User not found")

    user.email = u.email
    user.full_name = u.full_name
    user.role_id = u.role_id
    
    user.scope_branches = u.scope_branches or []
    user.scope_departments = u.scope_departments or []

    if u.password:
        user.hashed_password = u.password 
    
    db.commit()
    return {"status": "updated"}

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).get(user_id)
    if not user: raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}
