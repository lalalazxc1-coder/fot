"""add_welcome_content

Revision ID: d1e2f3a4b5c6
Revises: 92170de8f1b1
Create Date: 2026-02-27 11:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавляем поле welcome_content в job_offers и job_offer_templates."""
    op.add_column('job_offers', sa.Column('welcome_content', sa.JSON(), nullable=True))
    op.add_column('job_offer_templates', sa.Column('welcome_content', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Откатываем изменения."""
    op.drop_column('job_offers', 'welcome_content')
    op.drop_column('job_offer_templates', 'welcome_content')
