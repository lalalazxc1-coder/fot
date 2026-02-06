from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
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

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    grade = Column(Integer, default=1)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    position_id = Column(Integer, ForeignKey("positions.id"))
    org_unit_id = Column(Integer, ForeignKey("organization_units.id"))
    status = Column(String)
    schedule = Column(String)
    hire_date = Column(String, nullable=True) # New field
    
    position = relationship("Position")
    org_unit = relationship("OrganizationUnit")
    financial_records = relationship("FinancialRecord", back_populates="employee")

class FinancialRecord(Base):
    __tablename__ = "financial_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
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

# NEW: Planning Table Model
class PlanningPosition(Base):
    __tablename__ = "planning_lines"
    id = Column(Integer, primary_key=True, index=True)
    
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
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(String, nullable=True)
    approver = relationship("User", foreign_keys=[approver_id])

class MarketData(Base):
    __tablename__ = "market_data"
    id = Column(Integer, primary_key=True, index=True)
    position_title = Column(String, unique=True)
    min_salary = Column(Integer)
    max_salary = Column(Integer)
    median_salary = Column(Integer)
    source = Column(String)
    updated_at = Column(String)
