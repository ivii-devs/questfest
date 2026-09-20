import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import Grupo, MiembroGrupo
from app.models.audit import AuditLog
from app.schemas.grupo_schemas import GroupCreate, GroupUpdateRequest, GroupJoinRequest
from app.crud import grupo_crud
from app.crud.ledger_crud import move_tokens
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

@pytest.mark.asyncio
async def test_creator_can_delete_group_and_cascades(db_session):
    """
    Verifica que el creador puede eliminar su grupo y que todas las entidades
    asociadas (miembros, muro social, misiones, apuestas y ledger local) se
    eliminan atómicamente en cascada sin alterar los perfiles de usuario.
    """
    from app.models.publicaciones import Publicacion
    from app.models.misiones import Mision
    from app.models.juegos import Apuesta

    founder = Usuario(username="el_gran_fundador", password_hash="hash", rol="player", saldo_actual=0)
    player = Usuario(username="jugador_peña", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, player])
    await db_session.commit()

    # 1. Crear grupo y unir al jugador
    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Peña A Destruir"))
    await grupo_crud.join_group(db_session, player.id, group.codigo_unico)
    group_id = group.id

    # 2. Insertar publicaciones, misiones y apuestas vinculadas
    post = Publicacion(grupo_id=group_id, tipo="social", autor_id=founder.id, contenido="¡Hola a todos en la peña!")
    mision = Mision(grupo_id=group_id, titulo="Reto del Barril", creador_id=founder.id, descripcion="Beber agua", recompensa=50, fase="activa")
    apuesta = Apuesta(grupo_id=group_id, titulo="¿Quién ganará el torneo?", creador_id=founder.id, opciones={"opt1": {"text": "A"}}, fase="activa")
    db_session.add_all([post, mision, apuesta])
    await db_session.commit()

    # 3. Comprobar que existen antes de la eliminación
    assert await db_session.scalar(select(Grupo).where(Grupo.id == group_id)) is not None
    assert len((await db_session.execute(select(MiembroGrupo).where(MiembroGrupo.grupo_id == group_id))).all()) == 2
    assert await db_session.scalar(select(Publicacion).where(Publicacion.grupo_id == group_id)) is not None
    assert await db_session.scalar(select(Mision).where(Mision.grupo_id == group_id)) is not None
    assert await db_session.scalar(select(Apuesta).where(Apuesta.grupo_id == group_id)) is not None

    # 4. El creador ejecuta la eliminación definitiva
    await grupo_crud.delete_group(db=db_session, current_user_id=founder.id, group_id=group_id)

    # 5. Comprobar que el grupo y sus recursos vinculados desaparecieron en cascada
    assert await db_session.scalar(select(Grupo).where(Grupo.id == group_id)) is None
    assert len((await db_session.execute(select(MiembroGrupo).where(MiembroGrupo.grupo_id == group_id))).all()) == 0
    assert await db_session.scalar(select(Publicacion).where(Publicacion.grupo_id == group_id)) is None
    assert await db_session.scalar(select(Mision).where(Mision.grupo_id == group_id)) is None
    assert await db_session.scalar(select(Apuesta).where(Apuesta.grupo_id == group_id)) is None
    assert len((await db_session.execute(select(LedgerTransaccion).where(LedgerTransaccion.grupo_id == group_id))).all()) == 0

    # 6. Los usuarios deben seguir existiendo en la plataforma intactos
    assert await db_session.scalar(select(Usuario).where(Usuario.id == founder.id)) is not None
    assert await db_session.scalar(select(Usuario).where(Usuario.id == player.id)) is not None

@pytest.mark.asyncio
async def test_non_creator_admin_cannot_delete_group(db_session):
    """
    Seguridad Estricta: Un usuario que tenga rol 'admin' pero que NO sea el creador
    original no puede eliminar el grupo bajo ninguna circunstancia.
    """
    founder = Usuario(username="fundador_real", password_hash="hash", rol="player", saldo_actual=0)
    secondary_admin = Usuario(username="admin_secundario_del", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, secondary_admin])
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Comunidad Protegida"))
    await grupo_crud.join_group(db_session, secondary_admin.id, group.codigo_unico)
    await grupo_crud.update_member_role(db_session, founder.id, group.id, secondary_admin.id, "admin")

    with pytest.raises(HTTPException) as exc_info:
        await grupo_crud.delete_group(db=db_session, current_user_id=secondary_admin.id, group_id=group.id)

    assert exc_info.value.status_code == 403
    assert "Solo el creador" in exc_info.value.detail

@pytest.mark.asyncio
async def test_regular_member_cannot_delete_group(db_session):
    """
    Seguridad Estricta: Un miembro común recibe HTTP 403 Forbidden al intentar eliminar.
    """
    founder = Usuario(username="fundador_festejo", password_hash="hash", rol="player", saldo_actual=0)
    member = Usuario(username="miembro_curioso", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, member])
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Peña Inviolable"))
    await grupo_crud.join_group(db_session, member.id, group.codigo_unico)

    with pytest.raises(HTTPException) as exc_info:
        await grupo_crud.delete_group(db=db_session, current_user_id=member.id, group_id=group.id)

    assert exc_info.value.status_code == 403
    assert "Solo el creador" in exc_info.value.detail

@pytest.mark.asyncio
async def test_other_group_creator_cannot_delete_foreign_group(db_session):
    """
    Aislamiento Multi-Tenancy: El creador del Grupo 1 no puede eliminar el Grupo 2.
    """
    founder1 = Usuario(username="creador_grupo_1", password_hash="hash", rol="player", saldo_actual=0)
    founder2 = Usuario(username="creador_grupo_2", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder1, founder2])
    await db_session.commit()

    group1 = await grupo_crud.create_group(db_session, founder1.id, GroupCreate(nombre="Grupo Uno"))
    group2 = await grupo_crud.create_group(db_session, founder2.id, GroupCreate(nombre="Grupo Dos"))

    with pytest.raises(HTTPException) as exc_info:
        await grupo_crud.delete_group(db=db_session, current_user_id=founder1.id, group_id=group2.id)

    assert exc_info.value.status_code == 403
    assert "Solo el creador" in exc_info.value.detail

@pytest.mark.asyncio
async def test_delete_nonexistent_group(db_session):
    """
    Verifica que intentar eliminar un grupo inexistente arroje HTTP 404.
    """
    user = Usuario(username="usuario_cualquiera", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(user)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await grupo_crud.delete_group(db=db_session, current_user_id=user.id, group_id=999999)

    assert exc_info.value.status_code == 404

@pytest.mark.asyncio
async def test_creator_delegation_on_leave_and_subsequent_delete(db_session):
    """
    Flujo de Seguridad: Si el creador original abandona la comunidad voluntariamente,
    su titularidad ('creador_id') se delega automáticamente en el administrador más antiguo.
    El nuevo titular adquiere de pleno derecho las facultades soberanas de creador (incluido el borrado).
    """
    founder = Usuario(username="creador_saliente", password_hash="hash", rol="player", saldo_actual=0)
    new_admin = Usuario(username="admin_heredero", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([founder, new_admin])
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Comunidad Delegable"))
    await grupo_crud.join_group(db_session, new_admin.id, group.codigo_unico)

    # El creador nombra a new_admin como administrador
    await grupo_crud.update_member_role(db_session, founder.id, group.id, new_admin.id, "admin")

    # El creador original abandona el grupo
    await grupo_crud.leave_group(db_session, founder.id, group.id)

    # Comprobar que group.creador_id ahora apunta al heredero
    await db_session.refresh(group)
    assert group.creador_id == new_admin.id

    # Comprobar que se generó un AuditLog con la delegación
    delegation_log = await db_session.scalar(
        select(AuditLog).where(
            AuditLog.grupo_id == group.id,
            AuditLog.accion == "delegate_group_creator"
        )
    )
    assert delegation_log is not None
    assert delegation_log.detalles["nuevo_creador_id"] == new_admin.id

    # El antiguo creador ya no puede eliminar el grupo
    with pytest.raises(HTTPException) as exc_old:
        await grupo_crud.delete_group(db=db_session, current_user_id=founder.id, group_id=group.id)
    assert exc_old.value.status_code == 403

    # El nuevo creador SÍ puede eliminar el grupo definitivamente
    await grupo_crud.delete_group(db=db_session, current_user_id=new_admin.id, group_id=group.id)
    assert await db_session.scalar(select(Grupo).where(Grupo.id == group.id)) is None

@pytest.mark.asyncio
async def test_audit_log_preserved_after_group_deletion(db_session):
    """
    Trazabilidad Zero-Trust: El registro de borrado en AuditLog debe persistir
    con 'grupo_id=None' después de que el grupo ha sido purgado de la base de datos.
    """
    founder = Usuario(username="auditor_creador", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(founder)
    await db_session.commit()

    group = await grupo_crud.create_group(db_session, founder.id, GroupCreate(nombre="Peña Auditable"))
    group_id = group.id
    group_name = group.nombre

    await grupo_crud.delete_group(db=db_session, current_user_id=founder.id, group_id=group_id)

    # El grupo ya no existe
    assert await db_session.scalar(select(Grupo).where(Grupo.id == group_id)) is None

    # Pero el registro de auditoría persiste con grupo_id=None
    audit = await db_session.scalar(
        select(AuditLog).where(
            AuditLog.accion == "delete_group",
            AuditLog.entidad == "grupo",
            AuditLog.entidad_id == group_id
        )
    )
    assert audit is not None
    assert audit.grupo_id is None
    assert audit.admin_id == founder.id
    assert audit.detalles["nombre"] == group_name


@pytest.mark.asyncio
async def test_update_and_remove_group_password(db_session):
    """
    Verifica la gestión del ciclo de vida de la contraseña de un grupo:
    1. Creación con contraseña inicial.
    2. Actualización de otros metadatos omitiendo password (se preserva la clave actual).
    3. Modificación de la contraseña por una nueva.
    4. Eliminación de la contraseña enviando cadena vacía ("").
    5. Validación de que nuevos usuarios pueden incorporarse sin clave tras desprotegerlo.
    """
    admin = Usuario(username="admin_pwd_lifecycle", password_hash="hash", rol="player", saldo_actual=0)
    guest1 = Usuario(username="invitado_con_clave", password_hash="hash", rol="player", saldo_actual=0)
    guest2 = Usuario(username="invitado_sin_clave", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add_all([admin, guest1, guest2])
    await db_session.commit()

    # 1. Crear grupo protegido con contraseña
    group = await grupo_crud.create_group(
        db_session,
        admin.id,
        GroupCreate(nombre="Peña Clave", password="primera_clave_123")
    )
    assert group.requiere_password is True
    assert group.password_hash is not None

    # 2. Actualizar solo nombre omitiendo password: la contraseña debe permanecer intacta
    update_meta = GroupUpdateRequest(nombre="Peña Clave Renombrada", password=None)
    group_updated = await grupo_crud.update_group_settings(db_session, admin.id, group.id, update_meta)
    assert group_updated.nombre == "Peña Clave Renombrada"
    assert group_updated.requiere_password is True
    assert verify_password("primera_clave_123", group_updated.password_hash)

    # 3. Cambiar la contraseña a una nueva
    update_new_pwd = GroupUpdateRequest(password="segunda_clave_456")
    group_pwd_changed = await grupo_crud.update_group_settings(db_session, admin.id, group.id, update_new_pwd)
    assert group_pwd_changed.requiere_password is True
    assert verify_password("segunda_clave_456", group_pwd_changed.password_hash)

    # Invitado 1 se une satisfactoriamente con la nueva clave
    joined_guest1 = await grupo_crud.join_group(
        db_session,
        guest1.id,
        group.codigo_unico,
        password="segunda_clave_456"
    )
    assert joined_guest1.id == group.id

    # 4. Desproteger el grupo enviando cadena vacía
    update_remove_pwd = GroupUpdateRequest(password="")
    group_unprotected = await grupo_crud.update_group_settings(db_session, admin.id, group.id, update_remove_pwd)
    assert group_unprotected.requiere_password is False
    assert group_unprotected.password_hash is None

    # 5. Invitado 2 se une sin contraseña ahora que el grupo es público
    joined_guest2 = await grupo_crud.join_group(
        db_session,
        guest2.id,
        group.codigo_unico,
        password=None
    )
    assert joined_guest2.id == group.id






