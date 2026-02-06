"""
Database Performance Optimization - Indexes Creation
Run this once to create indexes for analytics queries
"""

CREATE_INDEXES_SQL = """
-- ===================================================
-- ANALYTICS PERFORMANCE OPTIMIZATION INDEXES
-- ===================================================

-- 1. Employees table indexes for fast aggregation
-- Index for filtering by branch and status
CREATE INDEX IF NOT EXISTS idx_employees_branch_status 
ON employees(branch_id, status);

-- Index for salary calculations (used in ORDER BY and SUM)
-- Using expression index for total salary
CREATE INDEX IF NOT EXISTS idx_employees_total_salary 
ON employees((base_salary_net + kpi_net + bonus_net) DESC);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_employees_analytics 
ON employees(status, branch_id, department_id);

-- ===================================================
-- 2. PlanPositions table indexes for plan aggregation
-- ===================================================

-- Index for branch and department filtering
CREATE INDEX IF NOT EXISTS idx_plans_branch_dept 
ON plan_positions(branch_id, department_id);

-- Index for plan value calculations
CREATE INDEX IF NOT EXISTS idx_plans_totals 
ON plan_positions(branch_id, count, base_net, kpi_net, bonus_net);

-- ===================================================
-- 3. Branches and Departments for joins
-- ===================================================

-- Index for branch name lookups
CREATE INDEX IF NOT EXISTS idx_branches_name 
ON branches(name);

-- Index for department lookups
CREATE INDEX IF NOT EXISTS idx_departments_branch 
ON departments(branch_id);

-- ===================================================
-- 4. Request/Audit tables (if applicable)
-- ===================================================

-- Index for filtering requests by status and date
CREATE INDEX IF NOT EXISTS idx_salary_requests_status_date 
ON salary_requests(status, created_at DESC);

-- Index for employee requests lookup
CREATE INDEX IF NOT EXISTS idx_salary_requests_employee 
ON salary_requests(employee_id, status);

-- ===================================================
-- VERIFICATION QUERIES
-- ===================================================

-- Check existing indexes
SELECT 
    name,
    tbl_name,
    sql
FROM sqlite_master 
WHERE type = 'index' 
  AND tbl_name IN ('employees', 'plan_positions', 'branches', 'departments')
ORDER BY tbl_name, name;

-- Analyze query plan for summary query
EXPLAIN QUERY PLAN
SELECT 
    COUNT(*),
    SUM(base_salary_net + kpi_net + bonus_net)
FROM employees 
WHERE status != 'Dismissed';

-- Analyze query plan for branch comparison
EXPLAIN QUERY PLAN
SELECT 
    branch_id,
    SUM(base_salary_net + kpi_net + bonus_net) as total
FROM employees 
WHERE status != 'Dismissed'
GROUP BY branch_id;
"""

if __name__ == "__main__":
    import sqlite3
    import sys
    import os
    
    # Add parent directory to path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    from database.database import engine
    
    print("🔧 Creating performance optimization indexes...")
    print("=" * 60)
    
    # For SQLite, we need to use raw connection
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # Split and execute each CREATE INDEX statement
        statements = [
            stmt.strip() 
            for stmt in CREATE_INDEXES_SQL.split(';') 
            if stmt.strip() and stmt.strip().upper().startswith('CREATE')
        ]
        
        for i, stmt in enumerate(statements, 1):
            try:
                conn.execute(text(stmt))
                conn.commit()
                # Extract index name from statement
                index_name = stmt.split('idx_')[1].split()[0] if 'idx_' in stmt else f'index_{i}'
                print(f"✅ Created: idx_{index_name}")
            except Exception as e:
                print(f"⚠️  Warning: {str(e)[:100]}")
        
        print()
        print("=" * 60)
        print("📊 Verifying indexes...")
        print("=" * 60)
        
        # Verify indexes
        result = conn.execute(text("""
            SELECT 
                name,
                tbl_name
            FROM sqlite_master 
            WHERE type = 'index' 
              AND tbl_name IN ('employees', 'plan_positions', 'branches', 'departments')
              AND name LIKE 'idx_%'
            ORDER BY tbl_name, name
        """))
        
        for row in result:
            print(f"✓ {row[1]:<20} → {row[0]}")
    
    print()
    print("=" * 60)
    print("✅ Database optimization complete!")
    print("=" * 60)
    print()
    print("💡 Tips:")
    print("  1. Run ANALYZE after creating indexes:")
    print("     sqlite3 fot.db 'ANALYZE'")
    print("  2. Monitor query performance with EXPLAIN QUERY PLAN")
    print("  3. Rebuild indexes periodically: REINDEX")
    print()
