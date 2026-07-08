"""signup_verification_code

Revision ID: d2e3f4a5b6c7
Revises: c1a2b3d4e5f6
Create Date: 2026-07-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('verification_code_hash', sa.String(), nullable=True))
    op.add_column('users', sa.Column('verification_code_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('verification_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('verification_code_sent_at', sa.DateTime(), nullable=True))
    op.alter_column('users', 'verification_attempts', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'verification_code_sent_at')
    op.drop_column('users', 'verification_attempts')
    op.drop_column('users', 'verification_code_expires_at')
    op.drop_column('users', 'verification_code_hash')
