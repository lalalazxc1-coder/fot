from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
try:
    from utils.date_utils import now_iso
except ImportError:
    # Fallback если запускается из другого контекста
    def now_iso(): return datetime.utcnow().isoformat()

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    permissions = Column(JSON, default=dict)
    users = relationship("User", back_populates="role_rel")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    avatar_url = Column(String, nullable=True)
    job_title = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True) 
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True) 
    
    # NEW: Data Scope (Multi-select)
    # scope_unit_id is deprecated
    scope_branches = Column(JSON, default=list)      # List of Branch IDs
    scope_departments = Column(JSON, default=list)   # List of Department IDs
    
    is_active = Column(Boolean, default=True)
    
    role_rel = relationship("Role", back_populates="users")
    employee = relationship("Employee")

class OrganizationUnit(Base):
    __tablename__ = "organization_units"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("organization_units.id", use_alter=True, name="fk_organization_units_parent_id"), nullable=True)
    
    parent = relationship("OrganizationUnit", remote_side=[id])
    children = relationship("OrganizationUnit", back_populates="parent")

    # New: Head of Unit
    head_id = Column(Integer, ForeignKey("employees.id", use_alter=True, name="fk_organization_units_head_id"), nullable=True)
    head = relationship("Employee", foreign_keys=[head_id])

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    grade = Column(Integer, default=1)

class AnalyticsConfig(Base):
    __tablename__ = 'analytics_config'
    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(255), nullable=False)
    description = Column(String(255))

class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_org_unit_id", "org_unit_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    gender = Column(String, nullable=True) # New
    dob = Column(String, nullable=True)    # New
    position_id = Column(Integer, ForeignKey("positions.id"))
    org_unit_id = Column(Integer, ForeignKey("organization_units.id"))
    status = Column(String)
    schedule = Column(String)
    hire_date = Column(String, nullable=True)
    dismissal_date = Column(String, nullable=True) # New
    dismissal_reason = Column(String, nullable=True) # New
    
    position = relationship("Position")
    org_unit = relationship("OrganizationUnit", foreign_keys=[org_unit_id])
    financial_records = relationship("FinancialRecord", back_populates="employee")

class FinancialRecord(Base):
    __tablename__ = "financial_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    created_at = Column(String, default=lambda: datetime.now().isoformat())
    last_raise_date = Column(String, nullable=True)  # FIX #M5: отдельное поле для даты повышения зарплаты
    created_at_dt = Column(DateTime(timezone=True), nullable=True)
    last_raise_date_dt = Column(DateTime(timezone=True), nullable=True)
    month = Column(String)
    
    # Base Salary
    base_net = Column(Integer, default=0)
    base_gross = Column(Integer, default=0)

    # KPI
    kpi_net = Column(Integer, default=0)
    kpi_gross = Column(Integer, default=0)

    # Bonus / Additional
    bonus_net = Column(Integer, default=0)
    bonus_gross = Column(Integer, default=0)

    # Totals (Calculated or stored)
    total_net = Column(Integer, default=0)
    total_gross = Column(Integer, default=0)

    # Deprecated / Legacy support (keeping to avoid immediate breaks, but will ignore in logic)
    base_salary = Column(Integer, default=0)
    kpi_amount = Column(Integer, default=0)
    additional_payments = Column(JSON, default=dict)
    salary_gross = Column(Integer, default=0)
    salary_net = Column(Integer, default=0)
    total_payment = Column(Integer, default=0)
    
    employee = relationship("Employee", back_populates="financial_records")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_target_entity_id", "target_entity", "id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    target_entity = Column(String)
    target_entity_id = Column(Integer)
    timestamp = Column(String)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String, nullable=True)   # NEW: IP пользователя
    user_agent = Column(String, nullable=True)   # NEW: браузер/устройство

    user = relationship("User")


class LoginLog(Base):
    """Лог событий входа/выхода — кто, когда, с какого IP и устройства."""
    __tablename__ = "login_logs"
    __table_args__ = (
        Index("ix_login_logs_action_id", "action", "id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable — для failed login
    user_email = Column(String, nullable=True)     # логин при попытке (даже если не нашёл)
    action = Column(String)                         # 'login_success' | 'login_failed' | 'logout'
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    timestamp = Column(String, default=now_iso)

    user = relationship("User")

# NEW: Scenario Planning
class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="draft") # draft, approved, archived
    created_at = Column(String, default=lambda: datetime.now().isoformat())
    
    # Relationship
    planning_positions = relationship("PlanningPosition", back_populates="scenario", cascade="all, delete-orphan")

# NEW: Planning Table Model
class PlanningPosition(Base):
    __tablename__ = "planning_lines"
    __table_args__ = (
        Index("ix_planning_lines_scenario_branch_department", "scenario_id", "branch_id", "department_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    # Scenario Link (Null = Live Budget)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=True)
    scenario = relationship("Scenario", back_populates="planning_positions")
    
    position_title = Column(String, nullable=False)
    
    # Organization
    branch_id = Column(Integer, ForeignKey("organization_units.id"))
    department_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True)
    
    schedule = Column(String)
    count = Column(Integer, default=1)
    bonus_count = Column(Integer, nullable=True) # Кол-во получателей доплаты (null = всем)
    
    # Financials (Per Unit)
    base_net = Column(Integer, default=0)
    base_gross = Column(Integer, default=0)
    kpi_net = Column(Integer, default=0)
    kpi_gross = Column(Integer, default=0)
    bonus_net = Column(Integer, default=0)
    bonus_gross = Column(Integer, default=0)

class SalaryRequest(Base):
    __tablename__ = "salary_requests"
    __table_args__ = (
        Index("ix_salary_requests_status_id", "status", "id"),
        Index("ix_salary_requests_requester_id_id", "requester_id", "id"),
        Index("ix_salary_requests_current_step_id", "current_step_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    type = Column(String) # 'raise', 'bonus'
    current_value = Column(Integer)
    requested_value = Column(Integer)
    reason = Column(String)
    status = Column(String, default="pending") # pending, approved, rejected
    created_at = Column(String)
    created_at_dt = Column(DateTime(timezone=True), nullable=True)
    
    requester = relationship("User", foreign_keys=[requester_id])
    employee = relationship("Employee")
    
    # Approval info
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Last approver or deprecated if using history
    approved_at = Column(String, nullable=True)
    approved_at_dt = Column(DateTime(timezone=True), nullable=True)
    approver = relationship("User", foreign_keys=[approver_id])
    
    # NEW: Workflow state
    current_step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=True)
    current_step = relationship("ApprovalStep")
    history = relationship("RequestHistory", back_populates="request", order_by="RequestHistory.created_at")

class ApprovalStep(Base):
    __tablename__ = "approval_steps"
    id = Column(Integer, primary_key=True, index=True)
    step_order = Column(Integer, nullable=False) # 1, 2, 3...
    role_id = Column(Integer, ForeignKey("roles.id"))
    label = Column(String) # e.g. "HR Manager", "CEO"
    is_final = Column(Boolean, default=False)
    
    # New fields for nuanced workflow
    # is_approver removed in favor of step_type
    
    step_type = Column(String, default="approval") # 'approval', 'notification'
    notify_on_completion = Column(Boolean, default=False) # If true, this role gets a notification when request is fully approved
    
    role = relationship("Role")
    
    # New: Bind to specific user instead of role
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) 
    user = relationship("User")
    
    # NEW: Smart Routing Conditions
    condition_type = Column(String, nullable=True) # e.g. "amount_less_than", "amount_greater_than_or_equal"
    condition_amount = Column(Integer, nullable=True)

class RequestHistory(Base):
    __tablename__ = "request_history"
    __table_args__ = (
        Index("ix_request_history_request_id_id", "request_id", "id"),
        Index("ix_request_history_actor_id_request_id", "actor_id", "request_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("salary_requests.id"))
    step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) # 'created', 'approved', 'rejected'
    comment = Column(String)
    created_at = Column(String)
    created_at_dt = Column(DateTime(timezone=True), nullable=True)
    
    request = relationship("SalaryRequest", back_populates="history")
    actor = relationship("User")
    step = relationship("ApprovalStep")

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_id_is_read_id", "user_id", "is_read", "id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(String)
    created_at_dt = Column(DateTime(timezone=True), nullable=True)
    link = Column(String, nullable=True)
    
    user = relationship("User")


class Vacancy(Base):
    __tablename__ = "vacancies"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("organization_units.id"), nullable=False)
    location = Column(String, nullable=True)
    planned_count = Column(Integer, default=1)
    status = Column(String, default="Draft")
    priority = Column(String, default="Medium")
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(String, default=now_iso)

    department = relationship("OrganizationUnit", foreign_keys=[department_id])
    creator = relationship("User", foreign_keys=[creator_id])
    candidates = relationship("Candidate", back_populates="vacancy", cascade="all, delete-orphan")


class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    vacancy_id = Column(Integer, ForeignKey("vacancies.id"), nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    stage = Column(String, default="New")
    created_at = Column(String, default=now_iso)

    vacancy = relationship("Vacancy", back_populates="candidates")


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_target_type_target_id", "target_type", "target_id"),)

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String, nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    is_system = Column(Boolean, default=False)
    created_at = Column(String, default=now_iso)

    author = relationship("User", foreign_keys=[author_id])

class MarketData(Base):
    __tablename__ = "market_data"
    __table_args__ = (
        Index("ix_market_data_position_title_branch_id", "position_title", "branch_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    position_title = Column(String) # Removed unique=True to allow same title in different branches
    branch_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True) # New: Specific branch
    min_salary = Column(Integer, default=0)
    max_salary = Column(Integer, default=0)
    median_salary = Column(Integer, default=0)
    source = Column(String) # Generic source name or kept for legacy
    updated_at = Column(String)
    updated_at_dt = Column(DateTime(timezone=True), nullable=True)

    branch = relationship("OrganizationUnit")
    entries = relationship("MarketEntry", back_populates="market_data", cascade="all, delete-orphan")

class MarketEntry(Base):
    __tablename__ = "market_entries"
    __table_args__ = (
        Index("ix_market_entries_market_id", "market_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    market_id = Column(Integer, ForeignKey("market_data.id"))
    company_name = Column(String)
    salary = Column(Integer)
    created_at = Column(String)
    created_at_dt = Column(DateTime(timezone=True), nullable=True)
    url = Column(String, nullable=True) # Link to vacancy

    market_data = relationship("MarketData", back_populates="entries")

class SalaryConfiguration(Base):
    __tablename__ = "salary_configuration"  # FIX #L3: переименовано с salary_config_2026
    id = Column(Integer, primary_key=True, index=True)
    
    # Constants
    mrp = Column(Integer, default=4615)      # 2026 Projection
    mzp = Column(Integer, default=100000)    # 2026 Projection
    
    # Rates (percentages as decimals)
    opv_rate = Column(Float, default=0.1)     # Pension
    opvr_rate = Column(Float, default=0.025)  # Employer Pension (2026: 2.5%)
    vosms_rate = Column(Float, default=0.02)  # Health (Employee)
    vosms_employer_rate = Column(Float, default=0.03) # Health (Employer)
    so_rate = Column(Float, default=0.035)    # Social Insurance
    sn_rate = Column(Float, default=0.095)    # Social Tax
    ipn_rate = Column(Float, default=0.1)     # Income Tax
    
    # Limits (multipliers of MZP usually)
    opv_limit_mzp = Column(Integer, default=50) 
    opvr_limit_mzp = Column(Integer, default=50) # Same cap for OPVR
    vosms_limit_mzp = Column(Integer, default=10)
    
    # Deduction
    ipn_deduction_mrp = Column(Integer, default=14)
    
    updated_at = Column(String)
    updated_at_dt = Column(DateTime(timezone=True), nullable=True)
    updated_by = Column(Integer, nullable=True)

class IntegrationSettings(Base):
    __tablename__ = "integration_settings"
    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String, unique=True, index=True) # 'hh', 'openai'
    api_key = Column(String, nullable=True)
    client_id = Column(String, nullable=True)
    client_secret = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)
    additional_params = Column(JSON, default=dict) # For future flexibility
    updated_at = Column(String, default=lambda: datetime.now().isoformat())
    updated_at_dt = Column(DateTime(timezone=True), nullable=True)

class JobOffer(Base):
    __tablename__ = "job_offers"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True) # Unique link token
    
    candidate_name = Column(String, nullable=False)
    candidate_email = Column(String, nullable=True)
    candidate_phone = Column(String, nullable=True) # For security check
    position_title = Column(String, nullable=False)
    access_code = Column(String, nullable=True) # PIN code to open
    
    # Selection of Branch/Dept
    branch_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True)
    
    # Money (Monthly Net)
    base_net = Column(Integer, default=0)
    kpi_net = Column(Integer, default=0)
    bonus_net = Column(Integer, default=0)
    
    valid_until = Column(String, nullable=True)
    status = Column(String, default="pending") # pending, accepted, rejected, expired
    created_at = Column(String, default=lambda: datetime.now().isoformat())
    created_at_dt = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata for the offer page
    company_name = Column(String, nullable=True)
    manager_name = Column(String, nullable=True)
    benefits = Column(JSON, default=list) # List of perks
    
    # New Customization Fields
    welcome_text = Column(String, nullable=True) 
    description_text = Column(String, nullable=True) 
    theme_color = Column(String, default="#2563eb") 
    custom_sections = Column(JSON, default=list)
    
    # Formal Document Fields
    probation_period = Column(String, default="3 месяца")
    working_hours = Column(String, default="09:00 - 18:00")
    lunch_break = Column(String, default="13:00 - 14:00")
    non_compete_text = Column(String, nullable=True)
    president_name = Column(String, nullable=True)
    hr_name = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    
    signatories = Column(JSON, default=list)
    welcome_content = Column(JSON, nullable=True)  # Welcome Experience data

    branch = relationship("OrganizationUnit", foreign_keys=[branch_id])
    department = relationship("OrganizationUnit", foreign_keys=[department_id])

class JobOfferTemplate(Base):
    __tablename__ = "job_offer_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # Template name
    
    # Settings to be copied to the offer
    company_name = Column(String, nullable=True)
    benefits = Column(JSON, default=list)
    welcome_text = Column(String, nullable=True) 
    description_text = Column(String, nullable=True) 
    theme_color = Column(String, default="#2563eb") 
    custom_sections = Column(JSON, default=list)
    
    probation_period = Column(String, default="3 месяца")
    working_hours = Column(String, default="09:00 - 18:00")
    lunch_break = Column(String, default="13:00 - 14:00")
    non_compete_text = Column(String, nullable=True)
    
    signatories = Column(JSON, default=list)
    welcome_content = Column(JSON, nullable=True)  # Welcome Experience data
    created_at = Column(DateTime, default=datetime.utcnow)


class WelcomePageConfig(Base):
    """Самостоятельная конфигурация страницы приветствия, привязанная к филиалу."""
    __tablename__ = "welcome_page_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                                    # Название конфига (для списка)
    branch_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True)  # Привязка к филиалу

    video_url = Column(String, nullable=True)
    office_tour_images = Column(JSON, default=list)
    address = Column(String, nullable=True)
    first_day_instructions = Column(JSON, default=list)
    merch_info = Column(String, nullable=True)
    team_members = Column(JSON, default=list)  # [{name, role, description}]
    company_description = Column(String, nullable=True)  # О компании
    mission = Column(String, nullable=True)               # Миссия
    vision = Column(String, nullable=True)                 # Видение

    created_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("OrganizationUnit", foreign_keys=[branch_id])
