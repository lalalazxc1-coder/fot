"""add url to market_entries

Revision ID: f7bc765e5b8b
Revises: 4ba10b0b0ef6
Create Date: 2026-02-21 14:18:07.190691

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7bc765e5b8b'
down_revision: Union[str, Sequence[str], None] = '4ba10b0b0ef6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('market_entries', sa.Column('url', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('market_entries', 'url')

