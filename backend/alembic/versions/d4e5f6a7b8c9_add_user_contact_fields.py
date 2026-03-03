"""add user contact email and phone

Revision ID: d4e5f6a7b8c9
Revises: c7f8e9d0a1b2
Create Date: 2026-03-03

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c7f8e9d0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("contact_email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
    op.drop_column("users", "contact_email")
