"""0009_add_platform_seo_settings

Revision ID: i90b8c16d009
Revises: h80a7b05c008
Create Date: 2026-11-07 14:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i90b8c16d009'
down_revision: Union[str, None] = 'h80a7b05c008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'platform_seo_settings' not in tables:
        op.create_table(
            'platform_seo_settings',
            sa.Column('id', sa.String(36), primary_key=True, index=True),
            sa.Column('meta_title', sa.String(255), nullable=False),
            sa.Column('meta_description', sa.Text(), nullable=False),
            sa.Column('meta_keywords', sa.Text(), nullable=False),
            sa.Column('canonical_url', sa.String(255), nullable=False),
            sa.Column('og_title', sa.String(255), nullable=False),
            sa.Column('og_description', sa.Text(), nullable=False),
            sa.Column('og_image_url', sa.String(500), nullable=True),
            sa.Column('google_site_verification', sa.String(255), nullable=True),
            sa.Column('bing_site_verification', sa.String(255), nullable=True),
            sa.Column('enable_ai_search_indexing', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('ai_knowledge_brief', sa.Text(), nullable=True),
            sa.Column('custom_schema_json', sa.Text(), nullable=True),
            sa.Column('robots_txt_content', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'platform_seo_settings' in tables:
        op.drop_table('platform_seo_settings')
