"""add recruiting extended fields

Revision ID: 8b1d2e3f4a5c
Revises: 0ad54a3b31eb
Create Date: 2026-03-06 17:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8b1d2e3f4a5c"
down_revision: Union[str, Sequence[str], None] = "0ad54a3b31eb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("vacancies", sa.Column("position_name", sa.String(), nullable=True))
    op.add_column("vacancies", sa.Column("description", sa.String(), nullable=True))
    op.add_column("vacancies", sa.Column("salary_from", sa.Integer(), nullable=True))
    op.add_column("vacancies", sa.Column("salary_to", sa.Integer(), nullable=True))

    op.add_column("candidates", sa.Column("phone", sa.String(), nullable=True))
    op.add_column("candidates", sa.Column("email", sa.String(), nullable=True))
    op.add_column("candidates", sa.Column("resume_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "resume_url")
    op.drop_column("candidates", "email")
    op.drop_column("candidates", "phone")

    op.drop_column("vacancies", "salary_to")
    op.drop_column("vacancies", "salary_from")
    op.drop_column("vacancies", "description")
    op.drop_column("vacancies", "position_name")
