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
class OrgUnitCreate(BaseModel):
    name: str
    type: str 
    parent_id: Optional[int] = None

# Employees
class EmployeeCreate(BaseModel):
    full_name: str
    position_title: str
    branch_id: int
    department_id: Optional[int] = None
    # Financials (Pairs)
    base_net: float = 0
    base_gross: float = 0
    
    kpi_net: float = 0
    kpi_gross: float = 0
    
    bonus_net: float = 0
    bonus_gross: float = 0
    
    status: str = "Активен"

class FinancialUpdate(BaseModel):
    base_net: Optional[float] = None
    base_gross: Optional[float] = None
    
    kpi_net: Optional[float] = None
    kpi_gross: Optional[float] = None
    
    bonus_net: Optional[float] = None
    bonus_gross: Optional[float] = None
    
class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
