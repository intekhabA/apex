"""0005_add_letterhead_margins

Revision ID: e50d4f72f005
Revises: d40c3f61e004
Create Date: 2026-10-24 17:18:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e50d4f72f005'
down_revision: Union[str, None] = 'd40c3f61e004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('laboratory_settings')]
    if 'letterhead_top_margin_mm' not in columns:
        op.add_column('laboratory_settings', sa.Column('letterhead_top_margin_mm', sa.Integer(), server_default='48', default=48, nullable=True))
    if 'letterhead_bottom_margin_mm' not in columns:
        op.add_column('laboratory_settings', sa.Column('letterhead_bottom_margin_mm', sa.Integer(), server_default='28', default=28, nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('laboratory_settings')]
    if 'letterhead_top_margin_mm' in columns:
        op.drop_column('laboratory_settings', 'letterhead_top_margin_mm')
    if 'letterhead_bottom_margin_mm' in columns:
        op.drop_column('laboratory_settings', 'letterhead_bottom_margin_mm')
