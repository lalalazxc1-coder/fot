# Deep Audit TODO

Last updated: 2026-03-02

## P0 - Critical (release blockers)

- [x] Add strict RBAC checks for all write endpoints in `backend/routers/scenarios.py` (`POST /`, `DELETE /{id}`, `POST /{id}/apply-change`, `POST /{id}/commit`).
- [x] Protect `GET /api/salary-config/` and `GET /api/salary-config/history` with `require_admin` in `backend/routers/salary_config.py`.
- [x] Add/extend backend tests for negative RBAC cases (non-admin must get 403).

## P1 - Security and data correctness

- [x] Replace `--forwarded-allow-ips '*'` with trusted proxy IPs in runtime config.
- [ ] Normalize date/time handling (prefer `DateTime` over string where feasible).
- [x] Switch retention stagnation logic to `last_raise_date` instead of `created_at`.
- [ ] Standardize API date format to ISO 8601.

## P2 - Reliability and performance

- [x] Refactor notifications flow to avoid per-item `db.commit()` in `backend/routers/requests.py`.
- [x] Restrict `SalaryRequestUpdate.status` to an enum-like set (`approved`, `rejected`).
- [x] Add allowlist validation for editable fields in scenario mass update.
- [ ] Profile heavy analytics queries and add indexes after `EXPLAIN`.

## P3 - Tech debt and quality

- [ ] Clean Alembic history inconsistencies (empty migrations / metadata mismatch).
- [ ] Add frontend tests for auth and critical user flows.
- [ ] Align password validation rules between frontend and backend.
- [ ] Verify dynamic Tailwind class usage and add safelist if needed.

## Verification checklist

- [x] `pytest` passes in `backend/`.
- [x] `npm run build` passes in `frontend/`.
- [x] No financial write endpoint is left without explicit authorization checks.
- [x] Audit report updated after fixes.
