from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import Employee, User, OrganizationUnit, FinancialRecord
from dependencies import require_admin
from sqlalchemy.sql import func

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    # 1. Counts
    total_employees = db.query(Employee).count()
    total_users = db.query(User).count()
    total_branches = db.query(OrganizationUnit).filter_by(type="branch").count()
    
    # 2. Total Budget (Sum of latest financial record for each employee)
    # This is a bit tricky. We need the latest record for each employee.
    # Simplified approach: Sum of all *latest* records.
    
    # Modern approach using a subquery is best, but for MVP let's do Python-side sum if dataset is small
    # or proper SQL if we want performance. Let's do a reasonably efficient query.
    
    # Get all latest records
    records = db.query(FinancialRecord).all()
    # Filter only latest per employee in memory (not efficient for 10k+ rows but fine for 100)
    latest_map = {}
    for r in records:
        if r.employee_id not in latest_map or r.id > latest_map[r.employee_id].id:
            latest_map[r.employee_id] = r
    
    total_budget = sum(r.total_payment for r in latest_map.values())
    
    return {
        "employees": total_employees,
        "users": total_users,
        "branches": total_branches,
        "budget": total_budget
    }
