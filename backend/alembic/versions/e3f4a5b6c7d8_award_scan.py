"""award_scan

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-07-19 18:32:31.438873

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import fastapi_users_db_sqlalchemy
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, Sequence[str], None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('award_scan',
    sa.Column('id', fastapi_users_db_sqlalchemy.generics.GUID(), nullable=False),
    sa.Column('platform', sa.String(), nullable=False),
    sa.Column('username', sa.String(), nullable=False),
    sa.Column('measurements', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('archive_watermark', sa.String(), nullable=True),
    sa.Column('games_parsed', sa.Integer(), nullable=False),
    sa.Column('scanned_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('platform', 'username', name='uq_award_scan_platform_username')
    )
    op.create_index(op.f('ix_award_scan_username'), 'award_scan', ['username'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_award_scan_username'), table_name='award_scan')
    op.drop_table('award_scan')
