"""0007_add_group_subgroup_and_footer_code_type

Revision ID: g70f6a94b007
Revises: f60e5f83a006
Create Date: 2026-10-31 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g70f6a94b007'
down_revision: Union[str, None] = 'f60e5f83a006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. test_parameters
    tp_cols = [c['name'] for c in inspector.get_columns('test_parameters')]
    if 'group_name' not in tp_cols:
        op.add_column('test_parameters', sa.Column('group_name', sa.String(100), nullable=True))
    if 'subgroup_name' not in tp_cols:
        op.add_column('test_parameters', sa.Column('subgroup_name', sa.String(150), nullable=True))

    # 2. tests
    t_cols = [c['name'] for c in inspector.get_columns('tests')]
    if 'interpretation' not in t_cols:
        op.add_column('tests', sa.Column('interpretation', sa.Text(), nullable=True))

    # 3. reports
    r_cols = [c['name'] for c in inspector.get_columns('reports')]
    if 'interpretation' not in r_cols:
        op.add_column('reports', sa.Column('interpretation', sa.Text(), nullable=True))

    # 4. test_result_values
    trv_cols = [c['name'] for c in inspector.get_columns('test_result_values')]
    if 'group_name' not in trv_cols:
        op.add_column('test_result_values', sa.Column('group_name', sa.String(100), nullable=True))
    if 'subgroup_name' not in trv_cols:
        op.add_column('test_result_values', sa.Column('subgroup_name', sa.String(150), nullable=True))

    # 5. laboratory_settings
    ls_cols = [c['name'] for c in inspector.get_columns('laboratory_settings')]
    if 'footer_code_type' not in ls_cols:
        op.add_column('laboratory_settings', sa.Column('footer_code_type', sa.String(20), server_default='BARCODE', nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    tp_cols = [c['name'] for c in inspector.get_columns('test_parameters')]
    if 'group_name' in tp_cols:
        op.drop_column('test_parameters', 'group_name')
    if 'subgroup_name' in tp_cols:
        op.drop_column('test_parameters', 'subgroup_name')

    t_cols = [c['name'] for c in inspector.get_columns('tests')]
    if 'interpretation' in t_cols:
        op.drop_column('tests', 'interpretation')

    r_cols = [c['name'] for c in inspector.get_columns('reports')]
    if 'interpretation' in r_cols:
        op.drop_column('reports', 'interpretation')

    trv_cols = [c['name'] for c in inspector.get_columns('test_result_values')]
    if 'group_name' in trv_cols:
        op.drop_column('test_result_values', 'group_name')
    if 'subgroup_name' in trv_cols:
        op.drop_column('test_result_values', 'subgroup_name')

    ls_cols = [c['name'] for c in inspector.get_columns('laboratory_settings')]
    if 'footer_code_type' in ls_cols:
        op.drop_column('laboratory_settings', 'footer_code_type')
