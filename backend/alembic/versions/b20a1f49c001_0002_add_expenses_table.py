"""0002_add_expenses_table

Revision ID: b20a1f49c001
Revises: af402504bc39
Create Date: 2026-10-09 22:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b20a1f49c001'
down_revision: Union[str, None] = 'af402504bc39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'expenses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('lab_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('payment_method', sa.String(length=50), server_default='CASH', nullable=False),
        sa.Column('vendor_name', sa.String(length=255), nullable=True),
        sa.Column('receipt_number', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['lab_id'], ['laboratories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_expenses_category'), 'expenses', ['category'], unique=False)
    op.create_index(op.f('ix_expenses_created_by_id'), 'expenses', ['created_by_id'], unique=False)
    op.create_index(op.f('ix_expenses_expense_date'), 'expenses', ['expense_date'], unique=False)
    op.create_index(op.f('ix_expenses_id'), 'expenses', ['id'], unique=False)
    op.create_index(op.f('ix_expenses_lab_id'), 'expenses', ['lab_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_expenses_lab_id'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_id'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_expense_date'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_created_by_id'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_category'), table_name='expenses')
    op.drop_table('expenses')
