import sys
# Trigger reload due to DB schema update
import os

# 1. Add current directory to path so python sees 'routers', 'database', etc.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 2. Import Database & Models
from database.database import engine, Base
from database import models # Ensure models are loaded

# 3. Create Tables
Base.metadata.create_all(bind=engine)

# 4. Import Routers
from routers import auth, roles, users, structure, employees, admin, planning, requests, market, analytics, salary, positions, workflow

app = FastAPI(title="FOT System MVP")

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Connect Routers
routers = [
    auth.router, roles.router, users.router, structure.router, 
    employees.router, admin.router, planning.router, 
    requests.router, market.router, analytics.router,
    salary.router, positions.router, workflow.router
]

for router in routers:
    app.include_router(router)

if __name__ == "__main__":
    print("Starting FOT System MVP Backend...")
    try:
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    except Exception as e:
        print(f"Failed to start server: {e}")
