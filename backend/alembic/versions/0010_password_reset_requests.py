"""add password reset request tracking

Revision ID: 0010_password_reset_requests
Revises: 0009_beta_feedback
Create Date: 2026-07-23 20:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0010_password_reset_requests'
down_revision: Union[str, None] = '0009_beta_feedback'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.add_column(
        'users',
        sa.Column('password_reset_requested_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'password_reset_requested_at')
