"""add escalation fields to hospital

Revision ID: 07f83054da42
Revises: af9e0f8f2572
Create Date: 2026-04-27 11:18:07.183357

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '07f83054da42'
down_revision = 'af9e0f8f2572'
branch_labels = None
depends_on = None


def upgrade():
    # Add as nullable first to avoid NOT NULL violation on existing rows
    with op.batch_alter_table('hospitals', schema=None) as batch_op:
        batch_op.add_column(sa.Column('escalation_level', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('escalation_updated_at', sa.DateTime(timezone=True), nullable=True))

    # Backfill existing rows with 0 (Normal)
    op.execute("UPDATE hospitals SET escalation_level = 0 WHERE escalation_level IS NULL")

    # Now enforce NOT NULL
    with op.batch_alter_table('hospitals', schema=None) as batch_op:
        batch_op.alter_column('escalation_level', nullable=False)


def downgrade():
    with op.batch_alter_table('hospitals', schema=None) as batch_op:
        batch_op.drop_column('escalation_updated_at')
        batch_op.drop_column('escalation_level')
