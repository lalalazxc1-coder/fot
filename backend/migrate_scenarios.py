import sqlite3
import datetime

# Migration Script for Scenarios
# 1. Create Scenarios Table
# 2. Add scenario_id to planning_lines

DB_PATH = "c:\\Users\\admin\\Desktop\\project\\fot\\backend\\fot_mvp.db"

def migrate():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Create Scenarios Table
        print("Creating Scenarios table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scenarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR NOT NULL,
                description VARCHAR,
                status VARCHAR DEFAULT 'draft',
                created_at VARCHAR DEFAULT (datetime('now'))
            )
        """)
        
        # 2. Add scenario_id to planning_lines if not exists
        print("Checking planning_lines for scenario_id...")
        cursor.execute("PRAGMA table_info(planning_lines)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'scenario_id' not in columns:
            print("Adding scenario_id column to planning_lines...")
            cursor.execute("ALTER TABLE planning_lines ADD COLUMN scenario_id INTEGER REFERENCES scenarios(id)")
            print("Set existing records to scenario_id = NULL (Live Budget)")
        else:
            print("scenario_id already exists.")
            
        conn.commit()
        conn.close()
        print("Migration complete.")
        
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
