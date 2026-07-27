"""add beta feedback cooldown

Revision ID: 0013_beta_feedback_cooldown
Revises: 0012_status_updates
Create Date: 2026-07-27 20:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0013_beta_feedback_cooldown'
down_revision: Union[str, None] = '0012_status_updates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.add_column('users', sa.Column('beta_feedback_available_after', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'beta_feedback_available_after')
