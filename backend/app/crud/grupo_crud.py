import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.grupo import Grupo, MiembroGrupo
from app.models.usuario import Usuario, LedgerTransaccion
from app.schemas.grupo_schemas import (
    GroupCreate,
    UserGroupCardResponse,
    GroupInviteResponse,
    GroupMemberResponse,
    GroupUpdateRequest,
)
from app.security import get_password_hash, verify_password

# ==============================================================================
# Operaciones CRUD para Comunidades y Grupos Multi-Tenancy (QuestFest)
# ==============================================================================
# Este módulo administra las comunidades autónomas:
# 1. Generación de códigos únicos seguros sin ambigüedades visuales (CSPRNG).
# 2. Creación de grupos e investidura automática del creador como Administrador local.
# 3. Inscripción mediante código o clave privada, y desvinculación segura.
# 4. Gestión de miembros, invitaciones por código QR y rotación de códigos de acceso.
# ==============================================================================

def generate_random_code(length: int = 6) -> str:
    """
    Genera un código alfanumérico legible mediante un generador criptográficamente seguro (secrets).
    
    ¿Por qué se excluyen ciertos caracteres?
    El alfabeto omite 'I', '1', 'O' y '0' para que cuando un usuario comparta el código
    oralmente o lo lea en la pantalla de un móvil, no existan dudas sobre qué carácter escribir.
    """
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(chars) for _ in range(length))

async def generate_unique_group_code(db: AsyncSession) -> str:
    """
    Genera un código con prefijo 'QF-' asegurando que no exista colisión en PostgreSQL.
    Reintenta hasta 10 veces en caso improbable de colisión criptográfica.
    """
    for _ in range(10):
        code = f"QF-{generate_random_code(5)}"
        existing = await db.scalar(select(Grupo).where(Grupo.codigo_unico == code))
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="No se pudo generar un código único para el grupo.")

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
        creador_id=creator_id
    )
    db.add(grupo)
    await db.flush() # Flush intermedio para obtener el ID asignado por PostgreSQL

    # El creador adquiere de forma inmediata el rol de 'admin' dentro de su grupo
    miembro_admin = MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=creator_id,
        rol="admin",
        saldo_grupo=grupo.saldo_inicial
    )
    db.add(miembro_admin)

    # Asiento contable de bienvenida en el Ledger para el fundador del evento
    if grupo.saldo_inicial > 0:
        transaccion_admin = LedgerTransaccion(
            usuario_id=creator_id,
            grupo_id=grupo.id,
            cantidad=grupo.saldo_inicial,
            concepto=f"Saldo inicial de bienvenida al fundar el grupo {grupo.nombre}",
            saldo_resultante=grupo.saldo_inicial
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
                MiembroGrupo.saldo_grupo > miembro.saldo_grupo
            )
        )
        ranking_pos = (higher_count or 0) + 1

        # Total de miembros en el grupo
        total_members = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(MiembroGrupo.grupo_id == grupo.id)
        )

        cards.append(UserGroupCardResponse(
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
            creador_id=grupo.creador_id
        ))

    return cards

async def join_group(db: AsyncSession, user_id: int, code: str, password: str | None = None) -> Grupo:
    """
    Permite a un usuario incorporarse a un grupo mediante su código único y contraseña opcional.
    """
    clean_code = code.strip().upper()
    grupo = await db.scalar(select(Grupo).where(Grupo.codigo_unico == clean_code))
    if not grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ningún grupo con ese código identificativo.")

    # Verificar si el usuario ya es miembro
    existente = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == grupo.id,
            MiembroGrupo.usuario_id == user_id
        )
    )
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya eres miembro de este grupo.")

    # Validar contraseña si el grupo la requiere
    if grupo.requiere_password:
        if not password or not verify_password(password.strip(), grupo.password_hash or ""):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Contraseña de grupo incorrecta o no suministrada."
            )

    # Mitigación de exploit 'Abandono y Reingreso' (Infinite Money Glitch):
    # Comprobamos en el Ledger si el usuario ya recibió el bono de bienvenida en esta comunidad.
    # Si ya fue miembro en el pasado y cobró sus tokens iniciales, al reingresar inicia con 0 QuestCoins,
    # impidiendo duplicar fondos abandonando y uniéndose de forma repetida.
    historial_bienvenida = await db.scalar(
        select(LedgerTransaccion.id).where(
            LedgerTransaccion.usuario_id == user_id,
            LedgerTransaccion.grupo_id == grupo.id,
            LedgerTransaccion.concepto.ilike("%Saldo inicial de bienvenida%")
        )
    )
    saldo_a_otorgar = 0 if historial_bienvenida else grupo.saldo_inicial

    # Añadir membresía con saldo asignado
    nuevo_miembro = MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=user_id,
        rol="member",
        saldo_grupo=saldo_a_otorgar
    )
    db.add(nuevo_miembro)

    # Asiento contable de bienvenida en el Ledger si se le otorgan fichas iniciales
    if saldo_a_otorgar > 0:
        transaccion_bienvenida = LedgerTransaccion(
            usuario_id=user_id,
            grupo_id=grupo.id,
            cantidad=saldo_a_otorgar,
            concepto=f"Saldo inicial de bienvenida al unirte al grupo {grupo.nombre}",
            saldo_resultante=saldo_a_otorgar
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
            MiembroGrupo.usuario_id == user_id
        )
    )
    if not miembro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No eres miembro de este grupo.")

    # Si es el creador/admin, comprobar si quedan otros administradores
    if miembro.rol == "admin":
        other_admins = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(
                MiembroGrupo.grupo_id == group_id,
                MiembroGrupo.usuario_id != user_id,
                MiembroGrupo.rol == "admin"
            )
        )
        if other_admins == 0:
            # Si era el único administrador pero hay más miembros, no puede abandonar sin delegar
            total_members = await db.scalar(
                select(func.count(MiembroGrupo.id)).where(MiembroGrupo.grupo_id == group_id)
            )
            if (total_members or 0) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Eres el único administrador de este grupo. Debes nombrar a otro administrador antes de salir."
                )

    await db.delete(miembro)
    await db.commit()

async def get_group_invite_data(db: AsyncSession, user_id: int, group_id: int) -> GroupInviteResponse:
    """
    Retorna los datos de invitación y el código QR.
    RESTRICCIÓN DE SEGURIDAD: Exclusivo para usuarios con rol de Administrador en este grupo.
    """
    miembro = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == user_id
        )
    )
    if not miembro or miembro.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: solo los Administradores del grupo tienen permiso para ver y compartir invitaciones."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado.")

    link = f"/join/{grupo.codigo_unico}"

    return GroupInviteResponse(
        codigo_unico=grupo.codigo_unico,
        codigo_invitacion=grupo.codigo_unico,
        nombre=grupo.nombre,
        enlace_invitacion=link,
        qr_payload=link
    )

async def update_member_role(db: AsyncSession, admin_user_id: int, group_id: int, target_user_id: int, new_role: str) -> None:
    """
    Permite al fundador del grupo delegar o retirar permisos de administración a los participantes.
    
    ¿Por qué estas reglas de negocio y restricciones estrictas?
    1. Soberanía del Fundador: En comunidades autogestionadas, únicamente el creador original
       (propietario del evento) puede decidir quién asciende a administrador y quién es revocado.
       Esto previene motines o degradaciones cruzadas entre administradores secundarios.
    2. Inmutabilidad del Creador: El fundador nunca puede perder su rol de administrador,
       ni por acción propia (desasignación voluntaria accidental) ni por revocación de terceros.
    3. Invariante de Administrador Activo: Ningún grupo puede quedarse sin administradores.
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id
        )
    )
    if not admin_member or admin_member.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado: requiere rol de administrador del grupo."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado.")

    # Soberanía Exclusiva del Fundador: Tanto la promoción como la revocación de roles
    # están reservadas únicamente al creador original de la comunidad.
    if admin_user_id != grupo.creador_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el creador del grupo tiene permisos para cambiar los roles de los miembros (ascender o revocar administradores)."
        )

    target = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == target_user_id
        )
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El usuario indicado no pertenece a este grupo.")

    # Si no hay variación efectiva en el rol, no efectuamos escrituras redundantes
    if target.rol == new_role:
        return

    # Si se intenta revocar privilegios de administrador a un participante
    if target.rol == "admin" and new_role == "member":
        # Inmutabilidad del Fundador: El creador nunca puede desasignarse ni ser degradado
        if target_user_id == grupo.creador_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El creador del grupo no puede desasignarse ni ser revocado como administrador."
            )

        # Invariante de seguridad: Aseguramos que el grupo nunca quede sin al menos un administrador activo
        remaining_admins = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(
                MiembroGrupo.grupo_id == group_id,
                MiembroGrupo.usuario_id != target_user_id,
                MiembroGrupo.rol == "admin"
            )
        )
        if (remaining_admins or 0) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El grupo nunca puede quedarse sin un administrador."
            )

    target.rol = new_role
    await db.commit()

async def get_group_members(db: AsyncSession, admin_user_id: int, group_id: int) -> list[GroupMemberResponse]:
    """
    Recupera la lista detallada de miembros de un grupo con su rol, saldo local de QuestCoins
    e indicador de si es el fundador de la comunidad.
    Exclusivo para administradores del grupo para permitir la gestión de la comunidad.
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
            MiembroGrupo.rol == "admin"
        )
    )
    if not admin_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado: solo los administradores del grupo pueden ver la lista completa de miembros."
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
        members.append(GroupMemberResponse(
            usuario_id=usuario.id,
            username=usuario.username,
            avatar_url=usuario.avatar_url,
            rol=miembro.rol,
            saldo_grupo=miembro.saldo_grupo,
            fecha_union=miembro.fecha_union,
            es_creador=(usuario.id == creador_id) if creador_id is not None else False
        ))

    return members

async def regenerate_group_code(db: AsyncSession, admin_user_id: int, group_id: int) -> GroupInviteResponse:
    """
    Regenera de forma segura el código de invitación único del grupo, invalidando
    inmediatamente el código anterior para mantener la privacidad de la peña o evento.
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
            MiembroGrupo.rol == "admin"
        )
    )
    if not admin_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado: solo los administradores del grupo pueden regenerar el código de invitación."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado.")

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
        qr_payload=link
    )

async def update_group_settings(db: AsyncSession, admin_user_id: int, group_id: int, data: GroupUpdateRequest) -> Grupo:
    """
    Permite al administrador actualizar los metadatos del grupo: nombre, descripción,
    icono y la contraseña de acceso (hasheada con bcrypt).
    """
    admin_member = await db.scalar(
        select(MiembroGrupo).where(
            MiembroGrupo.grupo_id == group_id,
            MiembroGrupo.usuario_id == admin_user_id,
            MiembroGrupo.rol == "admin"
        )
    )
    if not admin_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permiso denegado: solo los administradores del grupo pueden modificar sus ajustes."
        )

    grupo = await db.scalar(select(Grupo).where(Grupo.id == group_id))
    if not grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado.")

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
