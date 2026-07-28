"""add per-user delete support for rooms and messages

Revision ID: 0014_message_deletions
Revises: 0013_beta_feedback_cooldown
Create Date: 2026-07-28 06:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0014_message_deletions'
down_revision: Union[str, None] = '0013_beta_feedback_cooldown'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.add_column('chat_room_members', sa.Column('hidden_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'message_deletions',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'message_id', name='uq_message_deletion_user_message'),
    )
    op.create_index(op.f('ix_message_deletions_user_id'), 'message_deletions', ['user_id'], unique=False)
    op.create_index(op.f('ix_message_deletions_message_id'), 'message_deletions', ['message_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_message_deletions_message_id'), table_name='message_deletions')
    op.drop_index(op.f('ix_message_deletions_user_id'), table_name='message_deletions')
    op.drop_table('message_deletions')
    op.drop_column('chat_room_members', 'hidden_at')
