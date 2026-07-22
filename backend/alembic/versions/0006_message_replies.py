"""add message reply references

Revision ID: 0006_message_replies
Revises: 0005_profile_avatars
Create Date: 2026-07-22 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0006_message_replies'
down_revision: Union[str, None] = '0005_profile_avatars'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    with op.batch_alter_table('messages') as batch_op:
        batch_op.add_column(sa.Column('reply_to_id', sa.String(), nullable=True))
        batch_op.create_foreign_key('fk_messages_reply_to_id', 'messages', ['reply_to_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_messages_reply_to_id', ['reply_to_id'])


def downgrade() -> None:
    with op.batch_alter_table('messages') as batch_op:
        batch_op.drop_index('ix_messages_reply_to_id')
        batch_op.drop_constraint('fk_messages_reply_to_id', type_='foreignkey')
        batch_op.drop_column('reply_to_id')
