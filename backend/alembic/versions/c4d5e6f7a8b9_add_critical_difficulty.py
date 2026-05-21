"""add critical difficulty

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE is PostgreSQL-only; SQLite stores enums as text and needs no schema change.
    if op.get_context().dialect.name == 'postgresql':
        op.execute("ALTER TYPE subtask_difficulty ADD VALUE IF NOT EXISTS 'critical'")


def downgrade() -> None:
    # Postgres does not support removing enum values; a full type recreation is required.
    pass
