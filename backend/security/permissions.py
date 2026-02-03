from fastapi import Depends, HTTPException, status
from typing import Optional, List
from .models import User, UserRole, OrganizationUnit
# Assuming we have a get_current_user dependency that decodes JWT
# from .auth import get_current_user 

class RBACMiddleware:
    """
    Middleware/Dependency logic for Role-Based Access Control.
    Access is determined by:
    1. Global Role (Admin has all access)
    2. Hierarchical Scope (Regional Manager -> Region, Warehouse Head -> Warehouse)
    """

    def __init__(self, required_roles: List[UserRole]):
        self.required_roles = required_roles

    def __call__(self, 
                 # target_org_unit_id: Optional[int] = None, # Passed via query param or path
                 user: User = Depends(get_current_user_stub) # Dependency injection of user
                 ):
        
        # 1. Check if user has one of the allowed roles
        if user.role not in self.required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role privileges"
            )

        # 2. If 'Admin', allow everything
        if user.role == UserRole.ADMIN:
            return True

        # 3. For scoped roles, verify access to the specific resource
        # Note: In a real request, the target resource ID comes from path/query params. 
        # Here we mock the context extraction.
        target_unit_id = self._get_target_unit_from_request()
        
        if not target_unit_id:
            # If no specific unit is targeted (e.g. list view), 
            # the controller should filter the results based on user.assigned_unit_id
            return True 

        if not self._check_scope_access(user, target_unit_id):
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access to this organizational unit is denied"
            )
        
        # 4. HR/Accountant - generic read only check usually handled by method (GET vs POST)
        if user.role == UserRole.HR_ACCOUNTANT:
            # Usually handled by endpoint definition (only allowing GET), 
            # but can be enforced here if needed.
            pass

        return True

    def _check_scope_access(self, user: User, target_unit_id: int) -> bool:
        """
        Verifies if the target_unit_id falls within the user's assigned scope.
        This often requires a DB lookup to check hierarchy.
        """
        # Logic:
        # If Regional Manager: target_unit must be in the same region as user.assigned_unit
        # If Warehouse Head: target_unit must be the assigned_unit or a child (department) of it.
        
        if user.role == UserRole.REGIONAL_MANAGER:
            # Pseudo-code: return db.query(OrgUnit).get(target_unit_id).region_id == user.assigned_unit.region_id
            return True # Simplified
            
        if user.role == UserRole.WAREHOUSE_HEAD:
            # Pseudo-code: return target_unit_id == user.assigned_unit_id or target_unit.parent_id == user.assigned_unit_id
            return True # Simplified

        return False

    def _get_target_unit_from_request(self):
        # Implementation to extract 'branch_id' or 'warehouse_id' from Request object
        return 1

# --- Usage Example in FastAPI Router ---
# 
# @router.patch("/kpi/{employee_id}")
# async def update_kpi(
#     employee_id: int, 
#     data: KPIData, 
#     user: User = Depends(get_current_user),
#     access: bool = Depends(RBACMiddleware(allowed_roles=[UserRole.ADMIN, UserRole.WAREHOUSE_HEAD]))
# ):
#     ...

def get_current_user_stub():
    # Placeholder for actual auth dependency
    return User(role=UserRole.ADMIN, id=1, assigned_unit_id=None)
