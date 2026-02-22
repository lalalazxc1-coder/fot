"""Add dismissal details

Revision ID: 5590e89d4346
Revises: 45ee8e957466
Create Date: 2026-02-16 16:18:08.086176

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5590e89d4346'
down_revision: Union[str, Sequence[str], None] = '45ee8e957466'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('employees', sa.Column('dismissal_date', sa.String(), nullable=True))
    op.add_column('employees', sa.Column('dismissal_reason', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('employees', 'dismissal_reason')
    op.drop_column('employees', 'dismissal_date')

