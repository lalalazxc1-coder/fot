from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User
from security import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
        
    from sqlalchemy.orm import joinedload
    user = db.query(User).options(joinedload(User.role_rel)).get(user_id)
    if user is None:
        raise credentials_exception
        
    return user

def get_current_active_user(user: User = Depends(get_current_user)):
    return user

def require_admin(user: User = Depends(get_current_active_user)):
    # Check for Administrator role OR 'admin_access' permission
    is_admin = False
    
    # Check Role Name
    if user.role_rel and user.role_rel.name == "Administrator":
        is_admin = True
        
    # Check Permission key
    if user.role_rel and user.role_rel.permissions and user.role_rel.permissions.get('admin_access'):
        is_admin = True
        
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

class PermissionChecker:
    def __init__(self, permission_key: str):
        self.permission_key = permission_key

    def __call__(self, user: User = Depends(get_current_active_user)):
        # Check for Administrator role
        if user.role_rel and user.role_rel.name == "Administrator":
            return True
            
        # Check for 'admin_access' (Super Admin)
        perms = user.role_rel.permissions if user.role_rel else {}
        if perms.get('admin_access'):
            return True
            
        # Check specific permission
        if perms.get(self.permission_key):
            return True
            
        raise HTTPException(status_code=403, detail=f"Permission '{self.permission_key}' required")

def get_user_scope(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    """
    Returns a list of allowed OrganizationUnit IDs for the current user.
    If the user is an Admin or has 'admin_access', returns None (indicating Full Access).
    """
    # 1. Check Admin / Super Admin
    is_super = False
    if user.role_rel:
        if user.role_rel.name == 'Administrator': is_super = True
        if user.role_rel.permissions.get('admin_access'): is_super = True
    
    if is_super:
        return None # All access
        
    # 2. Calculate Scope
    allowed_ids = []
    
    # If no scope defined, return empty list (No access)
    if not user.scope_branches and not user.scope_departments:
        return []

    # Ensure we have a set of ints for departments
    user_dept_ids = set()
    if user.scope_departments:
        user_dept_ids = {int(x) for x in user.scope_departments}
        
    from database.models import OrganizationUnit # Deferred import to avoid circular dep if any

    if user.scope_branches:
        for bid_raw in user.scope_branches:
            bid = int(bid_raw)
            
            # Get Departments of this branch
            depts = db.query(OrganizationUnit).filter_by(parent_id=bid, type="department").all()
            dept_ids = {d.id for d in depts}
            
            intersection = user_dept_ids.intersection(dept_ids)
            if intersection:
                # User has specific departments in this branch -> Limit to ONLY those departments
                allowed_ids.extend(list(intersection))
            else:
                # User has NO specific departments -> Full Access to Branch
                allowed_ids.append(bid) # Branch Itself
                allowed_ids.extend(list(dept_ids)) # All Departments
    
    # Add standalone departments if any (though usually they are under a branch scope)
    # logic in original code mainly iterated branches. 
    # If a user has ONLY departments without branch scope, the original code might have missed it 
    # if it relied on iterating scope_branches. 
    # We will stick to the original logic for now to avoid breaking behavior, but cleaned up.
    
    return allowed_ids
