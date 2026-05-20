"""add project updated_at

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'b3c4d5e6f7a8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.execute("UPDATE projects SET updated_at = created_at")


def downgrade():
    op.drop_column('projects', 'updated_at')
