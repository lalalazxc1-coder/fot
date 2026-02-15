"""
Pytest conftest.py — shared fixtures for all backend tests.
Uses an in-memory SQLite database so tests are isolated and fast.
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
os.environ["ENVIRONMENT"] = "testing"  # Disable rate limiting during tests

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from database.database import Base, get_db
from database.models import (
    User, Role, OrganizationUnit, Position, Employee,
    FinancialRecord, PlanningPosition, Scenario,
    SalaryConfiguration, SalaryRequest, ApprovalStep,
    Notification, MarketData, MarketEntry, AuditLog
)
from security import get_password_hash
from main import app


# --- Temp file SQLite engine (avoids in-memory sharing issues) ---
import tempfile
_test_db_path = os.path.join(tempfile.gettempdir(), "fot_test.db")
TEST_DATABASE_URL = f"sqlite:///{_test_db_path}"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Yield a fresh DB session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """FastAPI TestClient with overridden DB dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --- Seed Data Fixtures ---

@pytest.fixture
def admin_role(db):
    role = Role(name="Administrator", permissions={
        "admin_access": True,
        "view_structure": True,
        "edit_structure": True,
        "view_positions": True,
        "edit_positions": True,
        "view_financial_reports": True,
        "manage_planning": True,
        "view_market": True,
    })
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture
def viewer_role(db):
    role = Role(name="Viewer", permissions={"view_structure": True})
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture
def admin_user(db, admin_role):
    user = User(
        email="admin@test.com",
        hashed_password=get_password_hash("admin123"),
        full_name="Test Admin",
        role_id=admin_role.id,
        scope_branches=[],
        scope_departments=[],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def viewer_user(db, viewer_role):
    user = User(
        email="viewer@test.com",
        hashed_password=get_password_hash("viewer123"),
        full_name="Test Viewer",
        role_id=viewer_role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, admin_user):
    """Login as admin and return Authorization header."""
    resp = client.post("/api/auth/login", json={
        "username": "admin@test.com",
        "password": "admin123"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers(client, viewer_user):
    """Login as viewer and return Authorization header."""
    resp = client.post("/api/auth/login", json={
        "username": "viewer@test.com",
        "password": "viewer123"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def salary_config(db):
    config = SalaryConfiguration(
        mrp=4325,
        mzp=85000,
        opv_rate=0.1,
        opvr_rate=0.025,
        vosms_rate=0.02,
        vosms_employer_rate=0.03,
        so_rate=0.035,
        sn_rate=0.095,
        ipn_rate=0.1,
        opv_limit_mzp=50,
        opvr_limit_mzp=50,
        vosms_limit_mzp=10,
        ipn_deduction_mrp=14,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@pytest.fixture
def org_structure(db):
    """Create Head Office -> Branch -> Department hierarchy."""
    head = OrganizationUnit(name="Головной офис", type="head_office")
    db.add(head)
    db.flush()

    branch = OrganizationUnit(name="Филиал Алматы", type="branch", parent_id=head.id)
    db.add(branch)
    db.flush()

    dept = OrganizationUnit(name="IT Отдел", type="department", parent_id=branch.id)
    db.add(dept)
    db.commit()
    db.refresh(head)
    db.refresh(branch)
    db.refresh(dept)
    return {"head": head, "branch": branch, "department": dept}


@pytest.fixture
def position(db):
    pos = Position(title="Разработчик", grade=3)
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos


@pytest.fixture
def employee(db, org_structure, position):
    emp = Employee(
        full_name="Иванов Иван",
        position_id=position.id,
        org_unit_id=org_structure["department"].id,
        status="Active",
    )
    db.add(emp)
    db.flush()

    fin = FinancialRecord(
        employee_id=emp.id,
        base_net=300000,
        base_gross=400000,
        kpi_net=50000,
        kpi_gross=65000,
        bonus_net=0,
        bonus_gross=0,
        total_net=350000,
        total_gross=465000,
        salary_net=350000,
        salary_gross=465000,
        base_salary=300000,
        kpi_amount=50000,
        total_payment=350000,
    )
    db.add(fin)
    db.commit()
    db.refresh(emp)
    return emp


@pytest.fixture
def planning_position(db, org_structure, salary_config):
    """Create a live planning position (scenario_id=None)."""
    pp = PlanningPosition(
        scenario_id=None,
        position_title="Разработчик",
        branch_id=org_structure["branch"].id,
        department_id=org_structure["department"].id,
        schedule="5/2",
        count=3,
        base_net=300000,
        base_gross=400000,
        kpi_net=50000,
        kpi_gross=65000,
        bonus_net=0,
        bonus_gross=0,
    )
    db.add(pp)
    db.commit()
    db.refresh(pp)
    return pp
