from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import Role, User
from schemas import RoleCreate

from dependencies import require_admin

router = APIRouter(prefix="/api/roles", tags=["roles"], dependencies=[Depends(require_admin)])

@router.get("")
def get_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()

@router.post("")
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    if db.query(Role).filter_by(name=role.name).first():
        raise HTTPException(400, "Role exists")
    new_role = Role(name=role.name, permissions=role.permissions)
    db.add(new_role)
    db.commit()
    return {"status": "ok", "id": new_role.id}

@router.put("/{role_id}")
def update_role(role_id: int, role_data: RoleCreate, db: Session = Depends(get_db)):
    role = db.query(Role).get(role_id)
    if not role: raise HTTPException(404, "Role not found")
    
    role.name = role_data.name
    role.permissions = role_data.permissions
    db.commit()
    return {"status": "updated"}

@router.delete("/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).get(role_id)
    if not role: raise HTTPException(404, "Role not found")
    
    # Check usage
    if db.query(User).filter_by(role_id=role_id).first():
        raise HTTPException(400, "Cannot delete role assigned to users")

    db.delete(role)
    db.commit()
    return {"status": "deleted"}
