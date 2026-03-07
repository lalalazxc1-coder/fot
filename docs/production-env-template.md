# FOT Production .env Template

This template matches the current project stack: `docker-compose` + FastAPI backend + Caddy.

Save as project root `.env` (`C:\Users\admin\Desktop\project\fot\.env`).

```env
# =========================
# FOT Production .env
# =========================

# PostgreSQL (used by db service and backend DATABASE_URL assembly)
POSTGRES_USER=fot_admin_prod
POSTGRES_PASSWORD=CHANGE_ME_STRONG_URL_SAFE_PASSWORD
POSTGRES_DB=fot_db

# Required backend secrets (all 3 must be different)
SECRET_KEY=CHANGE_ME_64HEX_RANDOM
REFRESH_SECRET_KEY=CHANGE_ME_64HEX_RANDOM_DIFFERENT
SECRETS_ENCRYPTION_KEY=CHANGE_ME_64HEX_RANDOM_DIFFERENT

# Required CORS/proxy settings (based on current docker-compose.yml)
ALLOWED_ORIGINS=https://hr-payroll.quest
TRUSTED_PROXY_IPS=127.0.0.1,::1,172.16.0.0/12
FORWARDED_ALLOW_IPS=127.0.0.1,172.16.0.0/12

# Optional (defaults from compose are used if omitted)
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
```

## Notes

- Use a URL-safe `POSTGRES_PASSWORD` (avoid `@`, `:`, `/`, `?`, `#`) so `DATABASE_URL` parsing does not break.
- Generate secrets with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Run it three times and put different values into `SECRET_KEY`, `REFRESH_SECRET_KEY`, and `SECRETS_ENCRYPTION_KEY`.

- Do not commit real `.env` to git; commit only `.env.example`.
- For this production setup, a separate `frontend/.env` is not required (frontend uses relative `/api`).
