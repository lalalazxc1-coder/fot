"""add recruiting module

Revision ID: 5a5da97554a7
Revises: 7d1c2b3a4e5f
Create Date: 2026-03-02 16:36:01.563723

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a5da97554a7'
down_revision: Union[str, Sequence[str], None] = '7d1c2b3a4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "vacancies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("planned_count", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("creator_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["department_id"], ["organization_units.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vacancies_id"), "vacancies", ["id"], unique=False)

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comments_id"), "comments", ["id"], unique=False)
    op.create_index(op.f("ix_comments_target_id"), "comments", ["target_id"], unique=False)
    op.create_index(op.f("ix_comments_target_type"), "comments", ["target_type"], unique=False)
    op.create_index(
        "ix_comments_target_type_target_id",
        "comments",
        ["target_type", "target_id"],
        unique=False,
    )

    op.create_table(
        "candidates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vacancy_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("stage", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["vacancy_id"], ["vacancies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_candidates_id"), "candidates", ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_candidates_id"), table_name="candidates")
    op.drop_table("candidates")

    op.drop_index("ix_comments_target_type_target_id", table_name="comments")
    op.drop_index(op.f("ix_comments_target_type"), table_name="comments")
    op.drop_index(op.f("ix_comments_target_id"), table_name="comments")
    op.drop_index(op.f("ix_comments_id"), table_name="comments")
    op.drop_table("comments")

    op.drop_index(op.f("ix_vacancies_id"), table_name="vacancies")
    op.drop_table("vacancies")
