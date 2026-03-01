"""add_analytics_config_table

Revision ID: a9c49fe20b1e
Revises: f3a4b5c6d7e8
Create Date: 2026-02-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9c49fe20b1e'
down_revision = 'a4b5c6d7e8f9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'analytics_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
    )
    
    # Insert default values
    op.execute("INSERT INTO analytics_config (key, value, description) VALUES ('retention_stagnation_months', '12', 'Months without raise to trigger risk')")
    op.execute("INSERT INTO analytics_config (key, value, description) VALUES ('retention_market_gap_percent', '15', 'Salary gap % vs market to trigger risk')")


def downgrade():
    op.drop_table('analytics_config')
