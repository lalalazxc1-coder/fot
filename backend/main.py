import sys
import os
import logging

# 1. Add current directory to path so python sees 'routers', 'database', etc.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# --- Logging ---
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fot")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# 2. Import Database & Models
from database.database import engine, Base
from database import models  # Ensure models are loaded

# 3. Create Tables (Deprecated: Use Alembic migrations instead)
# Base.metadata.create_all(bind=engine)

# 4. Import Routers
from routers import (
    auth, roles, users, structure, employees,
    admin, planning, requests, market, analytics,
    salary, positions, workflow, scenarios,
)
from routers.salary_config import router as salary_config_router
from routers import integrations

app = FastAPI(
    title="FOT System",
    version="0.2.0",
    docs_url="/docs" if os.environ.get("ENVIRONMENT") != "production" else None,
    redoc_url=None,
)

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    # Don't leak internal details in production
    env = os.environ.get("ENVIRONMENT", "development")
    detail = str(exc) if env == "development" else "Internal Server Error"
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": detail},
    )

# --- CORS ---
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "")
if allowed_origins_str:
    allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]
else:
    allowed_origins = _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate Limiting Middleware (simple in-memory) ---
import time
from collections import defaultdict

_login_attempts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 300  # 5 minutes
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "10"))  # max attempts per window

@app.middleware("http")
async def rate_limit_login(request: Request, call_next):
    if request.url.path == "/api/auth/login" and request.method == "POST":
        # Skip rate limiting in test environment
        env = os.environ.get("ENVIRONMENT", "development")
        if env == "testing":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Clean old entries
        _login_attempts[client_ip] = [
            t for t in _login_attempts[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]
        if len(_login_attempts[client_ip]) >= RATE_LIMIT_MAX:
            logger.warning(f"Rate limit exceeded for {client_ip} on /api/auth/login")
            return JSONResponse(
                status_code=429,
                content={"detail": "Слишком много попыток входа. Попробуйте через 5 минут."},
            )
        _login_attempts[client_ip].append(now)

    response = await call_next(request)
    return response

# 5. Connect Routers
all_routers = [
    auth.router, roles.router, users.router, structure.router,
    employees.router, admin.router, planning.router,
    requests.router, market.router, analytics.router,
    salary.router, positions.router, workflow.router,
    scenarios.router, salary_config_router,
    # New
    integrations.router,
]

for r in all_routers:
    app.include_router(r)

logger.info(f"FOT System started. CORS origins: {allowed_origins}")

if __name__ == "__main__":
    print("Starting FOT System Backend...")
    try:
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    except Exception as e:
        print(f"Failed to start server: {e}")
