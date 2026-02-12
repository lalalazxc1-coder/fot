import sqlite3
import json

DB_PATH = "fot_mvp.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Starting Approval Workflow Migration...")
        
        # 1. Create ApprovalSteps table
        print("Creating table: approval_steps")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS approval_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            step_order INTEGER NOT NULL,
            role_id INTEGER REFERENCES roles(id),
            label VARCHAR,
            is_final BOOLEAN DEFAULT 0
        );
        """)
        
        # 2. Create RequestHistory table
        print("Creating table: request_history")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS request_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER REFERENCES salary_requests(id),
            step_id INTEGER REFERENCES approval_steps(id),
            actor_id INTEGER REFERENCES users(id),
            action VARCHAR, -- 'approved', 'rejected', 'created'
            comment VARCHAR,
            created_at VARCHAR
        );
        """)
        
        # 3. Modify salary_requests table
        # We need to add 'current_step_id'
        # SQLite doesn't support adding FK constraints easily on existing tables without recreation, 
        # but we can add the column.
        
        cursor.execute("PRAGMA table_info(salary_requests)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'current_step_id' not in columns:
            print("Adding column 'current_step_id' to salary_requests")
            cursor.execute("ALTER TABLE salary_requests ADD COLUMN current_step_id INTEGER")
        
        # 4. Seed initial steps if empty
        cursor.execute("SELECT count(*) FROM approval_steps")
        if cursor.fetchone()[0] == 0:
            print("Seeding default approval steps...")
            # Try to find common roles
            cursor.execute("SELECT id, name FROM roles")
            roles = {row[1]: row[0] for row in cursor.fetchall()}
            
            # Default chain: 1. Administrator (fallback if no HR/Manager)
            # You should ideally let the user configure this, but we need a valid state.
            admin_id = roles.get('Administrator')
            
            if admin_id:
                cursor.execute("INSERT INTO approval_steps (step_order, role_id, label, is_final) VALUES (?, ?, ?, ?)", 
                               (1, admin_id, 'Admin Approval', 1))
        
        conn.commit()
        print("Migration successful.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
