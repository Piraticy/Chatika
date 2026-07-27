"""delay beta feedback until the third session

Revision ID: 0011_beta_feedback_usage
Revises: 0010_password_reset_requests
Create Date: 2026-07-27 17:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0011_beta_feedback_usage'
down_revision: Union[str, None] = '0010_password_reset_requests'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.add_column(
        'users',
        sa.Column('beta_feedback_use_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
    )
    op.execute(
        "UPDATE users SET beta_feedback_eligible = true "
        "WHERE beta_feedback_eligible = false "
        "AND NOT EXISTS (SELECT 1 FROM beta_feedback WHERE beta_feedback.user_id = users.id)"
    )


def downgrade() -> None:
    op.drop_column('users', 'beta_feedback_use_count')
