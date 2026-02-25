"""audit_fixes_m5_add_last_raise_date_to_financial_records

Revision ID: a1b2c3d4e5f6
Revises: 5ce6bc3e920b
Create Date: 2026-02-25 09:54:00.000000

FIX #M5: Добавить поле last_raise_date в FinancialRecord.
Раньше created_at использовался как дата последнего повышения, что
некорректно т.к. created_at обновляется при любом изменении записи.
Новое поле last_raise_date заполняется только при реальном повышении зарплаты.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '5ce6bc3e920b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'financial_records',
        sa.Column('last_raise_date', sa.String(), nullable=True)
    )
    # Заполняем существующие записи датой created_at (лучшее что есть)
    op.execute(
        "UPDATE financial_records SET last_raise_date = created_at WHERE last_raise_date IS NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('financial_records', 'last_raise_date')
