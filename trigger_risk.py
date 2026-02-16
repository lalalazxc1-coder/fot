import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def run_sql(query, params=None):
    with engine.connect() as conn:
        conn.execute(text(query), params or {})
        conn.commit()

print("1. Creating Stagnation: Setting 'Фамилия Имя 9' salary date to 2024...")
# Get latest financial record ID for employee 9
with engine.connect() as conn:
    res = conn.execute(text("SELECT MAX(id) FROM financial_records WHERE employee_id = 9")).scalar()
    if res:
        run_sql("UPDATE financial_records SET created_at = '2024-01-01T00:00:00' WHERE id = :id", {"id": res})
        print(f"Record {res} updated.")

print("\n2. Creating Market Gap: Increasing median for 'Начальник смены' to 400,000...")
run_sql("UPDATE market_data SET median_salary = 400000 WHERE position_title = 'Начальник смены'")

print("\nDone! Now clear the analytics cache and check the Retention Risk dashboard.")
