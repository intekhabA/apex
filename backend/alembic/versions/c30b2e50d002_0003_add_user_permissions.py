"""0003_add_user_permissions

Revision ID: c30b2e50d002
Revises: b20a1f49c001
Create Date: 2026-10-10 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c30b2e50d002'
down_revision: Union[str, None] = 'b20a1f49c001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]
    if 'permissions' not in columns:
        op.add_column('users', sa.Column('permissions', sa.JSON(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]
    if 'permissions' in columns:
        op.drop_column('users', 'permissions')
