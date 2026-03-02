"""datetime_migration_core_fields

Revision ID: b7c8d9e0f1a2
Revises: a9c49fe20b1e
Create Date: 2026-03-02

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "a9c49fe20b1e"
branch_labels = None
depends_on = None


def _to_timestamptz_expr(column_name: str) -> str:
    return (
        f"CASE "
        f"WHEN {column_name} IS NULL OR btrim({column_name}) = '' THEN NULL "
        f"WHEN {column_name} ~ '^\\d{{4}}-\\d{{2}}-\\d{{2}}$' THEN ({column_name} || 'T00:00:00+00:00')::timestamptz "
        f"WHEN {column_name} ~ '^\\d{{2}}\\.\\d{{2}}\\.\\d{{4}} \\d{{2}}:\\d{{2}}$' THEN to_timestamp({column_name}, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'UTC' "
        f"WHEN {column_name} ~ '^\\d{{2}}\\.\\d{{2}}\\.\\d{{4}}$' THEN to_timestamp({column_name}, 'DD.MM.YYYY') AT TIME ZONE 'UTC' "
        f"ELSE {column_name}::timestamptz "
        f"END"
    )


def upgrade() -> None:
    op.add_column("financial_records", sa.Column("created_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("financial_records", sa.Column("last_raise_date_dt", sa.DateTime(timezone=True), nullable=True))

    op.add_column("salary_requests", sa.Column("created_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("salary_requests", sa.Column("approved_at_dt", sa.DateTime(timezone=True), nullable=True))

    op.add_column("request_history", sa.Column("created_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notifications", sa.Column("created_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("market_data", sa.Column("updated_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("market_entries", sa.Column("created_at_dt", sa.DateTime(timezone=True), nullable=True))

    op.add_column("salary_configuration", sa.Column("updated_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("integration_settings", sa.Column("updated_at_dt", sa.DateTime(timezone=True), nullable=True))
    op.add_column("job_offers", sa.Column("created_at_dt", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        f"UPDATE financial_records SET created_at_dt = {_to_timestamptz_expr('created_at')} "
        f"WHERE created_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE financial_records SET last_raise_date_dt = {_to_timestamptz_expr('last_raise_date')} "
        f"WHERE last_raise_date IS NOT NULL"
    )

    op.execute(
        f"UPDATE salary_requests SET created_at_dt = {_to_timestamptz_expr('created_at')} "
        f"WHERE created_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE salary_requests SET approved_at_dt = {_to_timestamptz_expr('approved_at')} "
        f"WHERE approved_at IS NOT NULL"
    )

    op.execute(
        f"UPDATE request_history SET created_at_dt = {_to_timestamptz_expr('created_at')} "
        f"WHERE created_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE notifications SET created_at_dt = {_to_timestamptz_expr('created_at')} "
        f"WHERE created_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE market_data SET updated_at_dt = {_to_timestamptz_expr('updated_at')} "
        f"WHERE updated_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE market_entries SET created_at_dt = {_to_timestamptz_expr('created_at')} "
        f"WHERE created_at IS NOT NULL"
    )

    op.execute(
        f"UPDATE salary_configuration SET updated_at_dt = {_to_timestamptz_expr('updated_at')} "
        f"WHERE updated_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE integration_settings SET updated_at_dt = {_to_timestamptz_expr('updated_at')} "
        f"WHERE updated_at IS NOT NULL"
    )
    op.execute(
        f"UPDATE job_offers SET created_at_dt = {_to_timestamptz_expr('created_at')} "
        f"WHERE created_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("job_offers", "created_at_dt")
    op.drop_column("integration_settings", "updated_at_dt")
    op.drop_column("salary_configuration", "updated_at_dt")

    op.drop_column("market_entries", "created_at_dt")
    op.drop_column("market_data", "updated_at_dt")
    op.drop_column("notifications", "created_at_dt")
    op.drop_column("request_history", "created_at_dt")

    op.drop_column("salary_requests", "approved_at_dt")
    op.drop_column("salary_requests", "created_at_dt")

    op.drop_column("financial_records", "last_raise_date_dt")
    op.drop_column("financial_records", "created_at_dt")
