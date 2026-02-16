import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def run_sql(query):
    with engine.connect() as conn:
        result = conn.execute(text(query))
        if result.returns_rows:
            return [dict(row._mapping) for row in result]
        return None

print("Checking Market Data...")
market = run_sql("SELECT * FROM market_data LIMIT 5")
print(f"Market rows: {market}")

print("\nChecking Employees and latest financials...")
query = """
SELECT e.id, e.full_name, p.title as position, fr.total_gross, fr.created_at
FROM employees e
JOIN positions p ON e.position_id = p.id
JOIN (
    SELECT employee_id, MAX(id) as max_id
    FROM financial_records
    GROUP BY employee_id
) latest ON e.id = latest.employee_id
JOIN financial_records fr ON latest.max_id = fr.id
WHERE e.status != 'Dismissed'
LIMIT 5
"""
emps = run_sql(query)
for emp in emps:
    print(emp)
