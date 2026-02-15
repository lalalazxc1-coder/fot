import sys
import os
import secrets
from sqlalchemy.orm import Session

# 1. Setup path to import backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from security import get_password_hash
from database.database import engine, SessionLocal, Base
from database.models import User, Role


def generate_secure_password(length: int = 16) -> str:
    """Generate a cryptographically secure random password."""
    return secrets.token_urlsafe(length)


def init_db():
    print("Connecting to database...")
    db = SessionLocal()
    try:
        # Create Tables if they don't exist
        Base.metadata.create_all(bind=engine)
        print("Tables checked/created.")

        # 1. Create/Update Admin Role
        admin_role_name = "Administrator"
        admin_perms = {
            "add_employees": True,
            "edit_financials": True,
            "admin_access": True,
            "edit_structure": True,
            "view_structure": True,
            "manage_planning": True,
            "view_market": True,
            "edit_market": True,
        }

        admin_role = db.query(Role).filter_by(name=admin_role_name).first()
        if not admin_role:
            print(f"Creating Role: {admin_role_name}")
            admin_role = Role(name=admin_role_name, permissions=admin_perms)
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)
        else:
            print(f"Updating permissions for existing Role: {admin_role_name}")
            admin_role.permissions = admin_perms
            db.commit()

        # 2. Create Admin User (if not exists)
        admin_email = os.environ.get("ADMIN_EMAIL", "admin")
        admin_user = db.query(User).filter_by(email=admin_email).first()

        if not admin_user:
            # Generate secure password or use env variable
            admin_pass = os.environ.get("ADMIN_PASSWORD")
            if not admin_pass:
                admin_pass = generate_secure_password()
                print("")
                print("=" * 60)
                print("  ADMIN ACCOUNT CREATED")
                print(f"  Login:    {admin_email}")
                print(f"  Password: {admin_pass}")
                print("  ⚠️  SAVE THIS PASSWORD! It will not be shown again.")
                print("=" * 60)
                print("")

            admin_user = User(
                email=admin_email,
                full_name="System Administrator",
                hashed_password=get_password_hash(admin_pass),
                role_id=admin_role.id,
                scope_branches=[],
                scope_departments=[],
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            # Ensure admin role is correct
            admin_user.role_id = admin_role.id
            
            # Auto-migrate plaintext passwords to bcrypt
            if admin_user.hashed_password and not admin_user.hashed_password.startswith("$2"):
                print("Migrating admin password to bcrypt hash...")
                admin_user.hashed_password = get_password_hash(admin_user.hashed_password)

            admin_user.scope_branches = []
            admin_user.scope_departments = []
            db.commit()
            print("Admin user updated.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()
        print("Done.")


if __name__ == "__main__":
    init_db()
