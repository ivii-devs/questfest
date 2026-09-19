import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from app.models.usuario import Usuario, LedgerTransaccion
from app.schemas.grupo_schemas import GroupCreate, GroupUpdateRequest, GroupJoinRequest
from app.crud import grupo_crud
from app.crud.ledger_crud import move_tokens
from app.models.grupo import MiembroGrupo
from app.security import verify_password

@pytest.mark.asyncio
async def test_create_group_and_admin_assignment(db_session):
    # 1. Crear usuario creador
    creator = Usuario(username="el_fundador", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(creator)
    await db_session.commit()
    await db_session.refresh(creator)

    # 2. Crear grupo
    group_in = GroupCreate(nombre="Peña El Cohete", descripcion="Grupo de fiestas", password="secreto_fiesta")
    group = await grupo_crud.create_group(db_session, creator.id, group_in)

    assert group.id is not None
    assert group.codigo_unico.startswith("QF-")
    assert group.requiere_password is True
    assert group.creador_id == creator.id

    # 3. Comprobar que el creador es admin y tiene el saldo inicial de 100
    my_groups = await grupo_crud.get_user_groups(db_session, creator.id)
    assert len(my_groups) == 1
    assert my_groups[0].nombre == "Peña El Cohete"
    assert my_groups[0].rol == "admin"
    assert my_groups[0].saldo_grupo == 100
    assert my_groups[0].ranking_posicion == 1

@pytest.mark.asyncio
async def test_join_group_with_password_and_isolation(db_session):
    # 1. Creador y Miembro
    admin = Usuario(username="admin_grupo", password_hash="hash", rol="player", saldo_actual=0)
    player = Usuario(username="jugador_nuevo", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([admin, player])
    await db_session.commit()

    # 2. Crear grupo protegido por clave
    group_in = GroupCreate(nombre="Club VIP", password="clave_secreta_123")
    group = await grupo_crud.create_group(db_session, admin.id, group_in)

    # 3. Intentar unirse con clave errónea
    with pytest.raises(HTTPException) as exc_wrong:
        await grupo_crud.join_group(db_session, player.id, group.codigo_unico, password="clave_incorrecta")
    assert exc_wrong.value.status_code == 401

    # 4. Unirse con la clave correcta
    joined = await grupo_crud.join_group(db_session, player.id, group.codigo_unico, password="clave_secreta_123")
    assert joined.id == group.id

    # 5. Comprobar que el jugador tiene rol 'member'
    player_groups = await grupo_crud.get_user_groups(db_session, player.id)
    assert len(player_groups) == 1
    assert player_groups[0].rol == "member"
    assert player_groups[0].saldo_grupo == 100

    # 6. Intentar unirse de nuevo (debe fallar por duplicidad)
    with pytest.raises(HTTPException) as exc_dup:
        await grupo_crud.join_group(db_session, player.id, group.codigo_unico, password="clave_secreta_123")
    assert exc_dup.value.status_code == 400

@pytest.mark.asyncio
async def test_group_invite_security_restriction(db_session):
    # Creador y Miembro normal
    admin = Usuario(username="jefe_fiesta", password_hash="hash", rol="player", saldo_actual=0)
    member = Usuario(username="miembro_comun", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([admin, member])
    await db_session.commit()

    group_in = GroupCreate(nombre="Fiesta Segura")
    group = await grupo_crud.create_group(db_session, admin.id, group_in)
    await grupo_crud.join_group(db_session, member.id, group.codigo_unico)

    # Admin puede obtener la invitación
    invite = await grupo_crud.get_group_invite_data(db_session, admin.id, group.id)
    assert invite.codigo_unico == group.codigo_unico
    assert f"/join/{group.codigo_unico}" in invite.enlace_invitacion

    # Miembro común NO puede obtener la invitación (403 Forbidden)
    with pytest.raises(HTTPException) as exc_forbidden:
        await grupo_crud.get_group_invite_data(db_session, member.id, group.id)
    assert exc_forbidden.value.status_code == 403

@pytest.mark.asyncio
async def test_group_balance_transfer_and_overdraft(db_session):
    admin = Usuario(username="banco_grupo", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(admin)
    await db_session.commit()
    admin_id = admin.id

    group_in = GroupCreate(nombre="Casino Local")
    group = await grupo_crud.create_group(db_session, admin_id, group_in)
    group_id = group.id

    # Otorgar 50 QuestCoins dentro del grupo
    await move_tokens(db_session, admin_id, 50, "Premio de reto", group_id=group_id)

    # Verificar saldo en grupo
    groups = await grupo_crud.get_user_groups(db_session, admin_id)
    assert groups[0].saldo_grupo == 150 # 100 iniciales + 50

    # Intentar deducir 200 QuestCoins en el grupo (overdraft)
    with pytest.raises(HTTPException) as exc_overdraft:
        await move_tokens(db_session, admin_id, -200, "Apuesta desmedida", group_id=group_id)
    assert exc_overdraft.value.status_code == 400

    # El saldo debe seguir intacto en 150
    groups_after = await grupo_crud.get_user_groups(db_session, admin_id)
    assert groups_after[0].saldo_grupo == 150

@pytest.mark.asyncio
async def test_member_role_update_and_leave_protection(db_session):
    founder = Usuario(username="fundador_grupo", password_hash="hash", rol="player", saldo_actual=0)
    second_user = Usuario(username="segundo_user", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, second_user])
    await db_session.commit()

    group_in = GroupCreate(nombre="Comunidad Activa")
    group = await grupo_crud.create_group(db_session, founder.id, group_in)
    await grupo_crud.join_group(db_session, second_user.id, group.codigo_unico)

    # 1. El fundador es el único admin; si intenta salir habiendo otro miembro, debe denegarse
    with pytest.raises(HTTPException) as exc_sole_admin:
        await grupo_crud.leave_group(db_session, founder.id, group.id)
    assert exc_sole_admin.value.status_code == 400

    # 2. El fundador asciende a segundo_user a admin
    await grupo_crud.update_member_role(db_session, founder.id, group.id, second_user.id, "admin")

    # 3. Ahora que hay otro admin, el fundador sí puede salir voluntariamente
    await grupo_crud.leave_group(db_session, founder.id, group.id)

    founder_groups = await grupo_crud.get_user_groups(db_session, founder.id)
    assert len(founder_groups) == 0

    second_groups = await grupo_crud.get_user_groups(db_session, second_user.id)
    assert len(second_groups) == 1
    assert second_groups[0].rol == "admin"
    assert second_groups[0].codigo_invitacion is not None

@pytest.mark.asyncio
async def test_admin_group_settings_and_member_management(db_session):
    # 1. Preparar admin y miembro normal
    admin = Usuario(username="super_admin", password_hash="hash", rol="player", saldo_actual=0)
    member = Usuario(username="regular_member", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([admin, member])
    await db_session.commit()

    group_in = GroupCreate(nombre="Comunidad Inicial", descripcion="Fiesta 2026")
    group = await grupo_crud.create_group(db_session, admin.id, group_in)
    old_code = group.codigo_unico
    await grupo_crud.join_group(db_session, member.id, old_code)

    # 2. Comprobar listado de miembros (Admin permitido, Miembro denegado)
    members = await grupo_crud.get_group_members(db_session, admin.id, group.id)
    assert len(members) == 2
    usernames = [m.username for m in members]
    assert "super_admin" in usernames
    assert "regular_member" in usernames

    with pytest.raises(HTTPException) as exc_mem:
        await grupo_crud.get_group_members(db_session, member.id, group.id)
    assert exc_mem.value.status_code == 403

    # 3. Comprobar regeneración de código de invitación (Admin permitido, Miembro denegado)
    new_invite = await grupo_crud.regenerate_group_code(db_session, admin.id, group.id)
    assert new_invite.codigo_unico != old_code
    assert new_invite.codigo_invitacion == new_invite.codigo_unico
    assert new_invite.codigo_unico.startswith("QF-")

    with pytest.raises(HTTPException) as exc_regen:
        await grupo_crud.regenerate_group_code(db_session, member.id, group.id)
    assert exc_regen.value.status_code == 403

    # 4. Comprobar actualización de metadatos y contraseña
    update_req = GroupUpdateRequest(
        nombre="Comunidad Renombrada",
        descripcion="Nueva descripcion actualizada",
        password="clave_super_segura"
    )
    updated_group = await grupo_crud.update_group_settings(db_session, admin.id, group.id, update_req)
    assert updated_group.nombre == "Comunidad Renombrada"
    assert updated_group.descripcion == "Nueva descripcion actualizada"
    assert updated_group.requiere_password is True
    assert verify_password("clave_super_segura", updated_group.password_hash)

    with pytest.raises(HTTPException) as exc_upd:
        await grupo_crud.update_group_settings(db_session, member.id, group.id, update_req)
    assert exc_upd.value.status_code == 403

@pytest.mark.asyncio
async def test_group_ranking_query(db_session):
    """
    Verifica que el endpoint de ranking por comunidad devuelva la clasificación
    de miembros con sus saldos y métricas sin errores de importación ni de base de datos.
    """
    from app.api.routers.ranking import get_global_ranking

    # 1. Crear un usuario de prueba
    founder = Usuario(username="ranking_tester", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(founder)
    await db_session.commit()

    # 2. Crear un grupo donde se inscribe automáticamente como admin con 100 QuestCoins
    group_in = GroupCreate(nombre="Peña Ranking", descripcion="Test Ranking")
    group = await grupo_crud.create_group(db_session, founder.id, group_in)

    # 3. Consultar el ranking filtrado por el grupo recién creado
    ranking = await get_global_ranking(group_id=group.id, db=db_session)
    assert len(ranking) == 1
    assert ranking[0].username == "ranking_tester"
    assert ranking[0].saldo_actual == 100
    assert ranking[0].apuestas_acertadas == 0
    assert ranking[0].misiones_completadas == 0
    assert ranking[0].duelos_ganados == 0

    # 4. Consultar el ranking global sin group_id
    ranking_global = await get_global_ranking(group_id=None, db=db_session)
    assert any(r.username == "ranking_tester" for r in ranking_global)

def test_group_join_request_schema_compatibility():
    """
    Verifica que el schema GroupJoinRequest acepte indistintamente:
    - 'codigo_unico'
    - 'codigo_invitacion' (alias enviado por componentes frontend PWA)
    - Normalización automática a mayúsculas y eliminación de espacios en blanco
    - Rechazo cuando no se suministra ninguno
    """
    # 1. Con codigo_invitacion en minúsculas y espacios
    req_inv = GroupJoinRequest(codigo_invitacion="  qf-test1  ")
    assert req_inv.codigo_unico == "QF-TEST1"
    assert req_inv.codigo_invitacion == "QF-TEST1"

    # 2. Con codigo_unico tradicional
    req_uni = GroupJoinRequest(codigo_unico="qf-beta2")
    assert req_uni.codigo_unico == "QF-BETA2"

    # 3. Con ambos campos simultáneos
    req_both = GroupJoinRequest(codigo_unico="qf-first", codigo_invitacion="qf-first")
    assert req_both.codigo_unico == "QF-FIRST"

    # 4. Sin ningún código debe fallar la validación
    with pytest.raises(Exception):
        GroupJoinRequest()

@pytest.mark.asyncio
async def test_join_group_with_codigo_invitacion_and_duplicate_error(db_session):
    """
    Simula el flujo reportado:
    1. Un creador funda un grupo ("prueba").
    2. El creador intenta unirse a su propio grupo con el código alfanumérico copiado.
    3. Debe lanzar HTTP 400 Bad Request con detalle explicativo ("Ya eres miembro de este grupo.").
    """
    user = Usuario(username="tester_unico", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(user)
    await db_session.commit()

    group_in = GroupCreate(nombre="prueba")
    group = await grupo_crud.create_group(db_session, user.id, group_in)

    # Validar que el request con codigo_invitacion se parsea bien
    join_payload = GroupJoinRequest(codigo_invitacion=group.codigo_unico)
    assert join_payload.codigo_unico == group.codigo_unico

    # Intentar unirse a su propio grupo debe arrojar HTTP 400
    with pytest.raises(HTTPException) as exc_dup:
        await grupo_crud.join_group(
            db=db_session,
            user_id=user.id,
            code=join_payload.codigo_unico,
            password=join_payload.password
        )
    assert exc_dup.value.status_code == 400
    assert "Ya eres miembro de este grupo" in exc_dup.value.detail

@pytest.mark.asyncio
async def test_create_group_with_custom_saldo_inicial_and_ledger(db_session):
    """
    Verifica que al crear un grupo con un saldo inicial personalizado:
    1. El grupo persiste el saldo_inicial configurado.
    2. El administrador fundador recibe ese saldo exacto en su membresía.
    3. Se genera un asiento contable auditable en LedgerTransaccion con snapshot del saldo.
    """
    founder = Usuario(username="fundador_rico", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(founder)
    await db_session.commit()

    group_in = GroupCreate(nombre="Peña 500 Coins", saldo_inicial=500)
    group = await grupo_crud.create_group(db_session, founder.id, group_in)

    assert group.saldo_inicial == 500

    # Membresía del fundador
    founder_groups = await grupo_crud.get_user_groups(db_session, founder.id)
    assert len(founder_groups) == 1
    assert founder_groups[0].saldo_grupo == 500
    assert founder_groups[0].saldo_inicial == 500

    # Comprobar asiento en LedgerTransaccion
    tx = await db_session.scalar(
        select(LedgerTransaccion).where(
            LedgerTransaccion.usuario_id == founder.id,
            LedgerTransaccion.grupo_id == group.id
        )
    )
    assert tx is not None
    assert tx.cantidad == 500
    assert tx.saldo_resultante == 500
    assert "fundar el grupo Peña 500 Coins" in tx.concepto

@pytest.mark.asyncio
async def test_saldo_inicial_validation_bounds():
    """
    Garantiza que Pydantic rechaza valores negativos (< 0) y superiores al límite seguro (> 10000).
    """
    # 1. Saldo inicial negativo
    with pytest.raises(ValidationError):
        GroupCreate(nombre="Invalido Negativo", saldo_inicial=-10)

    # 2. Saldo inicial astronómico
    with pytest.raises(ValidationError):
        GroupCreate(nombre="Invalido Excesivo", saldo_inicial=10001)

    # 3. Saldo inicial válido en los límites
    valid_zero = GroupCreate(nombre="Comunidad Cero", saldo_inicial=0)
    assert valid_zero.saldo_inicial == 0

    valid_max = GroupCreate(nombre="Comunidad Max", saldo_inicial=10000)
    assert valid_max.saldo_inicial == 10000

@pytest.mark.asyncio
async def test_join_group_welcome_ledger_and_rejoin_exploit_mitigation(db_session):
    """
    Prueba integral de seguridad:
    1. Un miembro se une y recibe el saldo_inicial (300) con apunte en Ledger.
    2. El miembro gasta o pierde tokens y abandona voluntariamente el grupo.
    3. El miembro vuelve a unirse con el mismo código de invitación.
    4. MITIGACIÓN DE EXPLOIT: Al ser reingreso, el sistema detecta su bono previo y le asigna 0 tokens,
       evitando el farmeo infinito de QuestCoins.
    """
    admin = Usuario(username="admin_fiesta_300", password_hash="hash", rol="player", saldo_actual=0)
    user = Usuario(username="jugador_astuto", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([admin, user])
    await db_session.commit()

    group_in = GroupCreate(nombre="Evento 300 Coins", saldo_inicial=300)
    group = await grupo_crud.create_group(db_session, admin.id, group_in)

    # Paso 1: Jugador se une por primera vez
    await grupo_crud.join_group(db_session, user.id, group.codigo_unico)
    user_groups = await grupo_crud.get_user_groups(db_session, user.id)
    assert user_groups[0].saldo_grupo == 300

    # Verificar que existe su transacción inicial en el Ledger
    tx_first = await db_session.scalar(
        select(LedgerTransaccion).where(
            LedgerTransaccion.usuario_id == user.id,
            LedgerTransaccion.grupo_id == group.id
        )
    )
    assert tx_first is not None
    assert tx_first.cantidad == 300

    # Paso 2: Abandona el grupo
    await grupo_crud.leave_group(db_session, user.id, group.id)
    user_groups_after_leave = await grupo_crud.get_user_groups(db_session, user.id)
    assert len(user_groups_after_leave) == 0

    # Paso 3: Vuelve a unirse mediante el código de invitación (intento de exploit)
    await grupo_crud.join_group(db_session, user.id, group.codigo_unico)
    user_groups_rejoined = await grupo_crud.get_user_groups(db_session, user.id)
    assert len(user_groups_rejoined) == 1
    # Debe tener 0 tokens, NO 300 nuevamente
    assert user_groups_rejoined[0].saldo_grupo == 0

@pytest.mark.asyncio
async def test_update_group_saldo_inicial_setting(db_session):
    """
    Verifica que el administrador puede modificar el saldo_inicial en ajustes del grupo,
    y que este cambio aplica a los futuros miembros sin alterar a los ya existentes.
    """
    admin = Usuario(username="admin_modificador", password_hash="hash", rol="player", saldo_actual=0)
    existing_member = Usuario(username="miembro_viejo", password_hash="hash", rol="player", saldo_actual=0)
    new_member = Usuario(username="miembro_nuevo", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([admin, existing_member, new_member])
    await db_session.commit()

    # 1. Grupo creado con 100 de saldo inicial
    group_in = GroupCreate(nombre="Peña Evolutiva", saldo_inicial=100)
    group = await grupo_crud.create_group(db_session, admin.id, group_in)
    await grupo_crud.join_group(db_session, existing_member.id, group.codigo_unico)

    # 2. Admin actualiza saldo_inicial a 250
    update_req = GroupUpdateRequest(saldo_inicial=250)
    updated_group = await grupo_crud.update_group_settings(db_session, admin.id, group.id, update_req)
    assert updated_group.saldo_inicial == 250

    # 3. El miembro existente preserva su saldo previo (100)
    old_member_groups = await grupo_crud.get_user_groups(db_session, existing_member.id)
    assert old_member_groups[0].saldo_grupo == 100

    # 4. El nuevo miembro que se une después recibe el nuevo saldo (250)
    await grupo_crud.join_group(db_session, new_member.id, group.codigo_unico)
    new_member_groups = await grupo_crud.get_user_groups(db_session, new_member.id)
    assert new_member_groups[0].saldo_grupo == 250

@pytest.mark.asyncio
async def test_founder_cannot_unassign_self_as_admin(db_session):
    """
    Regla 1: El creador y administrador del grupo nunca puede desasignarse
    ni revocar su propio rol de administrador, impidiendo que el grupo quede acéfalo.
    """
    founder = Usuario(username="fundador_inmutable", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(founder)
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Comunidad Fundador"))

    # Intentar desasignarse a sí mismo como administrador debe arrojar HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        await grupo_crud.update_member_role(
            db=db_session,
            admin_user_id=founder.id,
            group_id=group.id,
            target_user_id=founder.id,
            new_role="member"
        )
    assert exc_info.value.status_code == 400
    assert "creador del grupo no puede desasignarse" in exc_info.value.detail.lower()

@pytest.mark.asyncio
async def test_founder_exclusive_sovereignty_over_roles(db_session):
    """
    Regla 2: Únicamente el fundador del grupo tiene potestad para:
    1. Ascender a miembros normales a administradores.
    2. Revocar el rol de administrador a otros administradores.
    Los administradores delegados (no fundadores) NO pueden ascender ni revocar a nadie.
    """
    founder = Usuario(username="fundador_soberano", password_hash="hash", rol="player", saldo_actual=0)
    user_b = Usuario(username="admin_secundario", password_hash="hash", rol="player", saldo_actual=0)
    user_c = Usuario(username="miembro_raso", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, user_b, user_c])
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Comunidad Jerárquica"))
    await grupo_crud.join_group(db_session, user_b.id, group.codigo_unico)
    await grupo_crud.join_group(db_session, user_c.id, group.codigo_unico)

    # 1. El fundador asciende a user_b a administrador (Permitido)
    await grupo_crud.update_member_role(db_session, founder.id, group.id, user_b.id, "admin")

    # 2. user_b (administrador delegado) intenta ascender a user_c (Denegado: 403 Forbidden)
    with pytest.raises(HTTPException) as exc_promote:
        await grupo_crud.update_member_role(db_session, user_b.id, group.id, user_c.id, "admin")
    assert exc_promote.value.status_code == 403
    assert "solo el creador" in exc_promote.value.detail.lower()

    # 3. user_b intenta revocar al fundador (Denegado: 403 Forbidden)
    with pytest.raises(HTTPException) as exc_demote_founder:
        await grupo_crud.update_member_role(db_session, user_b.id, group.id, founder.id, "member")
    assert exc_demote_founder.value.status_code == 403

    # 4. El fundador asciende a user_c a administrador (Permitido)
    await grupo_crud.update_member_role(db_session, founder.id, group.id, user_c.id, "admin")

    # 5. user_b intenta revocar a user_c (Denegado: 403 Forbidden)
    with pytest.raises(HTTPException) as exc_cross_demote:
        await grupo_crud.update_member_role(db_session, user_b.id, group.id, user_c.id, "member")
    assert exc_cross_demote.value.status_code == 403

    # 6. El fundador revoca a user_b y a user_c devolviéndolos a miembro (Permitido)
    await grupo_crud.update_member_role(db_session, founder.id, group.id, user_b.id, "member")
    await grupo_crud.update_member_role(db_session, founder.id, group.id, user_c.id, "member")

    members = await grupo_crud.get_group_members(db_session, founder.id, group.id)
    roles_by_id = {m.usuario_id: m.rol for m in members}
    assert roles_by_id[founder.id] == "admin"
    assert roles_by_id[user_b.id] == "member"
    assert roles_by_id[user_c.id] == "member"

@pytest.mark.asyncio
async def test_group_responses_metadata_creator(db_session):
    """
    Verifica que las respuestas de miembros y tarjetas de grupo expongan correctamente
    es_creador y creador_id para el frontend.
    """
    founder = Usuario(username="creador_verif", password_hash="hash", rol="player", saldo_actual=0)
    member = Usuario(username="miembro_verif", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, member])
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Comunidad Metadata"))
    await grupo_crud.join_group(db_session, member.id, group.codigo_unico)

    # get_user_groups debe exponer creador_id
    cards = await grupo_crud.get_user_groups(db_session, founder.id)
    assert cards[0].creador_id == founder.id

    # get_group_members debe marcar es_creador=True para el fundador y False para el miembro
    members = await grupo_crud.get_group_members(db_session, founder.id, group.id)
    founder_resp = next(m for m in members if m.usuario_id == founder.id)
    member_resp = next(m for m in members if m.usuario_id == member.id)

    assert founder_resp.es_creador is True
    assert member_resp.es_creador is False





