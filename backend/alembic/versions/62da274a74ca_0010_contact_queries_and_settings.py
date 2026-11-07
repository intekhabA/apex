"""0010_contact_queries_and_settings

Revision ID: 62da274a74ca
Revises: i90b8c16d009
Create Date: 2026-11-07 19:13:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '62da274a74ca'
down_revision: Union[str, None] = 'i90b8c16d009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create contact_queries table if not exists
    op.create_table(
        'contact_queries',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('organization_name', sa.String(length=200), nullable=True),
        sa.Column('service_interested', sa.String(length=100), nullable=True),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='NEW', nullable=False),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_contact_queries_id'), 'contact_queries', ['id'], unique=False)
    op.create_index(op.f('ix_contact_queries_email'), 'contact_queries', ['email'], unique=False)
    op.create_index(op.f('ix_contact_queries_status'), 'contact_queries', ['status'], unique=False)

    # 2. Create contact_settings table
    op.create_table(
        'contact_settings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('recipient_email', sa.String(length=255), server_default='alam347709@gmail.com', nullable=False),
        sa.Column('support_email', sa.String(length=255), server_default='support@trustmylab.in', nullable=False),
        sa.Column('contact_phone', sa.String(length=50), server_default='+91 94150 05517', nullable=False),
        sa.Column('office_address', sa.String(length=255), nullable=True),
        sa.Column('working_hours', sa.String(length=100), nullable=True),
        sa.Column('notification_subject_template', sa.String(length=255), nullable=False),
        sa.Column('notification_body_template', sa.Text(), nullable=False),
        sa.Column('auto_reply_enabled', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('auto_reply_subject_template', sa.String(length=255), nullable=False),
        sa.Column('auto_reply_body_template', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_contact_settings_id'), 'contact_settings', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_contact_settings_id'), table_name='contact_settings')
    op.drop_table('contact_settings')
    op.drop_index(op.f('ix_contact_queries_status'), table_name='contact_queries')
    op.drop_index(op.f('ix_contact_queries_email'), table_name='contact_queries')
    op.drop_index(op.f('ix_contact_queries_id'), table_name='contact_queries')
    op.drop_table('contact_queries')
