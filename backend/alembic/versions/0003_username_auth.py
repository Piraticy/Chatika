"""make phone number optional for username-first auth

Revision ID: 0003_username_auth
Revises: 0002_message_reactions
Create Date: 2026-07-21 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0003_username_auth'
down_revision: Union[str, None] = '0002_message_reactions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column(
            'phone_number',
            existing_type=sa.String(length=20),
            existing_nullable=False,
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column(
            'phone_number',
            existing_type=sa.String(length=20),
            existing_nullable=True,
            nullable=False,
        )
