"""add user avatar and job title

Revision ID: c7f8e9d0a1b2
Revises: 5a5da97554a7
Create Date: 2026-03-03

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7f8e9d0a1b2"
down_revision: Union[str, Sequence[str], None] = "5a5da97554a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "job_title")
    op.drop_column("users", "avatar_url")
