import sqlite3
import os

DB_PATH = "fot_mvp.db"

def migrate_force():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row # Access columns by name
    cursor = conn.cursor()

    try:
        print("Starting forced migration for market_data...")
        
        # 1. Read existing data
        # We need to handle cases where branch_id might not exist in old data
        cursor.execute("PRAGMA table_info(market_data)")
        columns = [col[1] for col in cursor.fetchall()]
        has_branch_id = 'branch_id' in columns
        
        select_query = "SELECT * FROM market_data"
        cursor.execute(select_query)
        rows = cursor.fetchall()
        
        data_to_restore = []
        for row in rows:
            # Prepare dict
            item = dict(row)
            if not has_branch_id:
                item['branch_id'] = None
            data_to_restore.append(item)
            
        print(f"Backed up {len(data_to_restore)} rows.")

        # 2. Drop old table
        # Also drop entries temporarily if constraint prevents dropping parent? 
        # No, entries has FK to market_data(id). If we drop parent, entries might be orphaned or block it.
        # Let's drop entries too if we are rebuilding parent, OR keep them if we can safeguard IDs.
        # Safe bet: Recreate parent, keep IDs same.
        
        # Need to disable FK checks temporarily
        cursor.execute("PRAGMA foreign_keys = OFF;")
        
        cursor.execute("DROP TABLE IF EXISTS market_data_old_backup")
        cursor.execute("ALTER TABLE market_data RENAME TO market_data_old_backup")
        
        # 3. Create new table
        print("Creating new market_data table...")
        cursor.execute("""
        CREATE TABLE market_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position_title VARCHAR,
            branch_id INTEGER REFERENCES organization_units(id),
            min_salary INTEGER DEFAULT 0,
            max_salary INTEGER DEFAULT 0,
            median_salary INTEGER DEFAULT 0,
            source VARCHAR,
            updated_at VARCHAR
        );
        """)
        cursor.execute("DROP INDEX IF EXISTS ix_market_data_id;")
        cursor.execute("CREATE INDEX ix_market_data_id ON market_data (id);")

        # 4. Restore data
        print("Restoring data...")
        for item in data_to_restore:
            cursor.execute("""
                INSERT INTO market_data (id, position_title, branch_id, min_salary, max_salary, median_salary, source, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item['id'], 
                item['position_title'], 
                item.get('branch_id'), 
                item['min_salary'], 
                item['max_salary'], 
                item['median_salary'], 
                item['source'], 
                item['updated_at']
            ))

        # 5. Cleanup
        cursor.execute("DROP TABLE market_data_old_backup")
        
        conn.commit()
        cursor.execute("PRAGMA foreign_keys = ON;")
        print("Migration successful. Table `market_data` recreated.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_force()
