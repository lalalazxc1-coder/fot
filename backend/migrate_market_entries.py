import sqlite3
import os

DB_PATH = "fot_mvp.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if market_entries table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='market_entries';")
        if cursor.fetchone():
            print("Table 'market_entries' already exists.")
            return

        print("Creating market_entries table...")
        cursor.execute("""
        CREATE TABLE market_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_id INTEGER,
            company_name VARCHAR,
            salary INTEGER,
            created_at VARCHAR,
            FOREIGN KEY(market_id) REFERENCES market_data(id)
        );
        """)
        
        cursor.execute("CREATE INDEX ix_market_entries_id ON market_entries (id);")
        
        conn.commit()
        print("Migration successful.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
