"""add analytics indexes

Revision ID: 7d1c2b3a4e5f
Revises: 6f8e9a1b2c3d
Create Date: 2026-03-02 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7d1c2b3a4e5f"
down_revision: Union[str, Sequence[str], None] = "6f8e9a1b2c3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_employees_status_org_unit_id "
        "ON employees (status, org_unit_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_financial_records_employee_id_id_desc "
        "ON financial_records (employee_id, id DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_financial_records_employee_id_id_desc")
    op.execute("DROP INDEX IF EXISTS ix_employees_status_org_unit_id")
