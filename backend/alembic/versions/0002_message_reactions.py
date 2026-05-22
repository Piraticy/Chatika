"""add message reactions

Revision ID: 0002_message_reactions
Revises: 0001_initial
Create Date: 2026-05-22 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0002_message_reactions'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('reaction_users_json', sa.Text(), nullable=False, server_default='{}'))


def downgrade() -> None:
    op.drop_column('messages', 'reaction_users_json')
