import sqlite3

DB_PATH = "fot_mvp.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Migrating Approval Workflow: adding user_id...")
        
        # Check existing columns
        cursor.execute("PRAGMA table_info(approval_steps)")
        cols = [c[1] for c in cursor.fetchall()]

        if 'user_id' not in cols:
            print("Adding 'user_id'...")
            cursor.execute("ALTER TABLE approval_steps ADD COLUMN user_id INTEGER REFERENCES users(id)")

        conn.commit()
        print("Migration successful.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
