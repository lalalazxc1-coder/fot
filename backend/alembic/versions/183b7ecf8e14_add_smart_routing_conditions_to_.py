"""add smart routing conditions to approval_steps

Revision ID: 183b7ecf8e14
Revises: f7bc765e5b8b
Create Date: 2026-02-21 14:20:01.290010

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '183b7ecf8e14'
down_revision: Union[str, Sequence[str], None] = 'f7bc765e5b8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('approval_steps', sa.Column('condition_type', sa.String(), nullable=True))
    op.add_column('approval_steps', sa.Column('condition_amount', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('approval_steps', 'condition_amount')
    op.drop_column('approval_steps', 'condition_type')

