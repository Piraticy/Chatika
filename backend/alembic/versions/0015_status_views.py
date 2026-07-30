"""add status view tracking

Revision ID: 0015_status_views
Revises: 0014_message_deletions
Create Date: 2026-07-30 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0015_status_views'
down_revision: Union[str, None] = '0014_message_deletions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.create_table(
        'status_views',
        sa.Column('status_id', sa.String(), nullable=False),
        sa.Column('viewer_id', sa.String(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['status_id'], ['status_updates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['viewer_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('status_id', 'viewer_id', name='uq_status_view_status_viewer'),
    )
    op.create_index(op.f('ix_status_views_status_id'), 'status_views', ['status_id'], unique=False)
    op.create_index(op.f('ix_status_views_viewer_id'), 'status_views', ['viewer_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_status_views_viewer_id'), table_name='status_views')
    op.drop_index(op.f('ix_status_views_status_id'), table_name='status_views')
    op.drop_table('status_views')
