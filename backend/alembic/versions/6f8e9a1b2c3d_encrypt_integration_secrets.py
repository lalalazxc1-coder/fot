"""encrypt integration secrets

Revision ID: 6f8e9a1b2c3d
Revises: b7c8d9e0f1a2
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

from utils.secret_store import encrypt_secret


# revision identifiers, used by Alembic.
revision: str = "6f8e9a1b2c3d"
down_revision: Union[str, Sequence[str], None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    rows = connection.execute(
        text("SELECT id, api_key, client_secret FROM integration_settings")
    ).fetchall()

    for row in rows:
        api_key_enc = encrypt_secret(row.api_key)
        client_secret_enc = encrypt_secret(row.client_secret)

        connection.execute(
            text(
                """
                UPDATE integration_settings
                SET api_key = :api_key,
                    client_secret = :client_secret
                WHERE id = :id
                """
            ),
            {
                "id": row.id,
                "api_key": api_key_enc,
                "client_secret": client_secret_enc,
            },
        )


def downgrade() -> None:
    # Secrets should remain encrypted even on downgrade.
    pass
