from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
import httpx
import logging
from pydantic import BaseModel, ConfigDict, Field
from database.database import get_db
from database.models import MarketData, MarketEntry, User
from schemas import MarketDataCreate, MarketDataUpdate, MarketEntryCreate, MarketEntryResponse
from dependencies import get_current_active_user
from utils.date_utils import now_iso, to_iso_utc, to_utc_datetime
from utils.outbound_http import async_get_with_retry

router = APIRouter(prefix="/api/market", tags=["market"])
logger = logging.getLogger("fot.market")

HH_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class MarketPointResponse(BaseModel):
    id: int
    market_id: int
    company_name: str
    salary: int
    created_at: str
    url: str | None = None

    model_config = ConfigDict(extra="forbid")


class MarketDataResponse(BaseModel):
    id: int
    position_title: str
    branch_id: int | None = None
    min_salary: int
    max_salary: int
    median_salary: int
    source: str | None = None
    updated_at: str
    points: list[MarketPointResponse] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


def _has_market_view_permission(current_user: User) -> bool:
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    return bool(perms.get("admin_access") or perms.get("view_market") or perms.get("edit_market"))


def _require_market_view_permission(current_user: User) -> None:
    if not _has_market_view_permission(current_user):
        raise HTTPException(403, "Permission 'view_market' required")


def _require_market_edit_permission(current_user: User) -> None:
    perms = current_user.role_rel.permissions if current_user.role_rel else {}
    if not (perms.get("admin_access") or perms.get("edit_market")):
        raise HTTPException(403, "Permission 'edit_market' required")

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
        market_item.updated_at = now_iso()
        market_item.updated_at_dt = to_utc_datetime(market_item.updated_at)
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
    market_item.updated_at = now_iso()
    market_item.updated_at_dt = to_utc_datetime(market_item.updated_at)
    
    # Update source text based on entries count or names
    # Maybe keep it manual or append "Based on X entries"
    
    db.commit()

@router.get("", response_model=list[MarketDataResponse])
def get_market_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    _require_market_view_permission(current_user)

    items = db.query(MarketData).options(joinedload(MarketData.entries)).all()
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "position_title": item.position_title,
            "branch_id": item.branch_id,
            "min_salary": item.min_salary,
            "max_salary": item.max_salary,
            "median_salary": item.median_salary,
            "source": item.source,
            "updated_at": to_iso_utc(item.updated_at) or item.updated_at,
            "points": [
                {
                    "id": e.id,
                    "market_id": e.market_id,
                    "company_name": e.company_name,
                    "salary": e.salary,
                    "created_at": to_iso_utc(e.created_at) or e.created_at,
                    "url": e.url,
                }
                for e in item.entries
            ],
        })
    return result

@router.get("/{id}/entries", response_model=list[MarketEntryResponse])
def get_market_entries(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    _require_market_view_permission(current_user)
    entries = db.query(MarketEntry).filter(MarketEntry.market_id == id).all()
    return [
        {
            "id": e.id,
            "market_id": e.market_id,
            "company_name": e.company_name,
            "salary": e.salary,
            "created_at": to_iso_utc(e.created_at) or e.created_at,
            "url": e.url,
        }
        for e in entries
    ]

@router.post("", response_model=MarketDataResponse)
def create_market_data(data: MarketDataCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    _require_market_edit_permission(current_user)
    
    # Check duplicate (Title + Branch)
    query = db.query(MarketData).filter(MarketData.position_title == data.position_title)
    if data.branch_id:
        query = query.filter(MarketData.branch_id == data.branch_id)
    else:
        query = query.filter(MarketData.branch_id == None)
        
    existing = query.first()
    
    if existing:
        return {
            "id": existing.id,
            "position_title": existing.position_title,
            "branch_id": existing.branch_id,
            "min_salary": existing.min_salary,
            "max_salary": existing.max_salary,
            "median_salary": existing.median_salary,
            "source": existing.source,
            "updated_at": to_iso_utc(existing.updated_at) or existing.updated_at,
            "points": [
                {
                    "id": e.id,
                    "market_id": e.market_id,
                    "company_name": e.company_name,
                    "salary": e.salary,
                    "created_at": to_iso_utc(e.created_at) or e.created_at,
                    "url": e.url,
                }
                for e in existing.entries
            ] if hasattr(existing, "entries") and existing.entries else [],
        }

    now = now_iso()
    
    new_data = MarketData(
        position_title=data.position_title,
        branch_id=data.branch_id,
        min_salary=data.min_salary,
        max_salary=data.max_salary,
        median_salary=data.median_salary,
        source=data.source or "System",
        updated_at=now,
        updated_at_dt=to_utc_datetime(now)
    )
    db.add(new_data)
    db.commit()
    db.refresh(new_data)
    return {
        "id": new_data.id,
        "position_title": new_data.position_title,
        "branch_id": new_data.branch_id,
        "min_salary": new_data.min_salary,
        "max_salary": new_data.max_salary,
        "median_salary": new_data.median_salary,
        "source": new_data.source,
        "updated_at": to_iso_utc(new_data.updated_at) or new_data.updated_at,
        "points": [],
    }

@router.post("/entries", response_model=MarketEntryResponse)
def add_market_entry(entry: MarketEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    _require_market_edit_permission(current_user)
    
    market_item = db.get(MarketData, entry.market_id)
    if not market_item:
        raise HTTPException(404, "Market data not found")

    now = now_iso()
        
    new_entry = MarketEntry(
        market_id=entry.market_id,
        company_name=entry.company_name,
        salary=entry.salary,
        created_at=now,
        created_at_dt=to_utc_datetime(now)
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # Recalculate
    recalculate_stats(db, entry.market_id)
    
    return {
        "id": new_entry.id,
        "market_id": new_entry.market_id,
        "company_name": new_entry.company_name,
        "salary": new_entry.salary,
        "created_at": to_iso_utc(new_entry.created_at) or new_entry.created_at,
        "url": new_entry.url,
    }

@router.delete("/entries/{id}")
def delete_market_entry(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    _require_market_edit_permission(current_user)

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
    _require_market_edit_permission(current_user)

    item = db.get(MarketData, id)
    if not item: raise HTTPException(404, "Not found")
    
    # Cascade delete should handle entries via relationship, but check 
    # db.query(MarketEntry).filter(MarketEntry.market_id == id).delete()
    
    db.delete(item)
    db.commit()
    return {"status": "deleted"}

@router.post("/{id}/sync-hh")
async def sync_market_with_hh(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    _require_market_edit_permission(current_user)

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
    
    try:
        resp = await async_get_with_retry(
            url,
            params=params,
            headers=headers,
            timeout=HH_TIMEOUT,
            retries=2,
            backoff_seconds=0.15,
        )
    except httpx.RequestError:
        logger.exception("HH sync request failed")
        raise HTTPException(502, "HH API temporarily unavailable. Please try again later.")

    if resp.status_code != 200:
        logger.warning("HH sync failed with status %s", resp.status_code)
        if resp.status_code == 429:
            raise HTTPException(429, "HH API rate limit reached. Please try again later.")
        if 500 <= resp.status_code < 600:
            raise HTTPException(502, "HH API temporarily unavailable. Please try again later.")
        raise HTTPException(502, "HH API request failed. Please try again later.")
            
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
        now = now_iso()
        
        entry = MarketEntry(
            market_id=id,
            company_name=company_name,
            salary=val,
            created_at=now,
            created_at_dt=to_utc_datetime(now),
            url=vac.get("alternate_url")
        )
        db.add(entry)
        count_added += 1
        
    if count_added > 0:
        db.commit()
        recalculate_stats(db, id)
    
    return {"message": "Synced successfully", "count": count_added}
