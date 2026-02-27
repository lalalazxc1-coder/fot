"""add_company_info_fields

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-02-27 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a4b5c6d7e8f9'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('welcome_page_configs', sa.Column('company_description', sa.String(), nullable=True))
    op.add_column('welcome_page_configs', sa.Column('mission', sa.String(), nullable=True))
    op.add_column('welcome_page_configs', sa.Column('vision', sa.String(), nullable=True))

def downgrade():
    op.drop_column('welcome_page_configs', 'vision')
    op.drop_column('welcome_page_configs', 'mission')
    op.drop_column('welcome_page_configs', 'company_description')
