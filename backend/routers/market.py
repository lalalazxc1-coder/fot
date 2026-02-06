from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database.database import get_db
from database.models import MarketData, User
from schemas import MarketDataCreate, MarketDataUpdate
from dependencies import get_current_active_user

router = APIRouter(prefix="/api/market", tags=["market"])

@router.get("")
def get_market_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check View Permission
    has_perm = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': has_perm = True
        permissions = current_user.role_rel.permissions or {}
        if permissions.get('admin_access') or permissions.get('view_market') or permissions.get('edit_market'): has_perm = True
    
    if not has_perm:
        raise HTTPException(403, "Permission 'view_market' required")

    return db.query(MarketData).all()

@router.post("")
def create_market_data(data: MarketDataCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check Edit Permission
    has_perm = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': has_perm = True
        permissions = current_user.role_rel.permissions or {}
        if permissions.get('admin_access') or permissions.get('edit_market'): has_perm = True
    
    if not has_perm:
        raise HTTPException(403, "Permission 'edit_market' required")

    # Check duplicate
    existing = db.query(MarketData).filter_by(position_title=data.position_title).first()
    if existing:
        # Update?
        existing.min_salary = data.min_salary
        existing.max_salary = data.max_salary
        existing.median_salary = data.median_salary
        existing.source = data.source
        existing.updated_at = datetime.now().strftime("%d.%m.%Y")
        db.commit()
        return existing
    
    new_data = MarketData(
        position_title=data.position_title,
        min_salary=data.min_salary,
        max_salary=data.max_salary,
        median_salary=data.median_salary,
        source=data.source,
        updated_at=datetime.now().strftime("%d.%m.%Y")
    )
    db.add(new_data)
    db.commit()
    db.refresh(new_data)
    return new_data

@router.delete("/{id}")
def delete_market_data(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check Edit Permission
    has_perm = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': has_perm = True
        permissions = current_user.role_rel.permissions or {}
        if permissions.get('admin_access') or permissions.get('edit_market'): has_perm = True
    
    if not has_perm:
        raise HTTPException(403, "Permission 'edit_market' required")
        
    item = db.query(MarketData).get(id)
    if not item: raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
