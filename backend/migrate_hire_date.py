
import sqlite3

try:
    conn = sqlite3.connect('fot_mvp.db')
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE employees ADD COLUMN hire_date VARCHAR")
    conn.commit()
    print("Migration successful: Added hire_date column to employees table.")
except Exception as e:
    print(f"Migration failed (maybe column exists?): {e}")
finally:
    conn.close()
