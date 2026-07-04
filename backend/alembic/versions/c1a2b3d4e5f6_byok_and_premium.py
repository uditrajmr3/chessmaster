"""byok_and_premium

Revision ID: c1a2b3d4e5f6
Revises: b8bc544e50f3
Create Date: 2026-07-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import fastapi_users_db_sqlalchemy


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'b8bc544e50f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('own_anthropic_api_key_encrypted', sa.String(), nullable=True))
    op.add_column('users', sa.Column('is_premium', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('users', sa.Column('premium_expires_at', sa.DateTime(), nullable=True))
    op.alter_column('users', 'is_premium', server_default=None)

    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', fastapi_users_db_sqlalchemy.generics.GUID(), nullable=False),
        sa.Column('razorpay_order_id', sa.String(), nullable=False),
        sa.Column('razorpay_payment_id', sa.String(), nullable=True),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('razorpay_order_id'),
    )
    op.create_index('idx_payments_user_id', 'payments', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_payments_user_id', table_name='payments')
    op.drop_table('payments')
    op.drop_column('users', 'premium_expires_at')
    op.drop_column('users', 'is_premium')
    op.drop_column('users', 'own_anthropic_api_key_encrypted')
