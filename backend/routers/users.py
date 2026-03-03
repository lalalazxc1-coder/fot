from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
from pathlib import Path
import os
import uuid

from database.database import get_db
from database.models import User, OrganizationUnit
from schemas import UserCreate, UserUpdate, UserProfileUpdate
from dependencies import require_admin, get_current_active_user
from security import get_password_hash  # Single source of truth
from services.auth_service import AuthService  # FIX A4/A5: Password validation

router = APIRouter(prefix="/api/users", tags=["users"])

AVATAR_MAX_SIZE = 5 * 1024 * 1024
ALLOWED_AVATAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _resolve_uploads_dir() -> Path:
    configured = os.environ.get("UPLOADS_DIR")
    if configured:
        return Path(configured)
    backend_dir = Path(__file__).resolve().parents[1]
    return backend_dir / "uploads"


def _serialize_auth_user(user: User):
    role_name = user.role_rel.name if user.role_rel else "No Role"
    perms = (user.role_rel.permissions or {}) if user.role_rel else {}
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "contact_email": user.contact_email,
        "phone": user.phone,
        "role": role_name,
        "permissions": perms,
        "employee_id": user.employee_id,
        "scope_branches": user.scope_branches or [],
        "scope_departments": user.scope_departments or [],
        "avatar_url": user.avatar_url,
        "job_title": user.job_title,
    }


def _delete_local_avatar_if_possible(avatar_url: str | None) -> None:
    if not avatar_url or not avatar_url.startswith("/uploads/avatars/"):
        return

    uploads_dir = _resolve_uploads_dir()
    old_file = uploads_dir / Path(avatar_url).relative_to("/uploads")
    if old_file.exists() and old_file.is_file():
        try:
            old_file.unlink()
        except OSError:
            pass


async def _save_avatar_for_user(file: UploadFile, user: User, db: Session) -> None:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Поддерживаются только JPG, PNG, WEBP или GIF")

    original_name = file.filename or ""
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        ext_by_type = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        ext = ext_by_type.get(content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Некорректный формат файла")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Файл пуст")
    if len(raw) > AVATAR_MAX_SIZE:
        raise HTTPException(status_code=400, detail="Максимальный размер файла: 5MB")

    uploads_dir = _resolve_uploads_dir()
    avatars_dir = uploads_dir / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)

    generated_name = f"user_{user.id}_{uuid.uuid4().hex[:8]}{ext}"
    destination = avatars_dir / generated_name
    destination.write_bytes(raw)

    previous_avatar = user.avatar_url
    user.avatar_url = f"/uploads/avatars/{generated_name}"
    db.commit()

    _delete_local_avatar_if_possible(previous_avatar)

@router.get("", dependencies=[Depends(require_admin)])
def get_users(db: Session = Depends(get_db)):
    # Optimized: Use joinedload for role to avoid N+1
    users = db.scalars(
        select(User).options(joinedload(User.role_rel), joinedload(User.employee))
    ).all()
    
    res = []
    
    # Pre-fetch units for name resolution
    units = db.scalars(select(OrganizationUnit)).all()
    unit_map = {u.id: u.name for u in units}
    
    for u in users:
        scope_str = "Все филиалы"
        
        if u.scope_branches:
            branch_names = [unit_map.get(int(bid), str(bid)) for bid in u.scope_branches if str(bid).isdigit()]
            scope_str = ", ".join(branch_names)
            if u.scope_departments:
                 dept_names = [unit_map.get(int(did), str(did)) for did in u.scope_departments if str(did).isdigit()]
                 scope_str += f" ({', '.join(dept_names)})"
        
        res.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "job_title": u.job_title,
            "contact_email": u.contact_email,
            "phone": u.phone,
            "role_name": u.role_rel.name if u.role_rel else "No Role",
            "role_id": u.role_id,
            "employee_id": u.employee_id,
            "employee_name": u.employee.full_name if u.employee else None,
            "scope_branches": u.scope_branches,
            "scope_departments": u.scope_departments,
            "scope_unit_name": scope_str,
            "is_active": u.is_active
        })
    return res

@router.post("", dependencies=[Depends(require_admin)])
def create_user(u: UserCreate, db: Session = Depends(get_db)):
    if db.scalars(select(User).filter_by(email=u.email)).first():
        raise HTTPException(400, "Email already registered")
    
    # FIX A4: Validate password strength before hashing
    AuthService._validate_password_strength(u.password)
    
    # Secure: Hash password before saving
    hashed = get_password_hash(u.password)
        
    new_user = User(
        email=u.email, 
        full_name=u.full_name, 
        hashed_password=hashed, 
        job_title=u.job_title,
        contact_email=u.contact_email,
        phone=u.phone,
        role_id=u.role_id,
        employee_id=u.employee_id,
        scope_branches=u.scope_branches or [],
        scope_departments=u.scope_departments or [],
        is_active=u.is_active
    )
    db.add(new_user)
    db.commit()
    return {"status": "ok"}

@router.put("/me/profile")
def update_my_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    current_user.full_name = payload.full_name.strip()
    current_user.job_title = payload.job_title.strip() if payload.job_title else None
    current_user.contact_email = payload.contact_email.strip() if payload.contact_email else None
    current_user.phone = payload.phone.strip() if payload.phone else None
    db.commit()
    db.refresh(current_user)
    return _serialize_auth_user(current_user)


@router.delete("/me/avatar")
def delete_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    previous_avatar = current_user.avatar_url
    current_user.avatar_url = None
    db.commit()

    if previous_avatar and previous_avatar.startswith("/uploads/avatars/"):
        uploads_dir = _resolve_uploads_dir()
        old_file = uploads_dir / Path(previous_avatar).relative_to("/uploads")
        if old_file.exists() and old_file.is_file():
            try:
                old_file.unlink()
            except OSError:
                pass

    db.refresh(current_user)
    return _serialize_auth_user(current_user)


@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await _save_avatar_for_user(file=file, user=current_user, db=db)

    db.refresh(current_user)
    return _serialize_auth_user(current_user)


@router.post("/{user_id}/avatar", dependencies=[Depends(require_admin)])
async def upload_user_avatar_by_admin(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    await _save_avatar_for_user(file=file, user=user, db=db)

    db.refresh(user)
    return {"status": "updated", "avatar_url": user.avatar_url}


@router.delete("/{user_id}/avatar", dependencies=[Depends(require_admin)])
def delete_user_avatar_by_admin(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    previous_avatar = user.avatar_url
    user.avatar_url = None
    db.commit()

    _delete_local_avatar_if_possible(previous_avatar)

    return {"status": "updated", "avatar_url": None}


@router.put("/{user_id}", dependencies=[Depends(require_admin)])
def update_user(user_id: int, u: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user: raise HTTPException(404, "User not found")

    user.email = u.email
    user.full_name = u.full_name
    user.job_title = u.job_title
    user.contact_email = u.contact_email
    user.phone = u.phone
    user.role_id = u.role_id
    user.employee_id = u.employee_id
    
    user.scope_branches = u.scope_branches or []
    user.scope_departments = u.scope_departments or []
    user.is_active = u.is_active

    if u.password:
        # FIX A5: Validate password strength before hashing
        AuthService._validate_password_strength(u.password)
        # Secure: Hash new password
        user.hashed_password = get_password_hash(u.password)
    
    db.commit()
    return {"status": "updated"}


@router.delete("/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    db.delete(user)
    db.commit()
    return {"status": "deleted"}

@router.patch("/{user_id}/toggle_block", dependencies=[Depends(require_admin)])
def toggle_block_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user: raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"status": "updated", "is_active": user.is_active}
