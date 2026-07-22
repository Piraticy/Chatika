"""restrict administration to the designated account

Revision ID: 0008_designated_admin
Revises: 0007_admin_user_analytics
Create Date: 2026-07-22 17:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0008_designated_admin'
down_revision: Union[str, None] = '0007_admin_user_analytics'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    users = sa.table(
        'users',
        sa.column('username', sa.String()),
        sa.column('is_admin', sa.Boolean()),
    )
    op.execute(users.update().values(is_admin=False))
    op.execute(users.update().where(sa.func.lower(users.c.username) == 'piraticy').values(is_admin=True))


def downgrade() -> None:
    pass
