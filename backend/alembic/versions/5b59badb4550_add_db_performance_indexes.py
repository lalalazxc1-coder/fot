"""add db performance indexes

Revision ID: 5b59badb4550
Revises: 9415cc7750e2
Create Date: 2026-03-05 15:49:37.423180

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b59badb4550'
down_revision: Union[str, Sequence[str], None] = '9415cc7750e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_employees_org_unit_id "
        "ON employees (org_unit_id)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_salary_requests_status_id "
        "ON salary_requests (status, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_salary_requests_requester_id_id "
        "ON salary_requests (requester_id, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_salary_requests_current_step_id "
        "ON salary_requests (current_step_id)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_request_history_request_id_id "
        "ON request_history (request_id, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_request_history_actor_id_request_id "
        "ON request_history (actor_id, request_id)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_id_is_read_id "
        "ON notifications (user_id, is_read, id DESC)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_market_data_position_title_branch_id "
        "ON market_data (position_title, branch_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_market_entries_market_id "
        "ON market_entries (market_id)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_login_logs_action_id "
        "ON login_logs (action, id DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_target_entity_id "
        "ON audit_logs (target_entity, id DESC)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_planning_lines_scenario_branch_department "
        "ON planning_lines (scenario_id, branch_id, department_id)"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_planning_lines_scenario_branch_department")
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_target_entity_id")
    op.execute("DROP INDEX IF EXISTS ix_login_logs_action_id")
    op.execute("DROP INDEX IF EXISTS ix_market_entries_market_id")
    op.execute("DROP INDEX IF EXISTS ix_market_data_position_title_branch_id")
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_id_is_read_id")
    op.execute("DROP INDEX IF EXISTS ix_request_history_actor_id_request_id")
    op.execute("DROP INDEX IF EXISTS ix_request_history_request_id_id")
    op.execute("DROP INDEX IF EXISTS ix_salary_requests_current_step_id")
    op.execute("DROP INDEX IF EXISTS ix_salary_requests_requester_id_id")
    op.execute("DROP INDEX IF EXISTS ix_salary_requests_status_id")
    op.execute("DROP INDEX IF EXISTS ix_employees_org_unit_id")
