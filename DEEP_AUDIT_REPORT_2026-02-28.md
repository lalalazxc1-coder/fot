# Deep Audit Report

Date: 2026-02-28
Project: FOT (`backend` + `frontend`)

## Baseline checks

- Backend tests: `pytest` -> **53 passed**.
- Frontend build: `npm run build` -> **success**.
- Frontend prod dependencies: `npm audit --omit=dev` -> **0 vulnerabilities**.

## Executive summary

- Critical stop-ship vulnerabilities were not found.
- Several **High** and **Medium** risks remain and should be remediated in the next cycle.
- Security hardening already done in integrations/rate-limit/auth provides a solid base.

## Findings by priority

### High

1. Internal error details leak in planning export endpoint
   - File: `backend/routers/planning.py:393`
   - Current behavior:
     - Returns `detail=f"Export failed: {str(e)}"`.
   - Risk:
     - Internal exception details may be exposed to clients.
   - Recommendation:
     - Return generic client message and log full diagnostic server-side.

2. External provider raw error leak in market sync endpoint
   - File: `backend/routers/market.py:185`
   - Current behavior:
     - Returns `f"HH API Error: {resp.status_code} - {resp.text}"`.
   - Risk:
     - Upstream response body/details leak to user.
   - Recommendation:
     - Sanitize response (status mapping + generic text), keep details only in logs.

3. Inconsistent authorization model for some read APIs
   - Files:
     - `backend/routers/positions.py:12`
     - `backend/routers/scenarios.py:32`
   - Current behavior:
     - Auth required, but explicit permission checks for read access are not enforced consistently.
   - Risk:
     - Users with minimal permissions may read data that should follow RBAC policy.
   - Recommendation:
     - Enforce explicit permission checks (e.g. `view_positions`, `view_scenarios`) for read endpoints.

### Medium

1. No explicit CSRF protection for cookie-based auth
   - Files:
     - `frontend/src/lib/api.ts:12`
     - `backend/routers/auth.py:36`
   - Current behavior:
     - Uses HttpOnly cookies + `SameSite=Lax`, but no CSRF token pattern.
   - Risk:
     - Residual CSRF risk for state-changing requests.
   - Recommendation:
     - Add CSRF token (double-submit or synchronizer token) validation for mutating endpoints.

2. Duplicate salary-config router implementations present
   - Files:
     - `backend/routers/salary.py`
     - `backend/routers/salary_config.py`
   - Current behavior:
     - Only one router is mounted in `backend/main.py`, but duplicate implementation remains.
   - Risk:
     - Maintenance drift/regression risk.
   - Recommendation:
     - Keep one source of truth, archive/remove duplicate module.

3. Frontend ErrorBoundary reveals stack traces
   - File: `frontend/src/main.tsx:24`
   - Current behavior:
     - Renders `error.stack` in UI.
   - Risk:
     - Internal implementation details exposed in production.
   - Recommendation:
     - Show stack/details only in dev mode; use safe generic error UI in production.

4. SQLAlchemy SAWarning in tests (cyclic FK drop order)
   - File: `backend/tests/conftest.py:38`
   - Current behavior:
     - Warning on `Base.metadata.drop_all` due to FK cycle.
   - Risk:
     - Test setup/teardown fragility over time.
   - Recommendation:
     - Resolve FK cycle handling (`use_alter=True` or explicit test cleanup strategy).

### Low / Technical debt

1. Significant `any` usage remains in frontend
   - Example files:
     - `frontend/src/components/DashboardLayout.tsx:19`
     - `frontend/src/components/market/CandidateSearch.tsx:41`
     - `frontend/src/pages/RequestsPage.tsx:30`
   - Recommendation:
     - Continue phased typing by module (requests/payroll/market/admin components).

2. Broad exception handling with silent `pass`
   - Example files:
     - `backend/routers/salary_config.py:195`
     - `backend/routers/salary.py:205`
   - Recommendation:
     - Narrow exception classes and add structured logging.

3. Deprecated/legacy security header present
   - File: `backend/main.py:85`
   - Current behavior:
     - `X-XSS-Protection` header set.
   - Recommendation:
     - Remove legacy header and prioritize CSP-based protections.

## Positive controls verified

- Cookie-based auth with HttpOnly cookies and refresh flow is implemented.
  - `backend/routers/auth.py`, `frontend/src/lib/api.ts`
- Redis-backed rate limiting exists for login/PIN scenarios.
  - `backend/utils/rate_limiter.py`, `backend/routers/job_offers.py`, `backend/main.py`
- External integration error sanitization is significantly improved.
  - `backend/routers/integrations/settings.py`, `backend/routers/integrations/hh.py`
- Frontend bundle optimization has progressed (largest chunk under 500 kB warning threshold).
  - `frontend/vite.config.ts`

## Suggested remediation order (next cycle)

1. Fix High findings in `planning` and `market` error responses.
2. Enforce explicit RBAC checks on `positions/scenarios` read paths.
3. Introduce CSRF token validation for mutating requests.
4. Remove duplicate `salary` router implementation and keep one canonical module.
5. Reduce `any` and broad `except` debt iteratively.
