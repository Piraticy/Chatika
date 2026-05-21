"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('username', sa.String(length=40), nullable=False),
        sa.Column('phone_number', sa.String(length=20), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=False),
        sa.Column('is_approved', sa.Boolean(), nullable=False),
        sa.Column('is_online', sa.Boolean(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_phone_number'), 'users', ['phone_number'], unique=True)

    op.create_table(
        'session_tokens',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('refresh_token_hash', sa.String(length=255), nullable=False),
        sa.Column('device_name', sa.String(length=120), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_session_tokens_user_id'), 'session_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_session_tokens_refresh_token_hash'), 'session_tokens', ['refresh_token_hash'], unique=True)

    op.create_table(
        'chat_rooms',
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('is_group', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'chat_room_members',
        sa.Column('room_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(length=30), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['room_id'], ['chat_rooms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('room_id', 'user_id', name='uq_room_user'),
    )
    op.create_index(op.f('ix_chat_room_members_room_id'), 'chat_room_members', ['room_id'], unique=False)
    op.create_index(op.f('ix_chat_room_members_user_id'), 'chat_room_members', ['user_id'], unique=False)

    op.create_table(
        'messages',
        sa.Column('room_id', sa.String(), nullable=False),
        sa.Column('sender_id', sa.String(), nullable=False),
        sa.Column('message_type', sa.String(length=20), nullable=False),
        sa.Column('is_encrypted', sa.Boolean(), nullable=False),
        sa.Column('sender_key_id', sa.String(length=80), nullable=True),
        sa.Column('encrypted_body', sa.Text(), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('media_url', sa.String(length=255), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['room_id'], ['chat_rooms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_messages_room_id'), 'messages', ['room_id'], unique=False)
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)

    op.create_table(
        'media_preferences',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('storage_mode', sa.String(length=20), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_media_pref_user'),
    )
    op.create_index(op.f('ix_media_preferences_user_id'), 'media_preferences', ['user_id'], unique=False)

    op.create_table(
        'backup_snapshots',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('encrypted_payload', sa.Text(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_backup_snapshots_user_id'), 'backup_snapshots', ['user_id'], unique=False)

    op.create_table(
        'call_rooms',
        sa.Column('chat_room_id', sa.String(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['chat_room_id'], ['chat_rooms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'call_participants',
        sa.Column('call_room_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['call_room_id'], ['call_rooms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('call_room_id', 'user_id', name='uq_call_user'),
    )
    op.create_index(op.f('ix_call_participants_call_room_id'), 'call_participants', ['call_room_id'], unique=False)
    op.create_index(op.f('ix_call_participants_user_id'), 'call_participants', ['user_id'], unique=False)

    op.create_table(
        'user_key_bundles',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('identity_key', sa.Text(), nullable=False),
        sa.Column('signed_prekey', sa.Text(), nullable=False),
        sa.Column('signed_prekey_signature', sa.Text(), nullable=False),
        sa.Column('one_time_prekeys_json', sa.Text(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_key_bundle_user'),
    )
    op.create_index(op.f('ix_user_key_bundles_user_id'), 'user_key_bundles', ['user_id'], unique=False)

    op.create_table(
        'device_push_tokens',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('platform', sa.String(length=20), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('device_name', sa.String(length=120), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('platform', 'token', name='uq_push_platform_token'),
    )
    op.create_index(op.f('ix_device_push_tokens_user_id'), 'device_push_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_device_push_tokens_token'), 'device_push_tokens', ['token'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_device_push_tokens_token'), table_name='device_push_tokens')
    op.drop_index(op.f('ix_device_push_tokens_user_id'), table_name='device_push_tokens')
    op.drop_table('device_push_tokens')

    op.drop_index(op.f('ix_user_key_bundles_user_id'), table_name='user_key_bundles')
    op.drop_table('user_key_bundles')

    op.drop_index(op.f('ix_call_participants_user_id'), table_name='call_participants')
    op.drop_index(op.f('ix_call_participants_call_room_id'), table_name='call_participants')
    op.drop_table('call_participants')

    op.drop_table('call_rooms')

    op.drop_index(op.f('ix_backup_snapshots_user_id'), table_name='backup_snapshots')
    op.drop_table('backup_snapshots')

    op.drop_index(op.f('ix_media_preferences_user_id'), table_name='media_preferences')
    op.drop_table('media_preferences')

    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_room_id'), table_name='messages')
    op.drop_table('messages')

    op.drop_index(op.f('ix_chat_room_members_user_id'), table_name='chat_room_members')
    op.drop_index(op.f('ix_chat_room_members_room_id'), table_name='chat_room_members')
    op.drop_table('chat_room_members')

    op.drop_table('chat_rooms')

    op.drop_index(op.f('ix_session_tokens_refresh_token_hash'), table_name='session_tokens')
    op.drop_index(op.f('ix_session_tokens_user_id'), table_name='session_tokens')
    op.drop_table('session_tokens')

    op.drop_index(op.f('ix_users_phone_number'), table_name='users')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_table('users')
