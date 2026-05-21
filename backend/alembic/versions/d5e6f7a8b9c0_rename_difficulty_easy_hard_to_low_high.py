"""rename difficulty values and column to priority

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name == 'postgresql':
        # Add new enum values
        op.execute("ALTER TYPE subtask_difficulty ADD VALUE IF NOT EXISTS 'low'")
        op.execute("ALTER TYPE subtask_difficulty ADD VALUE IF NOT EXISTS 'high'")
        # Migrate data: easy→low, hard→high
        op.execute("UPDATE subtasks SET difficulty = 'low' WHERE difficulty = 'easy'")
        op.execute("UPDATE subtasks SET difficulty = 'high' WHERE difficulty = 'hard'")
        # Recreate enum type with final values and new name
        op.execute("ALTER TABLE subtasks ALTER COLUMN difficulty TYPE text")
        op.execute("DROP TYPE subtask_difficulty")
        op.execute("CREATE TYPE subtask_priority AS ENUM ('low', 'medium', 'high', 'critical')")
        op.execute("ALTER TABLE subtasks ALTER COLUMN difficulty TYPE subtask_priority USING difficulty::subtask_priority")
        # Rename the column
        op.execute("ALTER TABLE subtasks RENAME COLUMN difficulty TO priority")
    else:
        # SQLite: enums are stored as text, just migrate data and rename column
        op.execute("UPDATE subtasks SET difficulty = 'low' WHERE difficulty = 'easy'")
        op.execute("UPDATE subtasks SET difficulty = 'high' WHERE difficulty = 'hard'")
        op.execute("ALTER TABLE subtasks RENAME COLUMN difficulty TO priority")


def downgrade() -> None:
    if op.get_context().dialect.name == 'postgresql':
        op.execute("ALTER TABLE subtasks RENAME COLUMN priority TO difficulty")
        op.execute("ALTER TABLE subtasks ALTER COLUMN difficulty TYPE text")
        op.execute("DROP TYPE subtask_priority")
        op.execute("CREATE TYPE subtask_difficulty AS ENUM ('easy', 'medium', 'hard', 'critical')")
        op.execute("UPDATE subtasks SET difficulty = 'easy' WHERE difficulty = 'low'")
        op.execute("UPDATE subtasks SET difficulty = 'hard' WHERE difficulty = 'high'")
        op.execute("ALTER TABLE subtasks ALTER COLUMN difficulty TYPE subtask_difficulty USING difficulty::subtask_difficulty")
    else:
        op.execute("ALTER TABLE subtasks RENAME COLUMN priority TO difficulty")
        op.execute("UPDATE subtasks SET difficulty = 'easy' WHERE difficulty = 'low'")
        op.execute("UPDATE subtasks SET difficulty = 'hard' WHERE difficulty = 'high'")
