"""create_job_offer_templates_table

Revision ID: c9f1a2b3c4d5
Revises: c3d4e5f6a7b8
Create Date: 2026-02-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9f1a2b3c4d5'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create job_offer_templates table in migration chain."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('job_offer_templates'):
        op.create_table(
            'job_offer_templates',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('company_name', sa.String(), nullable=True),
            sa.Column('benefits', sa.JSON(), nullable=True),
            sa.Column('welcome_text', sa.String(), nullable=True),
            sa.Column('description_text', sa.String(), nullable=True),
            sa.Column('theme_color', sa.String(), nullable=True),
            sa.Column('custom_sections', sa.JSON(), nullable=True),
            sa.Column('probation_period', sa.String(), nullable=True),
            sa.Column('working_hours', sa.String(), nullable=True),
            sa.Column('lunch_break', sa.String(), nullable=True),
            sa.Column('non_compete_text', sa.String(), nullable=True),
            sa.Column('signatories', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_job_offer_templates_id', 'job_offer_templates', ['id'], unique=False)
        op.create_index('ix_job_offer_templates_name', 'job_offer_templates', ['name'], unique=True)
        return

    existing_columns = {column['name'] for column in inspector.get_columns('job_offer_templates')}
    for column in (
        sa.Column('company_name', sa.String(), nullable=True),
        sa.Column('benefits', sa.JSON(), nullable=True),
        sa.Column('welcome_text', sa.String(), nullable=True),
        sa.Column('description_text', sa.String(), nullable=True),
        sa.Column('theme_color', sa.String(), nullable=True),
        sa.Column('custom_sections', sa.JSON(), nullable=True),
        sa.Column('probation_period', sa.String(), nullable=True),
        sa.Column('working_hours', sa.String(), nullable=True),
        sa.Column('lunch_break', sa.String(), nullable=True),
        sa.Column('non_compete_text', sa.String(), nullable=True),
        sa.Column('signatories', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    ):
        if column.name not in existing_columns:
            op.add_column('job_offer_templates', column)


def downgrade() -> None:
    """Drop job_offer_templates table if present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('job_offer_templates'):
        existing_indexes = {index['name'] for index in inspector.get_indexes('job_offer_templates')}
        if 'ix_job_offer_templates_name' in existing_indexes:
            op.drop_index('ix_job_offer_templates_name', table_name='job_offer_templates')
        if 'ix_job_offer_templates_id' in existing_indexes:
            op.drop_index('ix_job_offer_templates_id', table_name='job_offer_templates')
        op.drop_table('job_offer_templates')
