"""
================================================================================
ROUTER DE GESTIÓN MULTI-TENANCY DE GRUPOS: QuestFest
================================================================================
Este enrutador constituye la columna vertebral de la arquitectura Multi-Tenancy
de QuestFest.

Principios de aislamiento y seguridad:
1. Islas de Juego Independientes: Cada grupo representa una fiesta o evento privado
   separado del resto. Las QuestCoins no son transferibles entre grupos; cada miembro
   posee un `saldo_grupo` independiente administrado por `MiembroGrupo`.
2. Roles Locales vs Globales: Un usuario puede ser jugador raso a nivel global pero
   administrador de su propio grupo (o viceversa).
3. Acceso mediante Códigos CSPRNG: La incorporación a grupos se basa en códigos alfanuméricos
   de 6 caracteres no ambiguos y contraseñas hash opcionales (`bcrypt`).
4. Versatilidad REST para PWA: Rutas como `/leave` aceptan tanto `DELETE` como `POST`
   para prevenir problemas de soporte en navegadores móviles antiguos o entornos WebView.
================================================================================
"""

from typing import List

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.crud import grupo_crud
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.grupo_schemas import (
    GroupCreate,
    GroupInviteResponse,
    GroupJoinRequest,
    GroupMemberResponse,
    GroupResponse,
    GroupUpdateRequest,
    UpdateMemberRoleRequest,
    UserGroupCardResponse,
)

router = APIRouter()


@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create_new_group(
    request: Request,
    group_data: GroupCreate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Crea un nuevo grupo o fiesta privada independiente.

    El usuario creador queda automáticamente asignado con el rol 'admin'
    del grupo y recibe el saldo inicial de QuestCoins configurado para el evento.
    """
    grupo = await grupo_crud.create_group(db=db, creator_id=current_user.id, data=group_data)
    return grupo


@router.get("/me", response_model=List[UserGroupCardResponse])
@router.get("/my-groups", response_model=List[UserGroupCardResponse])
async def list_my_groups(
    current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Lista todos los grupos a los que pertenece el usuario con datos de tarjeta:
    nombre, icono, rol, saldo de QuestCoins y posición en el ranking local.
    Compatible con los endpoints /me y /my-groups requeridos por el frontend.
    """
    return await grupo_crud.get_user_groups(db=db, user_id=current_user.id)


@router.post("/join", response_model=GroupResponse)
@limiter.limit("10/minute")
async def join_group(
    request: Request,
    join_data: GroupJoinRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permite a un jugador unirse a un grupo mediante su código de 6 caracteres.

    Flujo de validación:
    - Comprueba la validez del código.
    - Si el grupo tiene contraseña (`clave_acceso_hash`), verifica la contraseña proporcionada.
    - Si el jugador no era miembro, crea el registro `MiembroGrupo` con `saldo_inicial_tokens`.
    - Si ya era miembro, devuelve los datos sin duplicar membresía.
    """
    return await grupo_crud.join_group(
        db=db, user_id=current_user.id, code=join_data.codigo_unico, password=join_data.password
    )


@router.delete("/{group_id}/leave", status_code=status.HTTP_200_OK)
@router.post("/{group_id}/leave", status_code=status.HTTP_200_OK)
async def leave_group(
    group_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Da de baja al usuario del grupo especificado.

    Compatibilidad PWA:
    Admite peticiones DELETE y POST para evitar problemas de cortafuegos proxy
    o navegadores web integrados en redes sociales que bloquean verbos DELETE.
    """
    await grupo_crud.leave_group(db=db, user_id=current_user.id, group_id=group_id)
    return {"message": "Has salido del grupo correctamente."}


@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
@router.post("/{group_id}/delete", status_code=status.HTTP_200_OK)
async def delete_group(
    group_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Elimina definitivamente el grupo y todos sus recursos vinculados en cascada.

    Restricción de Soberanía:
    Exclusivo para el fundador/creador del grupo. Cualquier intento por parte de otros
    usuarios o administradores secundarios es rechazado con HTTP 403 Forbidden.

    Compatibilidad PWA:
    Admite tanto DELETE como POST para sortear restricciones en clientes móviles y WebViews.
    """
    await grupo_crud.delete_group(db=db, current_user_id=current_user.id, group_id=group_id)
    return {"message": "El grupo ha sido eliminado definitivamente."}


@router.get("/{group_id}/invite", response_model=GroupInviteResponse)
async def get_invite_info(
    group_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna el código de invitación, link directo y QR del grupo.
    ACCESO RESTRINGIDO: Exclusivo para administradores del grupo.
    """
    return await grupo_crud.get_group_invite_data(db=db, user_id=current_user.id, group_id=group_id)


@router.get("/{group_id}/members", response_model=List[GroupMemberResponse])
async def list_group_members(
    group_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna la lista completa de miembros del grupo con sus saldos y roles asignados.
    ACCESO RESTRINGIDO: Exclusivo para administradores del grupo.
    """
    return await grupo_crud.get_group_members(
        db=db, admin_user_id=current_user.id, group_id=group_id
    )


@router.post("/{group_id}/regenerate-code", response_model=GroupInviteResponse)
async def regenerate_group_code(
    group_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Regenera el código alfanumérico único e invalida el anterior inmediatamente.
    Útil si el código de invitación se filtró a personas no deseadas.
    ACCESO RESTRINGIDO: Exclusivo para administradores del grupo.
    """
    return await grupo_crud.regenerate_group_code(
        db=db, admin_user_id=current_user.id, group_id=group_id
    )


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group_settings(
    group_id: int,
    update_data: GroupUpdateRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permite modificar los ajustes del grupo: nombre, descripción o clave de acceso.
    ACCESO RESTRINGIDO: Exclusivo para administradores del grupo.
    """
    return await grupo_crud.update_group_settings(
        db=db, admin_user_id=current_user.id, group_id=group_id, data=update_data
    )


@router.patch("/{group_id}/members/{user_id}/role", status_code=status.HTTP_200_OK)
async def change_member_role(
    group_id: int,
    user_id: int,
    role_data: UpdateMemberRoleRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permite a un administrador nombrar a otro administrador o degradar a miembro raso.
    Protege contra la eliminación del último administrador del grupo.
    """
    await grupo_crud.update_member_role(
        db=db,
        admin_user_id=current_user.id,
        group_id=group_id,
        target_user_id=user_id,
        new_role=role_data.rol,
    )
    return {"message": f"Rol de usuario actualizado a {role_data.rol}."}
