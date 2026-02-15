# Technical Project Report: Human Resources & Salary Management System (FOT MVP)

**Prepared for:** Technical Lead / Stakeholders  
**Date:** February 15, 2026

## 1. Executive Summary

This report details the successful development and deployment readiness of the Human Resources & Salary Management System (FOT), a specialized ERP module designed for the Kazakhstan market. The system automates organizational structure management, salary planning, and complex payroll calculations while ensuring compliance with local tax regulations (OPV, OSMS, IPN, etc.). It serves as a central source of truth for HR and Finance departments, offering dynamic workflows for salary approvals and deep analytics for budget control.

## 2. Tech Stack & Architecture

The backend is built on a robust, modern Python stack prioritizing type safety, performance, and scalability.

*   **Framework:** **FastAPI**, chosen for its high-performance asynchronous capabilities and automatic OpenAPI documentation.
*   **ORM:** **SQLAlchemy 2.0**, utilizing the new declarative syntax (`mapped_column`, `db.scalars()`) for type-safe database interactions and efficient query generation.
*   **Data Validation:** **Pydantic v2**, ensuring rigorous input/output validation and schema enforcement across all API endpoints.
*   **Database:** PostgreSQL (production-ready) / SQLite (development), with a modular schema design supporting complex relationships.
*   **Authentication:** JWT (JSON Web Tokens) with **OAuth2**, securing API access with stateless token-based verification.

### Modular Router Structure
The application follows a domain-driven design pattern, with logic segregated into distinct routers:
*   `routers/structure.py`: Organizational hierarchy management.
*   `routers/planning.py`: Budgeting and position management.
*   `routers/salary_config.py`: Tax engine and global settings.
*   `routers/employees.py`: Employee lifecycle and financial records.
*   `routers/workflow.py`: Dynamic approval processes.

### Access Control (RBAC & Scoping)
Security is enforced through a multi-layered approach:
1.  **RBAC (Role-Based Access Control):** Granular permissions (e.g., `view_financials`, `approve_requests`) are assigned to roles, restricting endpoint access.
2.  **Scope-Based Visibility:** Users are restricted to specific branches or departments. Middleware automatically filters query results based on the user's assigned scope, ensuring data segregation at the database level.

## 3. Module Breakdown (Deep Dive)

### 3.1 Organizational Structure
Implemented as a self-referencing hierarchy (Adjacency List model).
*   **DAG Validation:** To prevent circular dependencies (e.g., a unit becoming its own ancestor), the system performs a recursive "Descendant Check" before any update operation.
*   **Query Optimization:** Recursive Common Table Expressions (CTEs) or Python-level recursion with memoization are used to build the full tree. N+1 queries are eliminated by pre-fetching all units into an in-memory map for O(1) parent/child resolution during serialization.

### 3.2 Financial Engine & Tax Compliance
The core of the system is a high-precision calculation engine tailored for Kazakhstan's tax code (2024-2026).
*   **Precision:** All monetary calculations utilize Python's `Decimal` type with `ROUND_HALF_UP` strategy to eliminate floating-point errors common in financial software.
*   **Net-to-Gross Reverse Calculation:** A binary search algorithm (with iterative approximation) is implemented to solve for Gross salary given a target Net amount. This handles the non-linear tax functions (caps/floors on OPV, OSMS) efficiently.
*   **Compliance:** Supports specific deductions (14 MRP), and standard rates for OPV, OPVR, VOSMS, OSMS, SO, SN, and IPN.

### 3.3 Workflow & Approvals
A flexible, multi-step approval engine manages salary change requests.
*   **Dynamic Steps:** Administrators can configure an arbitrary sequence of approval steps (e.g., Dept Head -> HR -> Finance -> CEO).
*   **Contextual Analytics:** Approvers are presented with "Before/After" financial impacts and market salary benchmarks (min/mid/max) directly in the approval interface to aid decision-making.
*   **Integrity:** The system prevents the deletion of active workflow steps if pending requests are attached, ensuring process continuity.

### 3.4 Predictive Analytics (Retention Risk)
A proactive retention engine identifies high-risk employees based on quantitative metrics.
*   **Risk Scoring:** Calculates a composite risk score based on "Salary Stagnation" (>12 months without raise) and "Market Gap" (>15% below median).
*   **Visual Dashboard:** Provides HR with an immediate list of "At Risk" employees, visualized with stagnation duration and gap percentage.

### 3.5 ESG Reporting & Pay Equity
Automated generation of Environmental, Social, and Governance (ESG) metrics.
*   **Gender Pay Gap:** Aggregates and compares average salaries across gender categories to identify disparities.
*   **Generational Equity:** Analyzes compensation distribution across age groups (Gen Z, Millennials, Gen X, Boomers) to ensure fair practices.

### 3.6 Temporal State Reconstruction (Time Travel)
Enables auditors and managers to view the distinct financial state of the organization at any point in the past.
*   **Snapshot Logic:** The `structure/flat` endpoint accepts an ISO date parameter. The backend reconstructs the "Latest State" of financial records effective *on or before* that date, filtering out future changes.
*   **Read-Only Mode:** The frontend enforces a strict read-only mode with a warning banner when viewing historical snapshots to prevent accidental modification of past data.

## 4. Audit & Logging

Data integrity and accountability are enforced through a comprehensive audit trail.
*   **"Before/After" Snapshots:** Every critical mutation (create/update/delete) on detailed entities (Planning, Employee, Salary Config) is logged.
*   **Granularity:** Logs capture the exact field changed (e.g., "Base Net: 150,000 -> 200,000"), the user responsible, and the timestamp.
*   **Entity Linking:** Logs are polymorphically linked (`target_entity`, `target_entity_id`), allowing history views for any object type.

## 5. Performance & Scalability

The system is optimized for reading large datasets and handling mass updates.
*   **Query Optimization:** Extensive use of SQLAlchemy's `joinedload` and `selectinload` to eagerly fetch related data (e.g., loading `Position` and `OrganizationUnit` with `Employee`), strictly preventing N+1 query problems.
*   **Batch Processing:** Mass operations, such as recalculating the entire payroll after a Tax Rate change (e.g., MRP update), are offloaded to **BackgroundTasks**. This prevents HTTP timeouts and ensures UI responsiveness.
*   **Memoization:** Recursive functions for calculating total headcounts and department budgets utilize memoization to reduce computational complexity from exponential to linear.

## 6. Security Standards

*   **Password Hashing:** User passwords are hashed using **bcrypt** (via `passlib`), a standard adaptive hashing algorithm that is resistant to rainbow table attacks.
*   **Authentication:** Stateless JWT authentication ensures secure API communication. Tokens are signed with a secure secret key and have configurable expiration.
*   **Input Validation:** Pydantic models strip whitespace and enforce type constraints (e.g., positive integers for IDs, valid enums for Status), preventing injection attacks and data corruption.

## 7. Database Strategy

*   **Schema Design:** Normalized relational schema (3NF) ensures data consistency. Foreign keys with `ondelete` constraints maintain referential integrity.
*   **Production Readiness:** The transition to SQLAlchemy 2.0 syntax prepares the application for async drivers (`asyncpg`) if higher concurrency is needed in the future.
*   **Relationships:** Explicit relationship definitions streamline complex joins for analytics (e.g., "Average Salary by Department").

## 8. Future Roadmap

To further mature the platform, the following enhancements are recommended:
1.  **Alembic Migrations:** Implement Alembic for version-controlled database schema changes, enabling safe production deployments for schema updates.
2.  **Redis Caching:** Introduce Redis to cache heavy read-only endpoints (e.g., Structure Tree, Dashboard Stats), reducing DB load.
3.  **Advanced Reporting:** Integrate a dedicated reporting engine (e.g., Pandas/Excel export is implemented, but PDF generation or BI tool integration would add value).
4.  **Containerization:** Dockerize the application and database for consistent deployment across environments (Dev/Stage/Prod).

---
**Conclusion:** Validated for core functionality, security, and financial accuracy, the FOT system provides a solid foundation for managing complex HR and payroll operations.
