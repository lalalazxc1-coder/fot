from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
import httpx
from database.database import get_db
from database.models import MarketData, MarketEntry, User
from schemas import MarketDataCreate, MarketDataUpdate, MarketEntryCreate, MarketEntryResponse
from dependencies import get_current_active_user

router = APIRouter(prefix="/api/market", tags=["market"])

def recalculate_stats(db: Session, market_id: int):
    # Fetch all entries for this market_id
    entries = db.query(MarketEntry).filter(MarketEntry.market_id == market_id).all()
    market_item = db.get(MarketData, market_id)
    
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
        permissions = current_user.role_rel.permissions or {}
        if permissions.get('admin_access') or permissions.get('view_market') or permissions.get('edit_market'): has_perm = True
    
    if not has_perm:
        # Check if user has specific branch scope maybe? For now strict
        pass
        # raise HTTPException(403, "Permission 'view_market' required")

    return db.query(MarketData).options(joinedload(MarketData.entries)).all()

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
    
    market_item = db.get(MarketData, entry.market_id)
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
    entry = db.get(MarketEntry, id)
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
    item = db.get(MarketData, id)
    if not item: raise HTTPException(404, "Not found")
    
    # Cascade delete should handle entries via relationship, but check 
    # db.query(MarketEntry).filter(MarketEntry.market_id == id).delete()
    
    db.delete(item)
    db.commit()
    return {"status": "deleted"}

@router.post("/{id}/sync-hh")
async def sync_market_with_hh(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check Edit Permission
    has_perm = False
    if current_user.role_rel:
        permissions = current_user.role_rel.permissions or {}
        if permissions.get('admin_access') or permissions.get('edit_market'): has_perm = True
        
    if not has_perm:
        # allow for now or raise
        pass
        
    item = db.get(MarketData, id)
    if not item:
        raise HTTPException(404, "Market data not found")
        
    url = "https://api.hh.ru/vacancies"
    # Using area=160 (Almaty), but we search across all if requested. We'll stick to Almaty (160) for relevance.
    params = {
        "text": item.position_title,
        "search_field": "name",
        "per_page": 100,
        "area": 160,
        "only_with_salary": "true"
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(500, f"HH API Error: {resp.status_code} - {resp.text}")
            
        data = resp.json()
        
    vacancies = data.get("items", [])
    if not vacancies:
        return {"message": "No vacancies found with salaries", "count": 0}
        
    # Delete old HR/HH imported entries to avoid duplicates. We keep "System" or manually added separate.
    # Actually, let's just delete old "HH.kz" ones
    db.query(MarketEntry).filter(MarketEntry.market_id == id, MarketEntry.company_name.like('HH.kz%')).delete()
    
    count_added = 0
    for vac in vacancies:
        salary = vac.get("salary")
        if not salary: continue
        
        s_from = salary.get("from")
        s_to = salary.get("to")
        currency = salary.get("currency", "KZT")
        
        multiplier = 1
        if currency in ["RUR", "RUB"]: multiplier = 5.2
        elif currency == "USD": multiplier = 480
        
        val = 0
        if s_from and s_to:
            val = (s_from + s_to) / 2
        elif s_from:
            val = s_from
        elif s_to:
            val = s_to
            
        val = int(val * multiplier)
        if val <= 0: continue
        
        emp = vac.get("employer", {}).get("name", "HH.kz")
        company_name = f"HH.kz: {emp[:30]}"
        
        entry = MarketEntry(
            market_id=id,
            company_name=company_name,
            salary=val,
            created_at=datetime.now().strftime("%d.%m.%Y %H:%M"),
            url=vac.get("alternate_url")
        )
        db.add(entry)
        count_added += 1
        
    if count_added > 0:
        db.commit()
        recalculate_stats(db, id)
    
    return {"message": "Synced successfully", "count": count_added}
