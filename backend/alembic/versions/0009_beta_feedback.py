"""add one-time beta feedback

Revision ID: 0009_beta_feedback
Revises: 0008_designated_admin
Create Date: 2026-07-23 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0009_beta_feedback'
down_revision: Union[str, None] = '0008_designated_admin'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '0'")
        op.execute("SET LOCAL statement_timeout = '0'")
    op.add_column(
        'users',
        sa.Column('beta_feedback_eligible', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        'beta_feedback',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('favorite_feature', sa.String(length=40), nullable=False),
        sa.Column('improvement_area', sa.String(length=40), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('app_version', sa.String(length=20), nullable=True),
        sa.Column('platform', sa.String(length=30), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_beta_feedback_user'),
    )
    op.create_index(op.f('ix_beta_feedback_user_id'), 'beta_feedback', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_beta_feedback_user_id'), table_name='beta_feedback')
    op.drop_table('beta_feedback')
    op.drop_column('users', 'beta_feedback_eligible')
