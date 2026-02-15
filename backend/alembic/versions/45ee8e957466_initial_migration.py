"""Initial migration

Revision ID: 45ee8e957466
Revises: 
Create Date: 2026-02-15 19:22:27.034406

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '45ee8e957466'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create tables independent of the circle or with FKs deferred
    op.create_table('positions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('grade', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_positions_id'), 'positions', ['id'], unique=False)

    op.create_table('roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('permissions', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_roles_id'), 'roles', ['id'], unique=False)

    op.create_table('salary_config_2026',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mrp', sa.Integer(), nullable=True),
        sa.Column('mzp', sa.Integer(), nullable=True),
        sa.Column('opv_rate', sa.Float(), nullable=True),
        sa.Column('opvr_rate', sa.Float(), nullable=True),
        sa.Column('vosms_rate', sa.Float(), nullable=True),
        sa.Column('vosms_employer_rate', sa.Float(), nullable=True),
        sa.Column('so_rate', sa.Float(), nullable=True),
        sa.Column('sn_rate', sa.Float(), nullable=True),
        sa.Column('ipn_rate', sa.Float(), nullable=True),
        sa.Column('opv_limit_mzp', sa.Integer(), nullable=True),
        sa.Column('opvr_limit_mzp', sa.Integer(), nullable=True),
        sa.Column('vosms_limit_mzp', sa.Integer(), nullable=True),
        sa.Column('ipn_deduction_mrp', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_salary_config_2026_id'), 'salary_config_2026', ['id'], unique=False)

    op.create_table('scenarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scenarios_id'), 'scenarios', ['id'], unique=False)

    # 2. Create the circular tables without the circular FKs initially
    op.create_table('organization_units',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('head_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['organization_units.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organization_units_id'), 'organization_units', ['id'], unique=False)

    op.create_table('employees',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('dob', sa.String(), nullable=True),
        sa.Column('position_id', sa.Integer(), nullable=True),
        sa.Column('org_unit_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('schedule', sa.String(), nullable=True),
        sa.Column('hire_date', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['org_unit_id'], ['organization_units.id'], ),
        sa.ForeignKeyConstraint(['position_id'], ['positions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employees_full_name'), 'employees', ['full_name'], unique=False)
    op.create_index(op.f('ix_employees_id'), 'employees', ['id'], unique=False)

    # 3. Add the circular FK now that both tables exist
    op.create_foreign_key('fk_org_unit_head', 'organization_units', 'employees', ['head_id'], ['id'])

    # 4. Create remaining tables
    op.create_table('financial_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('month', sa.String(), nullable=True),
        sa.Column('base_net', sa.Integer(), nullable=True),
        sa.Column('base_gross', sa.Integer(), nullable=True),
        sa.Column('kpi_net', sa.Integer(), nullable=True),
        sa.Column('kpi_gross', sa.Integer(), nullable=True),
        sa.Column('bonus_net', sa.Integer(), nullable=True),
        sa.Column('bonus_gross', sa.Integer(), nullable=True),
        sa.Column('total_net', sa.Integer(), nullable=True),
        sa.Column('total_gross', sa.Integer(), nullable=True),
        sa.Column('base_salary', sa.Integer(), nullable=True),
        sa.Column('kpi_amount', sa.Integer(), nullable=True),
        sa.Column('additional_payments', sa.JSON(), nullable=True),
        sa.Column('salary_gross', sa.Integer(), nullable=True),
        sa.Column('salary_net', sa.Integer(), nullable=True),
        sa.Column('total_payment', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_financial_records_id'), 'financial_records', ['id'], unique=False)

    op.create_table('market_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('position_title', sa.String(), nullable=True),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('min_salary', sa.Integer(), nullable=True),
        sa.Column('max_salary', sa.Integer(), nullable=True),
        sa.Column('median_salary', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['organization_units.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_market_data_id'), 'market_data', ['id'], unique=False)

    op.create_table('planning_lines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('scenario_id', sa.Integer(), nullable=True),
        sa.Column('position_title', sa.String(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('department_id', sa.Integer(), nullable=True),
        sa.Column('schedule', sa.String(), nullable=True),
        sa.Column('count', sa.Integer(), nullable=True),
        sa.Column('base_net', sa.Integer(), nullable=True),
        sa.Column('base_gross', sa.Integer(), nullable=True),
        sa.Column('kpi_net', sa.Integer(), nullable=True),
        sa.Column('kpi_gross', sa.Integer(), nullable=True),
        sa.Column('bonus_net', sa.Integer(), nullable=True),
        sa.Column('bonus_gross', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['organization_units.id'], ),
        sa.ForeignKeyConstraint(['department_id'], ['organization_units.id'], ),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_planning_lines_id'), 'planning_lines', ['id'], unique=False)

    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('hashed_password', sa.String(), nullable=True),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.Column('scope_branches', sa.JSON(), nullable=True),
        sa.Column('scope_departments', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    op.create_table('approval_steps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('is_final', sa.Boolean(), nullable=True),
        sa.Column('step_type', sa.String(), nullable=True),
        sa.Column('notify_on_completion', sa.Boolean(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_approval_steps_id'), 'approval_steps', ['id'], unique=False)

    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('target_entity', sa.String(), nullable=True),
        sa.Column('target_entity_id', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.String(), nullable=True),
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)

    op.create_table('market_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('market_id', sa.Integer(), nullable=True),
        sa.Column('company_name', sa.String(), nullable=True),
        sa.Column('salary', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['market_id'], ['market_data.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_market_entries_id'), 'market_entries', ['id'], unique=False)

    op.create_table('notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('message', sa.String(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('link', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)

    op.create_table('salary_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('requester_id', sa.Integer(), nullable=True),
        sa.Column('employee_id', sa.Integer(), nullable=True),
        sa.Column('type', sa.String(), nullable=True),
        sa.Column('current_value', sa.Integer(), nullable=True),
        sa.Column('requested_value', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('approver_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.String(), nullable=True),
        sa.Column('current_step_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['current_step_id'], ['approval_steps.id'], ),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_salary_requests_id'), 'salary_requests', ['id'], unique=False)

    op.create_table('request_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=True),
        sa.Column('step_id', sa.Integer(), nullable=True),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=True),
        sa.Column('comment', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['request_id'], ['salary_requests.id'], ),
        sa.ForeignKeyConstraint(['step_id'], ['approval_steps.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_request_history_id'), 'request_history', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_request_history_id'), table_name='request_history')
    op.drop_table('request_history')
    op.drop_index(op.f('ix_salary_requests_id'), table_name='salary_requests')
    op.drop_table('salary_requests')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_market_entries_id'), table_name='market_entries')
    op.drop_table('market_entries')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_approval_steps_id'), table_name='approval_steps')
    op.drop_table('approval_steps')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_planning_lines_id'), table_name='planning_lines')
    op.drop_table('planning_lines')
    op.drop_index(op.f('ix_market_data_id'), table_name='market_data')
    op.drop_table('market_data')
    op.drop_index(op.f('ix_financial_records_id'), table_name='financial_records')
    op.drop_table('financial_records')
    
    # 5. Remove circular FK before dropping circular tables
    op.drop_constraint('fk_org_unit_head', 'organization_units', type_='foreignkey')

    op.drop_index(op.f('ix_employees_id'), table_name='employees')
    op.drop_index(op.f('ix_employees_full_name'), table_name='employees')
    op.drop_table('employees')
    op.drop_index(op.f('ix_organization_units_id'), table_name='organization_units')
    op.drop_table('organization_units')
    
    op.drop_index(op.f('ix_scenarios_id'), table_name='scenarios')
    op.drop_table('scenarios')
    op.drop_index(op.f('ix_salary_config_2026_id'), table_name='salary_config_2026')
    op.drop_table('salary_config_2026')
    op.drop_index(op.f('ix_roles_id'), table_name='roles')
    op.drop_table('roles')
    op.drop_index(op.f('ix_positions_id'), table_name='positions')
    op.drop_table('positions')
