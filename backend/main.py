import sys
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
from routers import auth, roles, users, structure, employees, admin, planning

app = FastAPI(title="FOT System MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Connect Routers
app.include_router(auth.router)
app.include_router(roles.router)
app.include_router(users.router)
app.include_router(structure.router)
app.include_router(employees.router)
app.include_router(admin.router)
app.include_router(planning.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
