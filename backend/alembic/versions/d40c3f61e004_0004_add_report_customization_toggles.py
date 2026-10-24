"""0004_add_report_customization_toggles

Revision ID: d40c3f61e004
Revises: c30b2e50d002
Create Date: 2026-10-24 03:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd40c3f61e004'
down_revision: Union[str, None] = 'c30b2e50d002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('laboratory_settings')]
    if 'show_report_header_status' not in columns:
        op.add_column('laboratory_settings', sa.Column('show_report_header_status', sa.Boolean(), server_default='1', default=True, nullable=True))
    if 'show_qr_side_text' not in columns:
        op.add_column('laboratory_settings', sa.Column('show_qr_side_text', sa.Boolean(), server_default='1', default=True, nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('laboratory_settings')]
    if 'show_report_header_status' in columns:
        op.drop_column('laboratory_settings', 'show_report_header_status')
    if 'show_qr_side_text' in columns:
        op.drop_column('laboratory_settings', 'show_qr_side_text')
