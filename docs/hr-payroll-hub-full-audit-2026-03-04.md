# HR Payroll Hub - Full Audit Report

Date: 2026-03-04
Scope: senior fullstack review + API security best practices + SQL injection testing

## Executive Summary

- Full audit completed across backend, frontend, integration layer, security controls, and tests.
- Validation run completed successfully: frontend build + backend tests (`101 passed`).
- Architecture baseline is solid (router/service separation, RBAC dependencies, Redis-backed rate limiting/token blacklist, CSRF protection, security headers).
- Primary risk concentration is **not SQL injection**. Main risks are in:
  - secret/key management,
  - SSRF surface in external integrations,
  - access control boundaries for sensitive data,
  - domain consistency and auth lifecycle hardening.

## What Was Checked

### 1) Senior Fullstack Review

- Backend structure and conventions (`backend/main.py`, `backend/routers`, `backend/services`, `backend/database`).
- Frontend app shell, auth flow, and API usage (`frontend/src/App.tsx`, `frontend/src/lib/api.ts`, `frontend/src/hooks`).
- Integration points (HH, AI provider, 1C) and operational behavior.
- Error handling, logging style, and runtime safety patterns.

### 2) API Security Best Practices Review

- Auth model (cookies + bearer), refresh flow, logout/blacklist semantics.
- CSRF middleware + token issuance/verification.
- Security headers (CSP, HSTS, no-sniff, frame policy, cache policy).
- Rate limits (login + offer PIN workflows).
- Input validation, allowlists, status filtering, and endpoint-level RBAC.
- Secret storage/encryption mechanics and deployment defaults.

### 3) SQL Injection Testing (code-level audit)

- Searched for raw SQL usage in API routes.
- Reviewed dynamic filters and query composition patterns.
- Reviewed allowlist handling for user-controlled params.
- Reviewed any dynamic field selection in mass update scenarios.

## Positive Findings

- CSRF protection with double-submit logic is implemented and tested.
- Security headers are present globally.
- Login and PIN checks are rate-limited using Redis-backed sliding windows.
- Token blacklist fail-closed behavior is implemented for Redis outages.
- Most API data access is ORM-based and not vulnerable to classic SQLi patterns.
- Test suite is healthy and currently green.

## Findings by Priority

## P0 (Critical)

1. **Secret/key management fallback risk**
   - `docker-compose.yml` allows a default `SECRET_KEY` fallback.
   - `utils/secret_store.py` derives encryption material from `SECRETS_ENCRYPTION_KEY` or `SECRET_KEY`, else `dev-insecure-key`.
   - Risk: predictable cryptographic material in misconfigured production environments.

2. **SSRF surface in integration base URLs**
   - User/config-provided `base_url` is used directly for outbound HTTP calls in integration tests and AI analysis.
   - No host/CIDR allowlist or private-address blocking observed.
   - Risk: internal network probing or metadata endpoint access through integration features.

## P1 (High)

1. **Internal error leakage in integration responses**
   - In some paths, API responds with `str(e)` to clients for 1C failures.
   - Risk: sensitive infrastructure/path details exposure.

2. **Missing timeout in HH sync call**
   - `httpx.AsyncClient().get(...)` in market sync path does not set timeout explicitly.
   - Risk: worker stall and degraded service under upstream slowness.

3. **1C import functional model mismatch**
   - `Employee(...)` in 1C import passes `created_at`, while `Employee` model has no such field.
   - Risk: runtime failure on import endpoint.

4. **Sensitive offer PIN visibility boundary**
   - Offer detail schema includes `access_code` (PIN), endpoint access not strictly admin-only (depends on broader permissions).
   - Risk: unnecessary PIN exposure to wider internal roles.

## P2 (Medium)

1. **Legacy plaintext password migration branch still active**
   - Auth path supports non-bcrypt legacy values and auto-migrates on login.
   - Security debt remains until all legacy records are removed and branch retired.

2. **Refresh token hardening gap**
   - Refresh flow exists but without strict rotation/reuse-detection semantics.
   - Recommendation: rotate refresh token and track `jti`/session family.

3. **CSP looseness**
   - `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` reduce XSS resistance.

4. **Domain consistency drift**
   - Mixed status language/values and mixed date formats across modules can create logic/reporting edge cases.

## P3 (Low)

1. **Mutable defaults in ORM JSON columns**
   - Multiple JSON fields use `default=[]`/`default={}` style.
   - Recommendation: use callable defaults (`default=list`, `default=dict`) for safety and consistency.

## SQL Injection Result

### Conclusion

- **No exploitable SQL injection path identified in current API code.**

### Evidence Highlights

- API routes primarily use SQLAlchemy ORM query builders.
- Sensitive filters include allowlist restrictions (status/entity/action patterns).
- Mass update field selection in scenarios is constrained via `Literal` (no arbitrary column injection).
- No dangerous string-built SQL found in production API routers.

### Residual Risk Note

- Main security risk profile for this codebase is currently SSRF + secrets/config + access boundaries, not SQLi.

## Verification Performed

Command executed:

```bash
npm run validate
```

Result:

- Frontend build: success
- Backend tests: `101 passed`

## Remediation Plan (Implementation Order)

1. **Close P0 immediately (secrets + SSRF)**
   - Remove insecure secret defaults in production.
   - Enforce mandatory strong `SECRET_KEY` and separate `SECRETS_ENCRYPTION_KEY`.
   - Add URL validator for integrations (scheme/host checks, block private/loopback/link-local ranges, optional provider allowlist).

2. **Close P1 availability and leakage issues**
   - Replace client-facing raw exception text with sanitized messages.
   - Add explicit timeouts/retries/circuit-breaker for outbound HTTP.
   - Fix 1C import model mismatch (`created_at` on `Employee`).

3. **Tighten sensitive access boundaries**
   - Restrict PIN retrieval paths to strict admin/security role and add dedicated audit trail.

4. **Auth lifecycle hardening**
   - Implement refresh token rotation and reuse detection.
   - Add token family/session revocation controls.

5. **Security hardening + consistency cleanup**
   - Strengthen CSP with nonce/hash strategy and reduce inline allowances.
   - Normalize enums/statuses and date handling strategy.
   - Replace mutable JSON defaults with callable defaults.

## Ready for Next Step

When you are ready, we can implement fixes in the same priority order (starting from P0).
