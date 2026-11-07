"""0008_add_timezone_to_laboratory_settings

Revision ID: h80a7b05c008
Revises: g70f6a94b007
Create Date: 2026-11-07 13:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h80a7b05c008'
down_revision: Union[str, None] = 'g70f6a94b007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    ls_cols = [c['name'] for c in inspector.get_columns('laboratory_settings')]
    if 'timezone' not in ls_cols:
        op.add_column(
            'laboratory_settings',
            sa.Column('timezone', sa.String(50), server_default='Asia/Kolkata', nullable=False)
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    ls_cols = [c['name'] for c in inspector.get_columns('laboratory_settings')]
    if 'timezone' in ls_cols:
        op.drop_column('laboratory_settings', 'timezone')
