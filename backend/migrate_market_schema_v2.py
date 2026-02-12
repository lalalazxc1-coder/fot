import sqlite3
import os
import sys

# Detect path logic
if os.path.exists("fot_mvp.db"):
    DB_PATH = "fot_mvp.db"
elif os.path.exists("backend/fot_mvp.db"):
    DB_PATH = "backend/fot_mvp.db"
else:
    print("Database not found")
    sys.exit(1)

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check current state
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='market_data';")
        has_new = cursor.fetchone()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='market_data_old';")
        has_old = cursor.fetchone()
        
        if has_new and has_old:
            print("Both tables exist. Likely previous migration failed.")
            # Assume new table is empty or partial. Drop it and retry from old?
            # Or assume old has the data.
            cursor.execute("DROP TABLE IF EXISTS market_data;")
        
        if not has_new and not has_old:
            print("No market_data table found at all!")
            return

        # If we only have market_data (clean state), rename it
        if has_new and not has_old:
            print("Renaming current market_data to market_data_old...")
            cursor.execute("ALTER TABLE market_data RENAME TO market_data_old;")
        
        # Now we definitely have market_data_old and NO market_data
        
        # Drop problematic index if it exists on old table
        cursor.execute("DROP INDEX IF EXISTS ix_market_data_id;")
        
        print("Creating new market_data table...")
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
        print("Copying data...")
        # Get columns from old table to be safe? 
        # Or just assume standard columns
        # We need to handle case where branch_id might not exist in source
        cursor.execute("PRAGMA table_info(market_data_old);")
        old_cols = [r[1] for r in cursor.fetchall()]
        
        src_cols = "id, position_title, min_salary, max_salary, median_salary, source, updated_at"
        if "branch_id" in old_cols:
             src_cols += ", branch_id"
             dst_cols = "id, position_title, min_salary, max_salary, median_salary, source, updated_at, branch_id"
        else:
             dst_cols = "id, position_title, min_salary, max_salary, median_salary, source, updated_at"

        cursor.execute(f"""
        INSERT INTO market_data ({dst_cols})
        SELECT {src_cols} FROM market_data_old;
        """)
        
        # 5. Drop old table
        print("Dropping old table...")
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
