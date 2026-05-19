"""init

Revision ID: 2496014b67a4
Revises: 
Create Date: 2026-05-18 22:06:24.039946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2496014b67a4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_user_id"),
    )

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("raw_instructions", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("decomposing", "ready", "failed", name="project_status"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "subtasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "difficulty",
            sa.Enum("easy", "medium", "hard", name="subtask_difficulty"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("todo", "in_progress", "done", name="subtask_status"),
            nullable=True,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("subtasks")
    op.drop_table("projects")
    op.drop_table("users")

    sa.Enum(name="subtask_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="subtask_difficulty").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="project_status").drop(op.get_bind(), checkfirst=True)
