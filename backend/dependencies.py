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
    user = db.query(User).options(joinedload(User.role_rel)).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
        
    return user

def get_current_active_user(user: User = Depends(get_current_user)):
    return user

def require_admin(user: User = Depends(get_current_active_user)):
    # Check for Administrator role OR 'admin_access' permission
    is_admin = False
    
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
    if user.role_rel and user.role_rel.permissions and user.role_rel.permissions.get('admin_access'):
        is_super = True
    
    if is_super:
        return None # All access
        
    # 3. Simplify & Robustify Logic
    # We want a set of allowed OrganizationUnit IDs to avoid duplicates.
    allowed_ids = set()

    user_dept_ids = {int(x) for x in user.scope_departments} if user.scope_departments else set()
    user_branch_ids = {int(x) for x in user.scope_branches} if user.scope_branches else set()

    # Always allow explicitly assigned departments
    for d_id in user_dept_ids:
         allowed_ids.add(d_id)
    
    if user_branch_ids:
        from database.models import OrganizationUnit
        
        for b_id in user_branch_ids:
            # Fetch all departments of this branch
            branch_depts = db.query(OrganizationUnit).filter_by(parent_id=b_id, type="department").all()
            branch_dept_ids = {d.id for d in branch_depts}
            
            intersection = user_dept_ids.intersection(branch_dept_ids)
            
            if intersection:
                # User has specific departments selected in THIS branch.
                # Strictly limit to these departments. DO NOT ADD the branch itself (so they don't see branch directors).
                # (The structure.py API will automatically load parent branches for the UI tree instead).
                pass 
            elif not user_dept_ids:
                # User has NO specific departments selected anywhere. Thus, they get FULL access to this branch.
                allowed_ids.add(b_id)
                allowed_ids.update(branch_dept_ids)
            else:
                # User has specific departments, but NONE of them are in this branch.
                # Assuming this means they get FULL access to this branch, and restricted access to others.
                allowed_ids.add(b_id)
                allowed_ids.update(branch_dept_ids)

    # Note: if a user ONLY has departments and no branches, those departments are granted via user_dept_ids above.
    return list(allowed_ids)
