"""0011_contact_settings_smtp_fields

Revision ID: 7a8e91d05b32
Revises: 62da274a74ca
Create Date: 2026-11-07 20:18:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '7a8e91d05b32'
down_revision: Union[str, None] = '62da274a74ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contact_settings', sa.Column('smtp_host', sa.String(length=255), nullable=True))
    op.add_column('contact_settings', sa.Column('smtp_port', sa.Integer(), server_default='587', nullable=True))
    op.add_column('contact_settings', sa.Column('smtp_user', sa.String(length=255), nullable=True))
    op.add_column('contact_settings', sa.Column('smtp_password', sa.String(length=255), nullable=True))
    op.add_column('contact_settings', sa.Column('smtp_from_email', sa.String(length=255), nullable=True))
    op.add_column('contact_settings', sa.Column('smtp_from_name', sa.String(length=100), server_default='TrustMyLab Notifications', nullable=True))
    op.add_column('contact_settings', sa.Column('smtp_use_tls', sa.Boolean(), server_default='1', nullable=True))


def downgrade() -> None:
    op.drop_column('contact_settings', 'smtp_use_tls')
    op.drop_column('contact_settings', 'smtp_from_name')
    op.drop_column('contact_settings', 'smtp_from_email')
    op.drop_column('contact_settings', 'smtp_password')
    op.drop_column('contact_settings', 'smtp_user')
    op.drop_column('contact_settings', 'smtp_port')
    op.drop_column('contact_settings', 'smtp_host')
