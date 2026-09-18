import pytest
from fastapi import HTTPException
from app.models.usuario import Usuario
from app.schemas.grupo_schemas import GroupCreate, GroupUpdateRequest
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



