from pydantic import BaseModel
from typing import Optional, Dict, List

# Auth & Users
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    status: str
    user_id: int
    full_name: str
    role: str
    permissions: Dict[str, bool]
    scope_branches: List[int] = []
    scope_departments: List[int] = []
    access_token: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    permissions: Dict[str, bool]

class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role_id: int
    # Optional scopes
    scope_branches: Optional[List[int]] = []
    scope_departments: Optional[List[int]] = []

class UserUpdate(BaseModel):
    full_name: str
    email: str
    role_id: int
    scope_branches: Optional[List[int]] = []
    scope_departments: Optional[List[int]] = []
    password: Optional[str] = None

# Structure
# Structure
class OrgUnitCreate(BaseModel):
    name: str
    type: str 
    parent_id: Optional[int] = None
    head_id: Optional[int] = None

class OrgUnitUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    head_id: Optional[int] = None

# Employees
class EmployeeCreate(BaseModel):
    full_name: str
    position_title: str
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    is_head: Optional[bool] = False
    # Financials (Pairs)
    base_net: float = 0
    base_gross: float = 0
    
    kpi_net: float = 0
    kpi_gross: float = 0
    
    bonus_net: float = 0
    bonus_gross: float = 0
    
    hire_date: Optional[str] = None
    status: str = "Активен"

class FinancialUpdate(BaseModel):
    base_net: Optional[float] = None
    base_gross: Optional[float] = None
    
    kpi_net: Optional[float] = None
    kpi_gross: Optional[float] = None
    
    bonus_net: Optional[float] = None
    bonus_gross: Optional[float] = None
    
class EmpDetailsUpdate(BaseModel):
    full_name: str
    position_title: str
    branch_id: int | None = None
    department_id: int | None = None

class EmployeeUpdate(BaseModel):
    full_name: str
    branch_id: int
    department_id: int | None = None
    position_title: str
    base_net: int = 0
    base_gross: int = 0
    kpi_net: int = 0
    kpi_gross: int = 0
    bonus_net: int = 0
    bonus_gross: int = 0
    
class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class SalaryRequestCreate(BaseModel):
    employee_id: int
    type: str # 'raise', 'bonus'
    current_value: float
    requested_value: float
    reason: str

class SalaryRequestUpdate(BaseModel):
    status: str # 'approved', 'rejected'
    comment: Optional[str] = None

class MarketEntryCreate(BaseModel):
    market_id: int
    company_name: str
    salary: int

class MarketEntryResponse(BaseModel):
    id: int
    market_id: int
    company_name: str
    salary: int
    created_at: str

class MarketDataCreate(BaseModel):
    position_title: str
    branch_id: int | None = None
    # Optional initial value, but mostly 0 if using entries
    min_salary: int = 0
    max_salary: int = 0
    median_salary: int = 0
    source: str | None = None

class MarketDataUpdate(BaseModel):
    branch_id: int | None = None
    min_salary: int | None = None
    max_salary: int | None = None
    median_salary: int | None = None
    source: str | None = None

# Analytics
class AnalyticsFactPlan(BaseModel):
    total_net: float
    count: int

class AnalyticsMetrics(BaseModel):
    diff_net: float
    execution_percent: float
    headcount_diff: int
    is_over_budget: bool

class AnalyticsSummaryResponse(BaseModel):
    fact: AnalyticsFactPlan
    plan: AnalyticsFactPlan
    metrics: AnalyticsMetrics
    cached_at: str

class BranchComparisonItem(BaseModel):
    id: int
    name: str
    plan: float
    fact: float
    diff: float
    percent: float

class BranchComparisonResponse(BaseModel):
    data: List[BranchComparisonItem]
    total: int
    cached_at: str

class TopEmployeeItem(BaseModel):
    id: int
    full_name: str
    position: str
    branch: str
    total_net: float

class TopEmployeesResponse(BaseModel):
    data: List[TopEmployeeItem]
    cached_at: str

class CostDistributionItem(BaseModel):
    name: str
    value: float

class CostDistributionResponse(BaseModel):
    data: List[CostDistributionItem]
    cached_at: str

class PositionBase(BaseModel):
    title: str
    grade: int = 1

class PositionCreate(PositionBase):
    pass

class PositionUpdate(PositionBase):
    pass

class PositionResponse(PositionBase):
    id: int
    
    class Config:
        from_attributes = True

class ApprovalStepBase(BaseModel):
    step_order: int
    role_id: Optional[int] = None
    user_id: Optional[int] = None # New!
    label: str
    is_final: bool = False
    step_type: str = "approval" # 'approval', 'notification'
    notify_on_completion: bool = False

class ApprovalStepCreate(ApprovalStepBase):
    pass

class ApprovalStepResponse(ApprovalStepBase):
    id: int
    role_name: Optional[str] = None
    user_name: Optional[str] = None # New!
    
    class Config:
        from_attributes = True

class RequestHistoryResponse(BaseModel):
    id: int
    step_label: Optional[str]
    actor_name: str
    actor_role: Optional[str] = None
    actor_branch: Optional[str] = None
    action: str
    comment: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True

class PaginatedRequestsResponse(BaseModel):
    items: List[Dict]
    total: int
    page: int
    size: int
    total_pages: int

# Retention
class RetentionRiskItem(BaseModel):
    id: int
    full_name: str
    position: str
    branch: str
    last_update: Optional[str] = None
    months_stagnant: int
    current_salary: float
    market_median: float
    gap_percent: float
    years_gaps: float = 0 # gap in years

class RetentionDashboardResponse(BaseModel):
    items: List[RetentionRiskItem]
    risk_distribution: Dict[str, int]
    cached_at: str

# ESG
class PayEquityItem(BaseModel):
    category: str
    count: int
    avg_salary: float

class ESGReportResponse(BaseModel):
    gender_equity: List[PayEquityItem]
    age_equity: List[PayEquityItem]
    cached_at: str
