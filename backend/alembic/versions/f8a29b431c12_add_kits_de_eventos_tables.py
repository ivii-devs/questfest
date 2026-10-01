"""add kits de eventos tables

Revision ID: f8a29b431c12
Revises: e7f12a34b567
Create Date: 2026-10-01 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f8a29b431c12'
down_revision: Union[str, None] = 'e7f12a34b567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear tabla kits_eventos
    op.create_table(
        'kits_eventos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=150), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=False),
        sa.Column('categoria', sa.String(length=50), nullable=False),
        sa.Column('icono_url', sa.String(length=500), nullable=True),
        sa.Column('autor_id', sa.Integer(), nullable=True),
        sa.Column('es_oficial', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('es_publico', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('descargas_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('likes_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('contenido', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['autor_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_kits_eventos_categoria'), 'kits_eventos', ['categoria'], unique=False)
    op.create_index(op.f('ix_kits_eventos_autor_id'), 'kits_eventos', ['autor_id'], unique=False)

    # 2. Crear tabla kits_likes
    op.create_table(
        'kits_likes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('kit_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['kit_id'], ['kits_eventos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('kit_id', 'usuario_id', name='uq_kit_usuario_like')
    )
    op.create_index(op.f('ix_kits_likes_kit_id'), 'kits_likes', ['kit_id'], unique=False)
    op.create_index(op.f('ix_kits_likes_usuario_id'), 'kits_likes', ['usuario_id'], unique=False)

    # 3. Crear tabla kits_reportes
    op.create_table(
        'kits_reportes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('kit_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('motivo', sa.String(length=500), nullable=False),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['kit_id'], ['kits_eventos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_kits_reportes_kit_id'), 'kits_reportes', ['kit_id'], unique=False)
    op.create_index(op.f('ix_kits_reportes_usuario_id'), 'kits_reportes', ['usuario_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_kits_reportes_usuario_id'), table_name='kits_reportes')
    op.drop_index(op.f('ix_kits_reportes_kit_id'), table_name='kits_reportes')
    op.drop_table('kits_reportes')

    op.drop_index(op.f('ix_kits_likes_usuario_id'), table_name='kits_likes')
    op.drop_index(op.f('ix_kits_likes_kit_id'), table_name='kits_likes')
    op.drop_table('kits_likes')

    op.drop_index(op.f('ix_kits_eventos_autor_id'), table_name='kits_eventos')
    op.drop_index(op.f('ix_kits_eventos_categoria'), table_name='kits_eventos')
    op.drop_table('kits_eventos')
