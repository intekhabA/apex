"""0006_add_letterhead_image

Revision ID: f60e5f83a006
Revises: e50d4f72f005
Create Date: 2026-10-24 17:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f60e5f83a006'
down_revision: Union[str, None] = 'e50d4f72f005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('laboratory_settings')]
    if 'letterhead_image_url' not in columns:
        op.add_column('laboratory_settings', sa.Column('letterhead_image_url', sa.Text(), nullable=True))
    if 'use_letterhead_background' not in columns:
        op.add_column('laboratory_settings', sa.Column('use_letterhead_background', sa.Boolean(), server_default='1', default=True, nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('laboratory_settings')]
    if 'letterhead_image_url' in columns:
        op.drop_column('laboratory_settings', 'letterhead_image_url')
    if 'use_letterhead_background' in columns:
        op.drop_column('laboratory_settings', 'use_letterhead_background')
