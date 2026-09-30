"""
================================================================================
OPERACIONES CRUD PARA COMUNIDADES Y GRUPOS MULTI-TENANCY: QuestFest
================================================================================
Este módulo administra la persistencia de las comunidades autónomas:
1. Creación de grupos e investidura automática del creador como Administrador.
2. Incorporación mediante código o clave privada con mitigación de reingreso.
3. Gestión de miembros, roles, invitaciones y rotación de códigos de acceso.
4. Eliminación soberana con auditoría desacoplada (Zero-Trust).
5. Desacoplado del protocolo HTTP mediante excepciones limpias del dominio.
================================================================================
"""

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.code_generator import generate_random_code, generate_unique_group_code
from app.core.exceptions import (
    ConflictError,
    EntityNotFoundError,
    InvalidStateTransitionError,
    PermissionDeniedError,
    UnauthorizedError,
)
from app.models.audit import AuditLog
from app.models.grupo import Grupo, MiembroGrupo
from app.models.usuario import LedgerTransaccion, Usuario
from app.schemas.grupo_schemas import (
    GroupCreate,
    GroupInviteResponse,
    GroupMemberResponse,
    GroupUpdateRequest,
    UserGroupCardResponse,
)
from app.security import get_password_hash, verify_password

# Re-exportamos para compatibilidad si algún módulo legacy lo importa desde aquí
__all__ = [
    "generate_random_code",
    "generate_unique_group_code",
    "create_group",
    "get_user_groups",
    "join_group",
    "leave_group",
    "get_group_invite_data",
    "update_member_role",
    "get_group_members",
    "regenerate_group_code",
    "update_group_settings",
    "delete_group",
]


async def create_group(db: AsyncSession, creator_id: int, data: GroupCreate) -> Grupo:
    """
    Funda un nuevo grupo independiente, nombra al creador como Administrador
    e inicializa su saldo local de QuestCoins de forma auditable en el Ledger.
    """
    codigo = await generate_unique_group_code(db)

    requiere_pass = bool(data.password and data.password.strip())
    pass_hash = get_password_hash(data.password.strip()) if requiere_pass else None

    # Saldo inicial configurable (por defecto 100 QuestCoins, validado en esquema entre 0 y 10.000)
    saldo_inicial_definido = data.saldo_inicial if data.saldo_inicial is not None else 100

    grupo = Grupo(
        codigo_unico=codigo,
        nombre=data.nombre.strip(),
        descripcion=data.descripcion.strip() if data.descripcion else None,
        icono_url=data.icono_url,
        requiere_password=requiere_pass,
        password_hash=pass_hash,
        saldo_inicial=saldo_inicial_definido,
        creador_id=creator_id,
    )
    db.add(grupo)
    await db.flush()  # Flush intermedio para obtener el ID asignado por PostgreSQL

    # El creador adquiere de forma inmediata el rol de 'admin' dentro de su grupo
    miembro_admin = MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=creator_id,
        rol="admin",
        saldo_grupo=grupo.saldo_inicial,
    )
    db.add(miembro_admin)

    # Asiento contable de bienvenida en el Ledger para el fundador del evento
    if grupo.saldo_inicial > 0:
        transaccion_admin = LedgerTransaccion(
            usuario_id=creator_id,
            grupo_id=grupo.id,
            cantidad=grupo.saldo_inicial,
            concepto=f"Saldo inicial de bienvenida al fundar el grupo {grupo.nombre}",
            saldo_resultante=grupo.saldo_inicial,
        )
        db.add(transaccion_admin)

    await db.commit()
    await db.refresh(grupo)
    return grupo


async def get_user_groups(db: AsyncSession, user_id: int) -> list[UserGroupCardResponse]:
    """
    Recupera todos los grupos a los que pertenece el usuario, incluyendo su saldo local de QuestCoins
    y la posición calculada en el ranking de cada grupo.
    """
    stmt = (
        select(MiembroGrupo, Grupo)
        .join(Grupo, MiembroGrupo.grupo_id == Grupo.id)
        .where(MiembroGrupo.usuario_id == user_id)
        .order_by(MiembroGrupo.fecha_union.desc())
    )
    result = await db.execute(stmt)
    records = result.all()

    cards = []
    for miembro, grupo in records:
        # Calcular posición en el ranking dentro del grupo
        higher_count = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(
                MiembroGrupo.grupo_id == grupo.id,
                MiembroGrupo.saldo_grupo > miembro.saldo_grupo,
            )
        )
        ranking_pos = (higher_count or 0) + 1

        # Total de miembros en el grupo
        total_members = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(MiembroGrupo.grupo_id == grupo.id)
        )

        cards.append(
            UserGroupCardResponse(
                id=grupo.id,
                codigo_unico=grupo.codigo_unico,
                codigo_invitacion=grupo.codigo_unico,
                nombre=grupo.nombre,
                descripcion=grupo.descripcion,
                icono_url=grupo.icono_url,
                avatar_url=grupo.icono_url,
                rol=miembro.rol,
                saldo_grupo=miembro.saldo_grupo,
                ranking_posicion=ranking_pos,
                miembros_totales=total_members or 1,
                requiere_password=grupo.requiere_password,
                saldo_inicial=grupo.saldo_inicial,
                creador_id=grupo.creador_id,
            )
        )

    return cards


async def join_group(
    db: AsyncSession, user_id: int, code: str, password: str | None = None
) -> Grupo:
    """
    Permite a un usuario incorporarse a un grupo mediante su código único y contraseña opcional.
    """
    clean_code = code.strip().upper()
    grupo = await db.scalar(select(Grupo).where(Grupo.codigo_unico == clean_code))
    if not grupo:
        raise EntityNotFoundError("No existe ningún grupo con ese código identificativo.")

    # Verificar si el usuario ya es miembro
    existente = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == grupo.id,
            MiembroGrupo.usuario_id == user_id,
        )
    )
    if existente:
        raise ConflictError("Ya eres miembro de este grupo.")

    # Validar contraseña si el grupo la requiere
    if grupo.requiere_password:
        if not password or not verify_password(password.strip(), grupo.password_hash or ""):
            raise UnauthorizedError("Contraseña de grupo incorrecta o no suministrada.")

    # Mitigación de exploit 'Abandono y Reingreso' (Infinite Money Glitch):
    historial_bienvenida = await db.scalar(
        select(LedgerTransaccion.id).where(
            LedgerTransaccion.usuario_id == user_id,
            LedgerTransaccion.grupo_id == grupo.id,
            LedgerTransaccion.concepto.ilike("%Saldo inicial de bienvenida%"),
        )
    )
    saldo_a_otorgar = 0 if historial_bienvenida else grupo.saldo_inicial

    # Añadir membresía con saldo asignado
    nuevo_miembro = MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=user_id,
        rol="member",
        saldo_grupo=saldo_a_otorgar,
    )
    db.add(nuevo_miembro)

    # Asiento contable de bienvenida en el Ledger si se le otorgan fichas iniciales
    if saldo_a_otorgar > 0:
        transaccion_bienvenida = LedgerTransaccion(
            usuario_id=user_id,
            grupo_id=grupo.id,
            cantidad=saldo_a_otorgar,
            concepto=f"Saldo inicial de bienvenida al unirte al grupo {grupo.nombre}",
            saldo_resultante=saldo_a_otorgar,
        )
        db.add(transaccion_bienvenida)

    await db.commit()
    await db.refresh(grupo)
    return grupo


async def leave_group(db: AsyncSession, user_id: int, group_id: int) -> None:
    """
    Da de baja la membresía del usuario en el grupo especificado.
    """
    miembro = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == user_id,
        )
    )
    if not miembro:
        raise EntityNotFoundError("No eres miembro de este grupo.")

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise EntityNotFoundError("Grupo no encontrado.")

    # Si es el creador/admin, comprobar si quedan otros administradores
    if miembro.rol == "admin":
        other_admins = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(
                MiembroGrupo.grupo_id == group_id,
                MiembroGrupo.usuario_id != user_id,
                MiembroGrupo.rol == "admin",
            )
        )
        if other_admins == 0:
            # Si era el único administrador pero hay más miembros, no puede abandonar sin delegar
            total_members = await db.scalar(
                select(func.count(MiembroGrupo.id)).where(MiembroGrupo.grupo_id == group_id)
            )
            if (total_members or 0) > 1:
                raise InvalidStateTransitionError(
                    "Eres el único administrador de este grupo. Debes nombrar a otro administrador antes de salir."
                )

    # Flujo de Seguridad: Delegación automática de la titularidad de Creador
    if grupo.creador_id == user_id:
        next_admin = await db.scalar(
            select(MiembroGrupo)
            .where(
                MiembroGrupo.grupo_id == group_id,
                MiembroGrupo.usuario_id != user_id,
                MiembroGrupo.rol == "admin",
            )
            .order_by(MiembroGrupo.fecha_union.asc())
        )
        if next_admin:
            antiguo_creador_id = grupo.creador_id
            grupo.creador_id = next_admin.usuario_id
            audit_delegation = AuditLog(
                grupo_id=group_id,
                admin_id=user_id,
                accion="delegate_group_creator",
                entidad="grupo",
                entidad_id=group_id,
                detalles={
                    "motivo": "Baja voluntaria del creador original",
                    "antiguo_creador_id": antiguo_creador_id,
                    "nuevo_creador_id": next_admin.usuario_id,
                },
            )
            db.add(audit_delegation)
        else:
            grupo.creador_id = None

    await db.delete(miembro)
    await db.commit()


async def get_group_invite_data(
    db: AsyncSession, user_id: int, group_id: int
) -> GroupInviteResponse:
    """
    Retorna los datos de invitación y el código QR.
    RESTRICCIÓN DE SEGURIDAD: Exclusivo para usuarios con rol de Administrador en este grupo.
    """
    miembro = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == user_id,
        )
    )
    if not miembro or miembro.rol != "admin":
        raise PermissionDeniedError(
            "Acceso denegado: solo los Administradores del grupo tienen permiso para ver y compartir invitaciones."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise EntityNotFoundError("Grupo no encontrado.")

    link = f"/join/{grupo.codigo_unico}"

    return GroupInviteResponse(
        codigo_unico=grupo.codigo_unico,
        codigo_invitacion=grupo.codigo_unico,
        nombre=grupo.nombre,
        enlace_invitacion=link,
        qr_payload=link,
    )


async def update_member_role(
    db: AsyncSession,
    admin_user_id: int,
    group_id: int,
    target_user_id: int,
    new_role: str,
) -> None:
    """
    Permite al fundador del grupo delegar o retirar permisos de administración a los participantes.
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
        )
    )
    if not admin_member or admin_member.rol != "admin":
        raise PermissionDeniedError("Permiso denegado: requiere rol de administrador del grupo.")

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise EntityNotFoundError("Grupo no encontrado.")

    if admin_user_id != grupo.creador_id:
        raise PermissionDeniedError(
            "Solo el creador del grupo tiene permisos para cambiar los roles de los miembros (ascender o revocar administradores)."
        )

    target = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == target_user_id,
        )
    )
    if not target:
        raise EntityNotFoundError("El usuario indicado no pertenece a este grupo.")

    if target.rol == new_role:
        return

    if target.rol == "admin" and new_role == "member":
        if target_user_id == grupo.creador_id:
            raise InvalidStateTransitionError(
                "El creador del grupo no puede desasignarse ni ser revocado como administrador."
            )

        remaining_admins = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(
                MiembroGrupo.grupo_id == group_id,
                MiembroGrupo.usuario_id != target_user_id,
                MiembroGrupo.rol == "admin",
            )
        )
        if (remaining_admins or 0) == 0:
            raise InvalidStateTransitionError("El grupo nunca puede quedarse sin un administrador.")

    target.rol = new_role
    await db.commit()


async def get_group_members(
    db: AsyncSession, admin_user_id: int, group_id: int
) -> list[GroupMemberResponse]:
    """
    Recupera la lista detallada de miembros de un grupo con su rol, saldo local de QuestCoins
    e indicador de si es el fundador de la comunidad.
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
            MiembroGrupo.rol == "admin",
        )
    )
    if not admin_member:
        raise PermissionDeniedError(
            "Permiso denegado: solo los administradores del grupo pueden ver la lista completa de miembros."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))

    stmt = (
        select(MiembroGrupo, Usuario)
        .join(Usuario, MiembroGrupo.usuario_id == Usuario.id)
        .where(MiembroGrupo.grupo_id == group_id)
        .order_by(MiembroGrupo.rol.asc(), MiembroGrupo.fecha_union.asc())
    )
    result = await db.execute(stmt)
    records = result.all()

    members = []
    creador_id = grupo.creador_id if grupo else None
    for miembro, usuario in records:
        members.append(
            GroupMemberResponse(
                usuario_id=usuario.id,
                username=usuario.username,
                avatar_url=usuario.avatar_url,
                rol=miembro.rol,
                saldo_grupo=miembro.saldo_grupo,
                fecha_union=miembro.fecha_union,
                es_creador=(usuario.id == creador_id) if creador_id is not None else False,
            )
        )

    return members


async def regenerate_group_code(
    db: AsyncSession, admin_user_id: int, group_id: int
) -> GroupInviteResponse:
    """
    Regenera de forma segura el código de invitación único del grupo, invalidando
    inmediatamente el código anterior para mantener la privacidad de la peña o evento.
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
            MiembroGrupo.rol == "admin",
        )
    )
    if not admin_member:
        raise PermissionDeniedError(
            "Permiso denegado: solo los administradores del grupo pueden regenerar el código de invitación."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise EntityNotFoundError("Grupo no encontrado.")

    nuevo_codigo = await generate_unique_group_code(db)
    grupo.codigo_unico = nuevo_codigo
    await db.commit()
    await db.refresh(grupo)

    link = f"/join/{grupo.codigo_unico}"
    return GroupInviteResponse(
        codigo_unico=grupo.codigo_unico,
        codigo_invitacion=grupo.codigo_unico,
        nombre=grupo.nombre,
        enlace_invitacion=link,
        qr_payload=link,
    )


async def update_group_settings(
    db: AsyncSession, admin_user_id: int, group_id: int, data: GroupUpdateRequest
) -> Grupo:
    """
    Permite al administrador actualizar los metadatos del grupo: nombre, descripción,
    icono y la contraseña de acceso (hasheada con bcrypt).
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
            MiembroGrupo.rol == "admin",
        )
    )
    if not admin_member:
        raise PermissionDeniedError(
            "Permiso denegado: solo los administradores del grupo pueden modificar sus ajustes."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise EntityNotFoundError("Grupo no encontrado.")

    if data.nombre is not None and data.nombre.strip():
        grupo.nombre = data.nombre.strip()

    if data.descripcion is not None:
        grupo.descripcion = data.descripcion.strip() if data.descripcion.strip() else None

    if data.icono_url is not None:
        grupo.icono_url = data.icono_url.strip() if data.icono_url.strip() else None

    if data.password is not None:
        if data.password.strip():
            grupo.requiere_password = True
            grupo.password_hash = get_password_hash(data.password.strip())
        else:
            grupo.requiere_password = False
            grupo.password_hash = None

    if data.saldo_inicial is not None:
        grupo.saldo_inicial = data.saldo_inicial

    await db.commit()
    await db.refresh(grupo)
    return grupo


async def delete_group(db: AsyncSession, current_user_id: int, group_id: int) -> None:
    """
    Elimina definitivamente una comunidad y todos sus recursos vinculados en cascada.
    """
    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise EntityNotFoundError("No existe ningún grupo con el identificador proporcionado.")

    if grupo.creador_id != current_user_id:
        raise PermissionDeniedError(
            "Solo el creador del grupo tiene permisos para eliminar esta comunidad."
        )

    audit_entry = AuditLog(
        grupo_id=None,
        admin_id=current_user_id,
        accion="delete_group",
        entidad="grupo",
        entidad_id=group_id,
        detalles={
            "nombre": grupo.nombre,
            "codigo_unico": grupo.codigo_unico,
            "creador_id": grupo.creador_id,
            "motivo": "Eliminación definitiva solicitada por el creador",
        },
    )
    db.add(audit_entry)

    await db.delete(grupo)
    await db.commit()
