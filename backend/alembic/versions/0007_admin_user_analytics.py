"""add privacy-safe user analytics fields

Revision ID: 0007_admin_user_analytics
Revises: 0006_message_replies
Create Date: 2026-07-22 16:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0007_admin_user_analytics'
down_revision: Union[str, None] = '0006_message_replies'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


FIELDS = (
    ('signup_country_code', sa.String(length=2)),
    ('last_country_code', sa.String(length=2)),
    ('signup_locale', sa.String(length=35)),
    ('last_locale', sa.String(length=35)),
    ('signup_timezone', sa.String(length=80)),
    ('last_timezone', sa.String(length=80)),
    ('signup_device', sa.String(length=120)),
    ('last_device', sa.String(length=120)),
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    for name, field_type in FIELDS:
        op.add_column('users', sa.Column(name, field_type, nullable=True))


def downgrade() -> None:
    for name, _field_type in reversed(FIELDS):
        op.drop_column('users', name)
