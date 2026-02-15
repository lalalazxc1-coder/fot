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

    # If user has specific departments assigned, add them.
    if user.scope_departments:
        for d_id in user.scope_departments:
             allowed_ids.add(int(d_id))

    # If user has specific branches assigned, logic depends on policy:
    # Option A: Access to the Branch Unit itself + All its child Departments.
    # Option B: Access to the Branch Unit only (and frontend fetches children).
    # original logic implied: Branch + All Departments, UNLESS intersection with scope_departments found.
    
    if user.scope_branches:
        from database.models import OrganizationUnit
        
        # Pre-fetch all relevant data to avoid N+1 queries ideally, but here we iterate.
        # For each branch in scope:
        for b_id_raw in user.scope_branches:
            b_id = int(b_id_raw)

            
            # Fetch all departments of this branch
            branch_depts = db.query(OrganizationUnit).filter_by(parent_id=b_id, type="department").all()
            branch_dept_ids = {d.id for d in branch_depts}
            
            # If user ALSO has specific departments defined (Global scope_departments):
            # Check if any of those map to THIS branch.
            # If `scope_departments` is non-empty, it usually means "Only these departments".
            # But the original logic tried to do an intersection per branch.
            
            # Refined Logic:
            # If `user.scope_departments` is EMPTY -> User gets ALL departments of this branch.
            # If `user.scope_departments` has values -> We ONLY add those that are in this branch (Intersection).
            # AND we blindly add any other `scope_departments` that might be in other branches (already added above).
            
            # Wait, if I have Branch A and Dept X (which is in Branch A), do I get ALL of Branch A or just X?
            # Usually strict scopes mean "Intersection".
            # But if I have Branch A (Manager) AND Dept Y (in Branch B, as Curator), I expect All A + Y.
            
            # Let's assume:
            # - scope_branches lists branches where I have *some* access.
            # - scope_departments lists specific departments I have access to.
            # - If I have Branch A in scope_branches and NO departments in scope_departments that belong to A, 
            #   do I get potentially ALL A? Or None? 
            #   The original logic said: "User has NO specific departments -> Full Access to Branch".
            
            # Let's recreate that logic but cleaner.
            
            user_dept_ids_set = {int(x) for x in user.scope_departments} if user.scope_departments else set()
            
            # Intersection of User's Depts AND This Branch's Depts
            intersection = user_dept_ids_set.intersection(branch_dept_ids)
            
            if intersection:
                pass
            elif not user_dept_ids_set:
                 allowed_ids.add(b_id)
                 allowed_ids.update(branch_dept_ids)
            else:
                allowed_ids.add(b_id)
                allowed_ids.update(branch_dept_ids)

    return list(allowed_ids)
