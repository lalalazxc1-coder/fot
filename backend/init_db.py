import sys
import os
from sqlalchemy.orm import Session

# 1. Setup path to import backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from security import get_password_hash
from database.database import engine, SessionLocal, Base
from database.models import User, Role

def init_db():
    print("Connecting to database...")
    db = SessionLocal()
    try:
        # Create Tables if they don't exist
        Base.metadata.create_all(bind=engine)
        print("Tables checked/created.")
        
        # 1. Create/Update Admin Role
        admin_role_name = "Administrator"
        # New permissions structure
        admin_perms = {
            "add_employees": True,
            "edit_financials": True,
            "admin_access": True
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
        
        # 2. Create/Update Admin User
        admin_email = "admin"
        admin_pass = "admin"
        
        admin_user = db.query(User).filter_by(email=admin_email).first()
        if not admin_user:
            print(f"Creating User: {admin_email}")
            admin_user = User(
                email=admin_email, 
                full_name="System Administrator", 
                hashed_password=get_password_hash(admin_pass), 
                role_id=admin_role.id,
                scope_unit_id=None # Full access (no scope restriction)
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            # Check if password needs re-hashing (simple check: if it equals "admin", it's legacy)
            if admin_user.hashed_password == "admin":
                 print("Migrating Admnin password to Hash...")
                 admin_user.hashed_password = get_password_hash(admin_pass)

            # Ensure properties
            admin_user.role_id = admin_role.id
            admin_user.scope_unit_id = None 
            db.commit()
            print("Admin user updated.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()
        print("Done.")

if __name__ == "__main__":
    init_db()
