"""create push_subscriptions table and add unique constraint to notificaciones_leidas

Revision ID: d192a34b5c89
Revises: e7f12a34b567
Create Date: 2026-09-15 00:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd192a34b5c89'
down_revision: Union[str, None] = 'e7f12a34b567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear tabla push_subscriptions
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.Text(), nullable=False),
        sa.Column('auth', sa.Text(), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('usuario_id', 'endpoint', name='uix_usuario_push_endpoint')
    )
    op.create_index(op.f('ix_push_subscriptions_endpoint'), 'push_subscriptions', ['endpoint'], unique=True)
    op.create_index(op.f('ix_push_subscriptions_usuario_id'), 'push_subscriptions', ['usuario_id'], unique=False)

    # 2. Añadir restricción de unicidad para lecturas de notificaciones
    op.create_unique_constraint('uq_usuario_notificacion_leida', 'notificaciones_leidas', ['usuario_id', 'notificacion_id'])


def downgrade() -> None:
    op.drop_constraint('uq_usuario_notificacion_leida', 'notificaciones_leidas', type_='unique')
    op.drop_index(op.f('ix_push_subscriptions_usuario_id'), table_name='push_subscriptions')
    op.drop_index(op.f('ix_push_subscriptions_endpoint'), table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
