"""add_welcome_page_configs_table

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-02-27 11:38:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'welcome_page_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('organization_units.id'), nullable=True),
        sa.Column('video_url', sa.String(), nullable=True),
        sa.Column('office_tour_images', sa.JSON(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('coordinates', sa.JSON(), nullable=True),
        sa.Column('first_day_instructions', sa.JSON(), nullable=True),
        sa.Column('merch_info', sa.String(), nullable=True),
        sa.Column('team_leader_name', sa.String(), nullable=True),
        sa.Column('team_leader_photo', sa.String(), nullable=True),
        sa.Column('team_leader_message', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_welcome_page_configs_id', 'welcome_page_configs', ['id'])


def downgrade() -> None:
    op.drop_index('ix_welcome_page_configs_id', table_name='welcome_page_configs')
    op.drop_table('welcome_page_configs')
