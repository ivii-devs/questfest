"""create multi group tables and grupo_id columns

Revision ID: e7f12a34b567
Revises: 27cf86e6bd6b
Create Date: 2026-09-14 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e7f12a34b567'
down_revision: Union[str, None] = '27cf86e6bd6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear tabla grupos
    op.create_table(
        'grupos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('codigo_unico', sa.String(length=12), nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('icono_url', sa.String(length=255), nullable=True),
        sa.Column('requiere_password', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('saldo_inicial', sa.Integer(), nullable=False, server_default=sa.text('100')),
        sa.Column('creador_id', sa.Integer(), nullable=True),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['creador_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_grupos_codigo_unico'), 'grupos', ['codigo_unico'], unique=True)

    # 2. Crear tabla miembros_grupo
    op.create_table(
        'miembros_grupo',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grupo_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column('rol', sa.String(length=20), nullable=False, server_default='member'),
        sa.Column('saldo_grupo', sa.Integer(), nullable=False, server_default=sa.text('100')),
        sa.Column('fecha_union', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("rol IN ('admin', 'member')", name='check_rol_grupo_valido'),
        sa.CheckConstraint('saldo_grupo >= 0', name='check_saldo_grupo_positivo'),
        sa.ForeignKeyConstraint(['grupo_id'], ['grupos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('grupo_id', 'usuario_id', name='uq_miembro_grupo')
    )
    op.create_index(op.f('ix_miembros_grupo_grupo_id'), 'miembros_grupo', ['grupo_id'], unique=False)
    op.create_index(op.f('ix_miembros_grupo_usuario_id'), 'miembros_grupo', ['usuario_id'], unique=False)

    # 3. Crear tabla audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grupo_id', sa.Integer(), nullable=True),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('accion', sa.String(length=100), nullable=False),
        sa.Column('entidad', sa.String(length=50), nullable=False),
        sa.Column('entidad_id', sa.Integer(), nullable=True),
        sa.Column('detalles', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['admin_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['grupo_id'], ['grupos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_accion'), 'audit_logs', ['accion'], unique=False)
    op.create_index(op.f('ix_audit_logs_admin_id'), 'audit_logs', ['admin_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_entidad'), 'audit_logs', ['entidad'], unique=False)
    op.create_index(op.f('ix_audit_logs_fecha_creacion'), 'audit_logs', ['fecha_creacion'], unique=False)
    op.create_index(op.f('ix_audit_logs_grupo_id'), 'audit_logs', ['grupo_id'], unique=False)

    # 4. Añadir grupo_id a tablas del dominio existentes
    for table_name in [
        'publicaciones',
        'misiones',
        'apuestas',
        'duelos',
        'ticket_apuestas',
        'registro_ruleta',
        'ledger_transacciones',
        'notificaciones_admin'
    ]:
        op.add_column(table_name, sa.Column('grupo_id', sa.Integer(), nullable=True))
        op.create_index(op.f(f'ix_{table_name}_grupo_id'), table_name, ['grupo_id'], unique=False)
        op.create_foreign_key(f'fk_{table_name}_grupo_id', table_name, 'grupos', ['grupo_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    for table_name in [
        'notificaciones_admin',
        'ledger_transacciones',
        'registro_ruleta',
        'ticket_apuestas',
        'duelos',
        'apuestas',
        'misiones',
        'publicaciones'
    ]:
        op.drop_constraint(f'fk_{table_name}_grupo_id', table_name, type_='foreignkey')
        op.drop_index(op.f(f'ix_{table_name}_grupo_id'), table_name=table_name)
        op.drop_column(table_name, 'grupo_id')

    op.drop_index(op.f('ix_audit_logs_grupo_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_fecha_creacion'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entidad'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_admin_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_accion'), table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index(op.f('ix_miembros_grupo_usuario_id'), table_name='miembros_grupo')
    op.drop_index(op.f('ix_miembros_grupo_grupo_id'), table_name='miembros_grupo')
    op.drop_table('miembros_grupo')

    op.drop_index(op.f('ix_grupos_codigo_unico'), table_name='grupos')
    op.drop_table('grupos')
