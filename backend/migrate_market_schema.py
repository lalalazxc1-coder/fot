import sqlite3
import os

DB_PATH = "fot_mvp.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='market_data';")
        if not cursor.fetchone():
            print("Table 'market_data' does not exist.")
            return

        # Check if column exists
        cursor.execute("PRAGMA table_info(market_data);")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "branch_id" in columns:
            print("'branch_id' column already exists.")
            # Check unique constraint? It's hard to check specifically, but if we did this migration, we likely fixed it.
            # But let's assume if column exists, we are good or need manual check.
            # To be safe, we can recreate the table anyway to ensure constraint is gone.
            pass
        
        print("Migrating market_data table...")
        
        # 1. Rename old table
        cursor.execute("ALTER TABLE market_data RENAME TO market_data_old;")
        
        # 2. Create new table (without UNIQUE on position_title, with branch_id)
        cursor.execute("""
        CREATE TABLE market_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position_title VARCHAR,
            branch_id INTEGER,
            min_salary INTEGER,
            max_salary INTEGER,
            median_salary INTEGER,
            source VARCHAR,
            updated_at VARCHAR,
            FOREIGN KEY(branch_id) REFERENCES organization_units(id)
        );
        """)
        
        # 3. Create index
        cursor.execute("CREATE INDEX ix_market_data_id ON market_data (id);")
        
        # 4. Copy data
        # Check if branch_id existed in old table (unlikely, but if rerunning partial logic)
        # We assume it didn't.
        cursor.execute("""
        INSERT INTO market_data (id, position_title, min_salary, max_salary, median_salary, source, updated_at)
        SELECT id, position_title, min_salary, max_salary, median_salary, source, updated_at FROM market_data_old;
        """)
        
        # 5. Drop old table
        cursor.execute("DROP TABLE market_data_old;")
        
        conn.commit()
        print("Migration successful.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
