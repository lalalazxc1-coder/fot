from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    permissions = Column(JSON, default={}) 
    users = relationship("User", back_populates="role_rel")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True) 
    
    # NEW: Data Scope (Multi-select)
    # scope_unit_id is deprecated
    scope_branches = Column(JSON, default=[])      # List of Branch IDs
    scope_departments = Column(JSON, default=[])   # List of Department IDs
    
    role_rel = relationship("Role", back_populates="users")
    # scope_unit = relationship("OrganizationUnit") # Removed single relationship

class OrganizationUnit(Base):
    __tablename__ = "organization_units"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True)
    
    parent = relationship("OrganizationUnit", remote_side=[id])
    children = relationship("OrganizationUnit", back_populates="parent")

    # New: Head of Unit
    head_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    head = relationship("Employee", foreign_keys=[head_id])

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    grade = Column(Integer, default=1)

class Employee(Base):
    __tablename__ = "employees"
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
    created_at = Column(String, default=lambda: datetime.now().isoformat()) # New: For timeline reconstruction
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
    additional_payments = Column(JSON, default={})
    salary_gross = Column(Integer, default=0)
    salary_net = Column(Integer, default=0)
    total_payment = Column(Integer, default=0)
    
    employee = relationship("Employee", back_populates="financial_records")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    target_entity = Column(String)
    target_entity_id = Column(Integer)
    timestamp = Column(String) 
    old_values = Column(JSON)
    new_values = Column(JSON)
    
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
    
    # Financials (Per Unit)
    base_net = Column(Integer, default=0)
    base_gross = Column(Integer, default=0)
    kpi_net = Column(Integer, default=0)
    kpi_gross = Column(Integer, default=0)
    bonus_net = Column(Integer, default=0)
    bonus_gross = Column(Integer, default=0)

class SalaryRequest(Base):
    __tablename__ = "salary_requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    type = Column(String) # 'raise', 'bonus'
    current_value = Column(Integer)
    requested_value = Column(Integer)
    reason = Column(String)
    status = Column(String, default="pending") # pending, approved, rejected
    created_at = Column(String)
    
    requester = relationship("User", foreign_keys=[requester_id])
    employee = relationship("Employee")
    
    # Approval info
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Last approver or deprecated if using history
    approved_at = Column(String, nullable=True)
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
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("salary_requests.id"))
    step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) # 'created', 'approved', 'rejected'
    comment = Column(String)
    created_at = Column(String)
    
    request = relationship("SalaryRequest", back_populates="history")
    actor = relationship("User")
    step = relationship("ApprovalStep")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(String)
    link = Column(String, nullable=True)
    
    user = relationship("User")

class MarketData(Base):
    __tablename__ = "market_data"
    id = Column(Integer, primary_key=True, index=True)
    position_title = Column(String) # Removed unique=True to allow same title in different branches
    branch_id = Column(Integer, ForeignKey("organization_units.id"), nullable=True) # New: Specific branch
    min_salary = Column(Integer, default=0)
    max_salary = Column(Integer, default=0)
    median_salary = Column(Integer, default=0)
    source = Column(String) # Generic source name or kept for legacy
    updated_at = Column(String)

    branch = relationship("OrganizationUnit")
    entries = relationship("MarketEntry", back_populates="market_data", cascade="all, delete-orphan")

class MarketEntry(Base):
    __tablename__ = "market_entries"
    id = Column(Integer, primary_key=True, index=True)
    market_id = Column(Integer, ForeignKey("market_data.id"))
    company_name = Column(String)
    salary = Column(Integer)
    created_at = Column(String)
    url = Column(String, nullable=True) # Link to vacancy

    market_data = relationship("MarketData", back_populates="entries")

class SalaryConfiguration(Base):
    __tablename__ = "salary_config_2026"
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
    updated_by = Column(Integer, nullable=True)

class IntegrationSettings(Base):
    __tablename__ = "integration_settings"
    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String, unique=True, index=True) # 'hh', 'openai'
    api_key = Column(String, nullable=True)
    client_id = Column(String, nullable=True)
    client_secret = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)
    additional_params = Column(JSON, default={}) # For future flexibility
    updated_at = Column(String, default=lambda: datetime.now().isoformat())
