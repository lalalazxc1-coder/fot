"""audit_fixes_l3_rename_salary_config_2026_to_salary_configuration

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-25 09:54:00.000000

FIX #L3: Переименовать таблицу salary_config_2026 -> salary_configuration.
Старое имя содержало год, что сломает приложение при смене года без миграции.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: rename salary_config_2026 -> salary_configuration."""
    op.rename_table('salary_config_2026', 'salary_configuration')
    # Пересоздаём индекс с новым именем
    op.drop_index('ix_salary_config_2026_id', table_name='salary_configuration')
    op.create_index('ix_salary_configuration_id', 'salary_configuration', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema: rename back."""
    op.drop_index('ix_salary_configuration_id', table_name='salary_configuration')
    op.rename_table('salary_configuration', 'salary_config_2026')
    op.create_index('ix_salary_config_2026_id', 'salary_config_2026', ['id'], unique=False)
