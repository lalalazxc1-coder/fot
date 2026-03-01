"""add_welcome_content

Revision ID: d1e2f3a4b5c6
Revises: c9f1a2b3c4d5
Create Date: 2026-02-27 11:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c9f1a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавляем поле welcome_content в job_offers и job_offer_templates."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('job_offers'):
        job_offers_columns = {column['name'] for column in inspector.get_columns('job_offers')}
        if 'welcome_content' not in job_offers_columns:
            op.add_column('job_offers', sa.Column('welcome_content', sa.JSON(), nullable=True))

    if inspector.has_table('job_offer_templates'):
        template_columns = {column['name'] for column in inspector.get_columns('job_offer_templates')}
        if 'welcome_content' not in template_columns:
            op.add_column('job_offer_templates', sa.Column('welcome_content', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Откатываем изменения."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('job_offers'):
        job_offers_columns = {column['name'] for column in inspector.get_columns('job_offers')}
        if 'welcome_content' in job_offers_columns:
            op.drop_column('job_offers', 'welcome_content')

    if inspector.has_table('job_offer_templates'):
        template_columns = {column['name'] for column in inspector.get_columns('job_offer_templates')}
        if 'welcome_content' in template_columns:
            op.drop_column('job_offer_templates', 'welcome_content')
