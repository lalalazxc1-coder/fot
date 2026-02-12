import sqlite3

DB_PATH = "fot_mvp.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Migrating Approval Workflow: adding notification fields...")
        
        # Check existing columns
        cursor.execute("PRAGMA table_info(approval_steps)")
        cols = [c[1] for c in cursor.fetchall()]
        
        if 'notify_on_completion' not in cols:
            print("Adding 'notify_on_completion'...")
            cursor.execute("ALTER TABLE approval_steps ADD COLUMN notify_on_completion BOOLEAN DEFAULT 0")
            
        if 'step_type' not in cols:
            print("Adding 'step_type'...")
            cursor.execute("ALTER TABLE approval_steps ADD COLUMN step_type VARCHAR DEFAULT 'approval'")

        # Create Notifications table if not exists (simple)
        print("Creating 'notifications' table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            message VARCHAR,
            is_read BOOLEAN DEFAULT 0,
            created_at VARCHAR,
            link VARCHAR
        );
        """)

        conn.commit()
        print("Migration successful.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
