"""add profile avatars

Revision ID: 0005_profile_avatars
Revises: 0004_push_subscription_size
Create Date: 2026-07-22 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0005_profile_avatars'
down_revision: Union[str, None] = '0004_push_subscription_size'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('avatar_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('avatar_url')
