import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

# --- Database URL ---
# Priority: DATABASE_URL env var > default SQLite fallback
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'fot_mvp.db')}"

DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_SQLITE_URL)

# --- Engine Configuration ---
is_sqlite = DATABASE_URL.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # SQLite-specific
    )
else:
    # PostgreSQL / other databases
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Reconnect stale connections
        pool_recycle=300,     # Recycle connections every 5 minutes
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
