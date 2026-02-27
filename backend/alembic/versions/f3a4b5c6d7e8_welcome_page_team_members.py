"""welcome_page_team_members

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-02-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('welcome_page_configs', sa.Column('team_members', sa.JSON(), server_default='[]'))
    op.drop_column('welcome_page_configs', 'coordinates')
    op.drop_column('welcome_page_configs', 'team_leader_name')
    op.drop_column('welcome_page_configs', 'team_leader_photo')
    op.drop_column('welcome_page_configs', 'team_leader_message')

def downgrade():
    op.add_column('welcome_page_configs', sa.Column('team_leader_message', sa.String(), nullable=True))
    op.add_column('welcome_page_configs', sa.Column('team_leader_photo', sa.String(), nullable=True))
    op.add_column('welcome_page_configs', sa.Column('team_leader_name', sa.String(), nullable=True))
    op.add_column('welcome_page_configs', sa.Column('coordinates', sa.JSON(), nullable=True))
    op.drop_column('welcome_page_configs', 'team_members')
