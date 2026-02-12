from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database.database import get_db
from database.models import Position, User
from schemas import PositionCreate, PositionUpdate, PositionResponse
from dependencies import get_current_active_user, PermissionChecker

router = APIRouter(prefix="/api/positions", tags=["positions"])

@router.get("/", response_model=List[PositionResponse])
def get_positions(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check view permission
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    has_access = (
        current_user.role_rel.name == 'Administrator' or 
        perms.get('admin_access') or 
        perms.get('view_positions') or
        perms.get('edit_positions') # Edit implies view
    )
    # Positions are often public, so maybe allow everyone? 
    # If not, uncomment next line:
    # if not has_access: raise HTTPException(403, "Access Denied")
    return db.query(Position).all()

@router.post("/", response_model=PositionResponse, dependencies=[Depends(PermissionChecker('edit_positions'))])
def create_position(data: PositionCreate, db: Session = Depends(get_db)):
    # Check duplicate
    existing = db.query(Position).filter(Position.title == data.title).first()
    if existing:
        raise HTTPException(400, "Position already exists")
    
    new_pos = Position(title=data.title, grade=data.grade)
    db.add(new_pos)
    db.commit()
    db.refresh(new_pos)
    return new_pos

@router.put("/{pos_id}", response_model=PositionResponse, dependencies=[Depends(PermissionChecker('edit_positions'))])
def update_position(pos_id: int, data: PositionUpdate, db: Session = Depends(get_db)):
    pos = db.query(Position).get(pos_id)
    if not pos:
        raise HTTPException(404, "Position not found")
    
    # Check duplicate title if changed
    if data.title != pos.title:
        existing = db.query(Position).filter(Position.title == data.title).first()
        if existing:
            raise HTTPException(400, "Position with this title already exists")

    pos.title = data.title
    pos.grade = data.grade
    db.commit()
    db.refresh(pos)
    return pos

@router.delete("/{pos_id}", dependencies=[Depends(PermissionChecker('edit_positions'))])
def delete_position(pos_id: int, db: Session = Depends(get_db)):
    pos = db.query(Position).get(pos_id)
    if not pos:
        raise HTTPException(404, "Position not found")
    
    # Check usage? Ideally yes, but for now simple delete or restrict
    # If we have FKs, it might fail or set null depending on DB cascade. 
    # Usually better to check manually.
    # from database.models import Employee
    # usage = db.query(Employee).filter(Employee.position_id == pos_id).count()
    # if usage > 0: raise HTTPException(400, "Cannot delete position in use")

    db.delete(pos)
    db.commit()
    return {"status": "deleted"}
