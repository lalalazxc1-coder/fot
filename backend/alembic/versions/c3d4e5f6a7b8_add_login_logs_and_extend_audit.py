"""add_login_logs_and_extend_audit_log

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-25 16:28:00.000000

Изменения:
1. Новая таблица login_logs — лог входов/выходов (IP, User-Agent, статус)
2. Колонки ip_address + user_agent в audit_logs
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Новая таблица login_logs
    op.create_table(
        'login_logs',
        sa.Column('id', sa.Integer(), primary_key=True),  # index создаётся автоматически через PK
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('user_email', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('timestamp', sa.String(), nullable=True),
    )
    # Индексы только для полей поиска — НЕ для id (PK уже имеет индекс)
    op.create_index('ix_login_logs_user_id', 'login_logs', ['user_id'], unique=False)
    op.create_index('ix_login_logs_timestamp', 'login_logs', ['timestamp'], unique=False)

    # 2. Расширяем audit_logs (nullable — не ломаем существующие записи)
    with op.batch_alter_table('audit_logs') as batch_op:
        batch_op.add_column(sa.Column('ip_address', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('user_agent', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('audit_logs') as batch_op:
        batch_op.drop_column('user_agent')
        batch_op.drop_column('ip_address')
    op.drop_index('ix_login_logs_timestamp', table_name='login_logs')
    op.drop_index('ix_login_logs_user_id', table_name='login_logs')
    op.drop_table('login_logs')
