"""add Chatika status updates

Revision ID: 0012_status_updates
Revises: 0011_beta_feedback_usage
Create Date: 2026-07-27 20:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0012_status_updates'
down_revision: Union[str, None] = '0011_beta_feedback_usage'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.create_table(
        'status_updates',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('media_url', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_status_updates_user_id'), 'status_updates', ['user_id'], unique=False)
    op.create_index(op.f('ix_status_updates_expires_at'), 'status_updates', ['expires_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_status_updates_expires_at'), table_name='status_updates')
    op.drop_index(op.f('ix_status_updates_user_id'), table_name='status_updates')
    op.drop_table('status_updates')
