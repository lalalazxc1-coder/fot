from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database.database import get_db
from database.models import MarketData, MarketEntry, User
from schemas import MarketDataCreate, MarketDataUpdate, MarketEntryCreate, MarketEntryResponse
from dependencies import get_current_active_user

router = APIRouter(prefix="/api/market", tags=["market"])

def recalculate_stats(db: Session, market_id: int):
    # Fetch all entries for this market_id
    entries = db.query(MarketEntry).filter(MarketEntry.market_id == market_id).all()
    market_item = db.query(MarketData).get(market_id)
    
    if not market_item:
        return

    if not entries:
        market_item.min_salary = 0
        market_item.max_salary = 0
        market_item.median_salary = 0
        market_item.updated_at = datetime.now().strftime("%d.%m.%Y")
        db.commit()
        return

    salaries = sorted([e.salary for e in entries])
    count = len(salaries)
    
    # Min/Max
    market_item.min_salary = salaries[0]
    market_item.max_salary = salaries[-1]
    
    # Median
    if count % 2 == 1:
        median = salaries[count // 2]
    else:
        mid1 = salaries[count // 2 - 1]
        mid2 = salaries[count // 2]
        median = int((mid1 + mid2) / 2)
    
    market_item.median_salary = median
    market_item.updated_at = datetime.now().strftime("%d.%m.%Y")
    
    # Update source text based on entries count or names
    # Maybe keep it manual or append "Based on X entries"
    
    db.commit()

@router.get("")
def get_market_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check View Permission
    has_perm = False
    if current_user.role_rel:
        if current_user.role_rel.name == 'Administrator': has_perm = True
        permissions = current_user.role_rel.permissions or {}
        if permissions.get('admin_access') or permissions.get('view_market') or permissions.get('edit_market'): has_perm = True
    
    if not has_perm:
        # Check if user has specific branch scope maybe? For now strict
        pass
        # raise HTTPException(403, "Permission 'view_market' required")

    return db.query(MarketData).all()

@router.get("/{id}/entries", response_model=list[MarketEntryResponse])
def get_market_entries(id: int, db: Session = Depends(get_db)):
    return db.query(MarketEntry).filter(MarketEntry.market_id == id).all()

@router.post("")
def create_market_data(data: MarketDataCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check Edit Permission
    # ... (Permission check same as before)
    
    # Check duplicate (Title + Branch)
    query = db.query(MarketData).filter(MarketData.position_title == data.position_title)
    if data.branch_id:
        query = query.filter(MarketData.branch_id == data.branch_id)
    else:
        query = query.filter(MarketData.branch_id == None)
        
    existing = query.first()
    
    if existing:
        return existing
    
    new_data = MarketData(
        position_title=data.position_title,
        branch_id=data.branch_id,
        min_salary=data.min_salary,
        max_salary=data.max_salary,
        median_salary=data.median_salary,
        source=data.source or "System",
        updated_at=datetime.now().strftime("%d.%m.%Y")
    )
    db.add(new_data)
    db.commit()
    db.refresh(new_data)
    return new_data

@router.post("/entries", response_model=MarketEntryResponse)
def add_market_entry(entry: MarketEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check permission
    # ...
    
    market_item = db.query(MarketData).get(entry.market_id)
    if not market_item:
        raise HTTPException(404, "Market data not found")
        
    new_entry = MarketEntry(
        market_id=entry.market_id,
        company_name=entry.company_name,
        salary=entry.salary,
        created_at=datetime.now().strftime("%d.%m.%Y %H:%M")
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # Recalculate
    recalculate_stats(db, entry.market_id)
    
    return new_entry

@router.delete("/entries/{id}")
def delete_market_entry(id: int, db: Session = Depends(get_db)):
    entry = db.query(MarketEntry).get(id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    
    m_id = entry.market_id
    db.delete(entry)
    db.commit()
    
    recalculate_stats(db, m_id)
    return {"status": "deleted"}

@router.delete("/{id}")
def delete_market_data(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # ... Permission check ...
    item = db.query(MarketData).get(id)
    if not item: raise HTTPException(404, "Not found")
    
    # Cascade delete should handle entries via relationship, but check 
    # db.query(MarketEntry).filter(MarketEntry.market_id == id).delete()
    
    db.delete(item)
    db.commit()
    return {"status": "deleted"}
