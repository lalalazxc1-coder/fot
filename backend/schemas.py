import re

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any, Optional, Dict, List, Literal

# Auth & Users
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: Optional[bool] = False

class LoginResponse(BaseModel):
    status: str
    user_id: int
    full_name: str
    email: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    permissions: Dict[str, bool]
    scope_branches: List[int] = []
    scope_departments: List[int] = []
    avatar_url: Optional[str] = None
    job_title: Optional[str] = None
    employee_id: Optional[int] = None
    access_token: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    permissions: Dict[str, bool]

class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role_id: int
    job_title: Optional[str] = None
    contact_email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    # Optional scopes
    scope_branches: Optional[List[int]] = []
    scope_departments: Optional[List[int]] = []
    employee_id: Optional[int] = None
    is_active: bool = True

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, v: Optional[str]):
        if v is None:
            return v
        value = v.strip()
        if not value:
            return None
        email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(email_regex, value):
            raise ValueError("Некорректный формат email")
        return value.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]):
        if v is None:
            return v
        cleaned = re.sub(r"[^\d+]", "", v.strip())
        if not cleaned:
            return None
        phone_regex = r"^(\+7|7|8)\d{10}$"
        if not re.match(phone_regex, cleaned):
            raise ValueError("Некорректный формат телефона")
        if cleaned.startswith("8"):
            cleaned = "+7" + cleaned[1:]
        elif cleaned.startswith("7"):
            cleaned = "+" + cleaned
        return cleaned

class UserUpdate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=254)
    role_id: int
    job_title: Optional[str] = None
    contact_email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    scope_branches: Optional[List[int]] = []
    scope_departments: Optional[List[int]] = []
    employee_id: Optional[int] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    is_active: bool = True

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, v: Optional[str]):
        if v is None:
            return v
        value = v.strip()
        if not value:
            return None
        email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(email_regex, value):
            raise ValueError("Некорректный формат email")
        return value.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]):
        if v is None:
            return v
        cleaned = re.sub(r"[^\d+]", "", v.strip())
        if not cleaned:
            return None
        phone_regex = r"^(\+7|7|8)\d{10}$"
        if not re.match(phone_regex, cleaned):
            raise ValueError("Некорректный формат телефона")
        if cleaned.startswith("8"):
            cleaned = "+7" + cleaned[1:]
        elif cleaned.startswith("7"):
            cleaned = "+" + cleaned
        return cleaned


class UserProfileUpdate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    job_title: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, v: Optional[str]):
        if v is None:
            return v
        value = v.strip()
        if not value:
            return None
        email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(email_regex, value):
            raise ValueError("Некорректный формат email")
        return value.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]):
        if v is None:
            return v
        cleaned = re.sub(r"[^\d+]", "", v.strip())
        if not cleaned:
            return None
        phone_regex = r"^(\+7|7|8)\d{10}$"
        if not re.match(phone_regex, cleaned):
            raise ValueError("Некорректный формат телефона")
        if cleaned.startswith("8"):
            cleaned = "+7" + cleaned[1:]
        elif cleaned.startswith("7"):
            cleaned = "+" + cleaned
        return cleaned

# Structure
# Structure
class OrgUnitCreate(BaseModel):
    name: str
    type: Literal['branch', 'department', 'head_office']
    parent_id: Optional[int] = None
    head_id: Optional[int] = None

class OrgUnitUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    head_id: Optional[int] = None

# Employees
class EmployeeCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    position_title: str = Field(..., min_length=1, max_length=255)
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
    status: Literal['Активен', 'Уволен', 'В отпуске'] = "Активен"
    gender: Optional[str] = None
    dob: Optional[str] = None
    last_raise_date: Optional[str] = None

class FinancialUpdate(BaseModel):
    base_net: Optional[float] = Field(None, ge=0)
    base_gross: Optional[float] = Field(None, ge=0)
    
    kpi_net: Optional[float] = Field(None, ge=0)
    kpi_gross: Optional[float] = Field(None, ge=0)
    
    bonus_net: Optional[float] = Field(None, ge=0)
    bonus_gross: Optional[float] = Field(None, ge=0)
    
class EmpDetailsUpdate(BaseModel):
    full_name: str
    position_title: str
    branch_id: int | None = None
    department_id: int | None = None

class EmployeeUpdate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    branch_id: int
    department_id: int | None = None
    position_title: str = Field(..., min_length=1, max_length=255)
    base_net: int = 0
    base_gross: int = 0
    kpi_net: int = 0
    kpi_gross: int = 0
    bonus_net: int = 0
    bonus_gross: int = 0
    gender: Optional[str] = None
    dob: Optional[str] = None
    status: Optional[str] = "Активен"
    hire_date: Optional[str] = None
    last_raise_date: Optional[str] = None
    
class DismissEmployeeRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)
    date: str = Field(..., min_length=1, max_length=20)

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class StatusResponse(BaseModel):
    status: str


class LogoutResponse(StatusResponse):
    message: str


class CurrentUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    permissions: Dict[str, bool]
    scope_branches: List[int] = []
    scope_departments: List[int] = []
    avatar_url: Optional[str] = None
    job_title: Optional[str] = None
    employee_id: Optional[int] = None


class NotificationItemResponse(BaseModel):
    id: int
    user_id: int
    message: str
    is_read: bool
    created_at: Optional[str] = None
    link: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class IntegrationSettingsUpdate(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    is_active: bool
    additional_params: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="forbid")


class IntegrationSettingsResponse(BaseModel):
    id: int
    service_name: str
    is_active: bool
    has_api_key: bool
    has_client_secret: bool
    client_id: Optional[str] = None
    updated_at: str

    model_config = ConfigDict(extra="forbid")


class TestConnectionRequest(BaseModel):
    service_name: str
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    base_url: Optional[str] = Field(None, max_length=512)

    model_config = ConfigDict(extra="forbid")


class TestConnectionResponse(BaseModel):
    success: bool
    message: str

    model_config = ConfigDict(extra="forbid")


class AnalyzeRequest(BaseModel):
    candidate_data: Dict[str, Any]
    job_description: Optional[str] = Field(None, max_length=10000)

    model_config = ConfigDict(extra="forbid")


class AnalyzeResponse(BaseModel):
    analysis: str
    match_score: int

    model_config = ConfigDict(extra="forbid")

class SalaryRequestCreate(BaseModel):
    employee_id: int = Field(..., gt=0)
    type: Literal['raise', 'bonus']  # Только допустимые значения
    current_value: float = Field(..., ge=0)
    requested_value: float = Field(..., ge=0)
    reason: str = Field(..., min_length=3, max_length=2000)

class SalaryRequestUpdate(BaseModel):
    status: Literal['approved', 'rejected']
    comment: Optional[str] = Field(None, max_length=2000)

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
    url: Optional[str] = None

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


class MarketPointResponse(BaseModel):
    id: int
    market_id: int
    company_name: str
    salary: int
    created_at: str
    url: Optional[str] = None


class MarketDataResponse(BaseModel):
    id: int
    position_title: str
    branch_id: Optional[int] = None
    min_salary: int
    max_salary: int
    median_salary: int
    source: Optional[str] = None
    updated_at: str
    points: list[MarketPointResponse]

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
    parent_id: Optional[int] = None
    type: Optional[str] = None
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

    model_config = ConfigDict(from_attributes=True)


class VacancyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    department_id: int = Field(..., gt=0)
    location: Optional[str] = Field(None, max_length=255)
    planned_count: int = Field(1, ge=1)
    status: str = Field("Draft", min_length=1, max_length=100)
    priority: str = Field("Medium", min_length=1, max_length=100)
    assignee_id: Optional[int] = Field(None, gt=0)
    position_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=10000)
    salary_from: Optional[int] = Field(None, ge=0)
    salary_to: Optional[int] = Field(None, ge=0)


class VacancyUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[int] = Field(None, gt=0)
    location: Optional[str] = Field(None, max_length=255)
    planned_count: Optional[int] = Field(None, ge=1)
    status: Optional[str] = Field(None, min_length=1, max_length=100)
    priority: Optional[str] = Field(None, min_length=1, max_length=100)
    assignee_id: Optional[int] = Field(None, gt=0)
    position_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=10000)
    salary_from: Optional[int] = Field(None, ge=0)
    salary_to: Optional[int] = Field(None, ge=0)


class VacancyStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=100)


class VacancyResponse(BaseModel):
    id: int
    title: str
    department_id: int
    location: Optional[str] = None
    planned_count: int
    status: str
    priority: str
    creator_id: int
    assignee_id: Optional[int] = None
    created_at: str
    position_name: Optional[str] = None
    description: Optional[str] = None
    salary_from: Optional[int] = None
    salary_to: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CandidateCreate(BaseModel):
    vacancy_id: int = Field(..., gt=0)
    first_name: str = Field(..., min_length=1, max_length=200)
    last_name: str = Field(..., min_length=1, max_length=200)
    stage: str = Field("New", min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)


class CandidateUpdate(BaseModel):
    vacancy_id: Optional[int] = Field(None, gt=0)
    first_name: Optional[str] = Field(None, min_length=1, max_length=200)
    last_name: Optional[str] = Field(None, min_length=1, max_length=200)
    stage: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    resume_url: Optional[str] = Field(None, max_length=1024)


class CandidateStageUpdate(BaseModel):
    stage: str = Field(..., min_length=1, max_length=100)

class CandidateNotifyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)

class CandidateResponse(BaseModel):
    id: int
    vacancy_id: int
    first_name: str
    last_name: str
    stage: str
    created_at: str
    phone: Optional[str] = None
    email: Optional[str] = None
    resume_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CommentCreate(BaseModel):
    target_type: Literal["vacancy", "candidate"]
    target_id: int = Field(..., gt=0)
    content: str = Field(..., min_length=1, max_length=5000)


class CommentResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    author_id: int
    content: str
    is_system: bool
    created_at: str
    author_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ApprovalStepBase(BaseModel):
    step_order: int
    role_id: Optional[int] = None
    user_id: Optional[int] = None # New!
    label: str
    is_final: bool = False
    step_type: str = "approval" # 'approval', 'notification'
    notify_on_completion: bool = False
    condition_type: Optional[str] = None
    condition_amount: Optional[int] = None

class ApprovalStepCreate(ApprovalStepBase):
    pass

class ApprovalStepResponse(ApprovalStepBase):
    id: int
    role_name: Optional[str] = None
    user_name: Optional[str] = None # New!

    model_config = ConfigDict(from_attributes=True)

class RequestHistoryResponse(BaseModel):
    id: int
    step_label: Optional[str]
    actor_name: str
    actor_role: Optional[str] = None
    actor_branch: Optional[str] = None
    action: str
    comment: Optional[str]
    created_at: str

    model_config = ConfigDict(from_attributes=True)

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

# Job Offers
class CustomSection(BaseModel):
    title: str
    content: str

class WelcomeContent(BaseModel):
    video_url: Optional[str] = None
    office_tour_images: Optional[List[str]] = []
    address: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    first_day_instructions: Optional[List[str]] = []
    merch_info: Optional[str] = None
    team_leader_name: Optional[str] = None
    team_leader_photo: Optional[str] = None
    team_leader_message: Optional[str] = None

class Signatory(BaseModel):
    title: str
    name: str

class JobOfferCreate(BaseModel):
    candidate_name: str = Field(..., min_length=1, max_length=200)
    candidate_email: Optional[str] = Field(None, max_length=254)
    candidate_phone: Optional[str] = Field(None, max_length=30)
    position_title: str = Field(..., min_length=1, max_length=200)
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    base_net: int = Field(..., ge=0)
    kpi_net: int = Field(0, ge=0)
    bonus_net: int = Field(0, ge=0)
    valid_until: Optional[str] = None
    company_name: Optional[str] = Field("Наша Компания", max_length=200)
    manager_name: Optional[str] = Field(None, max_length=200)
    benefits: List[str] = []
    
    # Customization
    welcome_text: Optional[str] = Field(None, max_length=5000)
    description_text: Optional[str] = Field(None, max_length=5000)
    theme_color: Optional[str] = Field("#2563eb", max_length=20)
    custom_sections: Optional[List[CustomSection]] = []
    
    # Formal Fields
    probation_period: Optional[str] = Field("3 месяца", max_length=100)
    working_hours: Optional[str] = Field("09:00 - 18:00", max_length=100)
    lunch_break: Optional[str] = Field("13:00 - 14:00", max_length=100)
    non_compete_text: Optional[str] = Field(None, max_length=5000)
    president_name: Optional[str] = Field(None, max_length=200)
    hr_name: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = None
    signatories: Optional[List[Signatory]] = []
    welcome_content: Optional[WelcomeContent] = None
    welcome_page_config_id: Optional[int] = None  # ID конфига Welcome Page; бэкенд снапшотит его в welcome_content

    @field_validator("theme_color")
    @classmethod
    def validate_theme_color(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not re.fullmatch(r"^#[0-9a-fA-F]{6}$", value):
            raise ValueError("theme_color must match #RRGGBB")
        return value

class JobOfferResponse(BaseModel):
    id: int
    token: str
    candidate_name: str
    position_title: str
    base_net: int
    kpi_net: int
    bonus_net: int
    status: str
    created_at: str
    valid_until: Optional[str] = None
    candidate_phone: Optional[str] = None
    # NOTE: access_code (PIN) is intentionally excluded from this response schema
    # to prevent PIN leakage via listing endpoints. Retrieve it only via admin-only endpoints.
    
    # Customization
    welcome_text: Optional[str] = None
    description_text: Optional[str] = None
    theme_color: Optional[str] = None
    custom_sections: Optional[List[CustomSection]] = []
    
    # Formal Fields
    probation_period: Optional[str] = None
    working_hours: Optional[str] = None
    lunch_break: Optional[str] = None
    non_compete_text: Optional[str] = None
    president_name: Optional[str] = None
    hr_name: Optional[str] = None
    start_date: Optional[str] = None
    signatories: Optional[List[Signatory]] = []
    welcome_content: Optional[WelcomeContent] = None

    model_config = ConfigDict(from_attributes=True)


class JobOfferDetailResponse(JobOfferResponse):

    access_code: Optional[str] = None
    candidate_email: Optional[str] = None


class JobOfferTemplateBase(BaseModel):

    name: str
    company_name: Optional[str] = None
    benefits: List[str] = []
    welcome_text: Optional[str] = None
    description_text: Optional[str] = None
    theme_color: Optional[str] = "#2563eb"
    custom_sections: Optional[List[CustomSection]] = []
    probation_period: Optional[str] = "3 месяца"
    working_hours: Optional[str] = "09:00 - 18:00"
    lunch_break: Optional[str] = "13:00 - 14:00"
    non_compete_text: Optional[str] = None
    signatories: Optional[List[Signatory]] = []
    welcome_content: Optional[WelcomeContent] = None

class JobOfferTemplateCreate(JobOfferTemplateBase):
    pass

class JobOfferTemplateUpdate(JobOfferTemplateBase):
    pass

class JobOfferTemplateResponse(JobOfferTemplateBase):
    id: int
    created_at: str

    model_config = ConfigDict(from_attributes=True)
