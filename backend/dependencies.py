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
