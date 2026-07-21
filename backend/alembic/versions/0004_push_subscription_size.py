"""allow storing complete web push subscriptions

Revision ID: 0004_push_subscription_size
Revises: 0003_username_auth
Create Date: 2026-07-21 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0004_push_subscription_size'
down_revision: Union[str, None] = '0003_username_auth'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    with op.batch_alter_table('device_push_tokens') as batch_op:
        batch_op.alter_column(
            'token',
            existing_type=sa.String(length=255),
            type_=sa.String(length=4000),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table('device_push_tokens') as batch_op:
        batch_op.alter_column(
            'token',
            existing_type=sa.String(length=4000),
            type_=sa.String(length=255),
            existing_nullable=False,
        )
