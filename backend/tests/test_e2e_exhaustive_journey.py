import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import Grupo, MiembroGrupo
from app.models.juegos import Duelo

"""
==============================================================================
TEST END-TO-END EXHAUSTIVO (NIVEL 1): CICLO MULTI-TENANCY Y TRANSACCIONAL
==============================================================================
Este test implementa el escenario de alta dificultad exigido por el estándar
de calidad de QuestFest (.agents/context/testing-standards.md).

¿Por qué este escenario y no pruebas unitarias aisladas?
Porque valida simultáneamente:
1. Autenticación y emisión de tokens JWT de 3 actores independientes.
2. Creación de un grupo multitenant protegido por hash criptográfico (bcrypt).
3. Inyección de fallos de seguridad (intento de unión con credencial inválida -> rechazo 401).
4. Incorporación legítima con asignación de saldo inicial auditable en el Ledger.
5. Inyección de fallos financieros (intento de sobregiro por saldo insuficiente -> rechazo 400).
6. Interacción económica multi-actor (duelo PvP con retención en Escrow y Ledger).
7. Invarianza contable de suma cero y consistencia relacional en base de datos.
==============================================================================
"""

@pytest.mark.asyncio
async def test_e2e_exhaustive_multitenant_and_ledger_journey(client: AsyncClient, db_session):
    # --------------------------------------------------------------------------
    # FASE 1: REGISTRO Y AUTENTICACIÓN DE LOS 3 ACTORES FUNCIONALES
    # --------------------------------------------------------------------------
    # Registramos y obtenemos tokens de sesión independientes para cada actor:
    # - Usuario_Admin: Creador y gestor del grupo
    # - Usuario_Miembro_A: Participante activo en retos y duelos
    # - Usuario_Miembro_B: Contendiente secundario
    
    actores = [
        {"username": "Usuario_Admin_E2E", "password": "Password_Admin_123"},
        {"username": "Usuario_Miembro_A_E2E", "password": "Password_Miembro_A_123"},
        {"username": "Usuario_Miembro_B_E2E", "password": "Password_Miembro_B_123"},
    ]
    tokens = {}
    usuarios_ids = {}

    for actor in actores:
        # Registro en endpoint público
        reg_res = await client.post("/api/auth/register", json=actor)
        assert reg_res.status_code == 201, f"Fallo al registrar {actor['username']}: {reg_res.text}"
        data_user = reg_res.json()
        usuarios_ids[actor["username"]] = data_user["id"]

        # Login con credenciales para obtener token Bearer
        login_res = await client.post("/api/auth/login", data=actor)
        assert login_res.status_code == 200, f"Fallo al autenticar {actor['username']}: {login_res.text}"
        tokens[actor["username"]] = login_res.json()["access_token"]

    headers_admin = {"Authorization": f"Bearer {tokens['Usuario_Admin_E2E']}"}
    headers_member_a = {"Authorization": f"Bearer {tokens['Usuario_Miembro_A_E2E']}"}
    headers_member_b = {"Authorization": f"Bearer {tokens['Usuario_Miembro_B_E2E']}"}

    # --------------------------------------------------------------------------
    # FASE 2: CREACIÓN DE GRUPO PROTEGIDO POR CREDENCIAL POR USUARIO_ADMIN
    # --------------------------------------------------------------------------
    # Creamos un grupo multitenant con contraseña obligatoria y saldo inicial de 100 QC
    group_payload = {
        "nombre": "Grupo_E2E_Protegido_A",
        "descripcion": "Entidad de grupo multitenant para verificación de calidad E2E",
        "password": "Credencial_Acceso_Valida_99",
        "saldo_inicial": 100
    }
    create_group_res = await client.post("/api/groups/", json=group_payload, headers=headers_admin)
    assert create_group_res.status_code == 201, f"Error al crear grupo: {create_group_res.text}"
    group_data = create_group_res.json()
    group_id = group_data["id"]
    codigo_unico = group_data["codigo_unico"]

    assert codigo_unico.startswith("QF-")
    assert group_data["requiere_password"] is True

    # Auditoría en base de datos: Verificar membresía de admin y asiento de bienvenida en Ledger
    stmt_admin_member = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id,
        MiembroGrupo.usuario_id == usuarios_ids["Usuario_Admin_E2E"]
    )
    admin_member = (await db_session.execute(stmt_admin_member)).scalar_one()
    assert admin_member.rol == "admin"
    assert admin_member.saldo_grupo == 100

    stmt_ledger_admin = select(LedgerTransaccion).where(
        LedgerTransaccion.usuario_id == usuarios_ids["Usuario_Admin_E2E"],
        LedgerTransaccion.grupo_id == group_id
    )
    ledger_admin = (await db_session.execute(stmt_ledger_admin)).scalar_one()
    assert ledger_admin.cantidad == 100
    assert ledger_admin.saldo_resultante == 100
    assert "bienvenida" in ledger_admin.concepto.lower()

    # --------------------------------------------------------------------------
    # FASE 3: INYECCIÓN DE FALLOS (ACCESO CON CREDENCIAL INVÁLIDA)
    # --------------------------------------------------------------------------
    # Usuario_Miembro_A intenta unirse con credencial incorrecta
    join_invalido_payload = {
        "codigo_unico": codigo_unico,
        "password": "Credencial_Acceso_Invalida_00"
    }
    join_bad_res = await client.post("/api/groups/join", json=join_invalido_payload, headers=headers_member_a)
    # Debe rechazarse limpiamente con 401 Unauthorized
    assert join_bad_res.status_code == 401
    assert "incorrecta" in join_bad_res.json()["detail"].lower()

    # Verificación de integridad: Usuario_Miembro_A no debe existir como miembro del grupo
    stmt_check_bad = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id,
        MiembroGrupo.usuario_id == usuarios_ids["Usuario_Miembro_A_E2E"]
    )
    assert (await db_session.execute(stmt_check_bad)).scalar_one_or_none() is None

    # --------------------------------------------------------------------------
    # FASE 4: UNIÓN LEGÍTIMA Y ASIGNACIÓN ATÓMICA DE SALDO DE BIENVENIDA
    # --------------------------------------------------------------------------
    # Usuario_Miembro_A se une con la credencial correcta
    join_valido_payload = {
        "codigo_unico": codigo_unico,
        "password": "Credencial_Acceso_Valida_99"
    }
    join_ok_res = await client.post("/api/groups/join", json=join_valido_payload, headers=headers_member_a)
    assert join_ok_res.status_code == 200

    # Verificación de rol y saldo local
    stmt_member_a = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id,
        MiembroGrupo.usuario_id == usuarios_ids["Usuario_Miembro_A_E2E"]
    )
    member_a_record = (await db_session.execute(stmt_member_a)).scalar_one()
    assert member_a_record.rol == "member"
    assert member_a_record.saldo_grupo == 100

    # Auditoría en Ledger para Usuario_Miembro_A
    stmt_ledger_a = select(LedgerTransaccion).where(
        LedgerTransaccion.usuario_id == usuarios_ids["Usuario_Miembro_A_E2E"],
        LedgerTransaccion.grupo_id == group_id
    )
    ledger_a = (await db_session.execute(stmt_ledger_a)).scalar_one()
    assert ledger_a.cantidad == 100
    assert ledger_a.saldo_resultante == 100

    # --------------------------------------------------------------------------
    # FASE 5: INCORPORACIÓN DEL SEGUNDO CONTENDIENTE (USUARIO_MIEMBRO_B)
    # --------------------------------------------------------------------------
    join_b_res = await client.post("/api/groups/join", json=join_valido_payload, headers=headers_member_b)
    assert join_b_res.status_code == 200

    stmt_member_b = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id,
        MiembroGrupo.usuario_id == usuarios_ids["Usuario_Miembro_B_E2E"]
    )
    member_b_record = (await db_session.execute(stmt_member_b)).scalar_one()
    assert member_b_record.saldo_grupo == 100

    # --------------------------------------------------------------------------
    # FASE 6: INYECCIÓN DE FALLO FINANCIERO (SOBREGIRO / SALDO INSUFICIENTE)
    # --------------------------------------------------------------------------
    # Usuario_Miembro_A intenta retar a Usuario_Miembro_B apostando 500 QC (tiene 100 QC)
    duel_overdraft_payload = {
        "challenged_username": "Usuario_Miembro_B_E2E",
        "game": "Duelo_Resistencia_E2E",
        "wager": 500,
        "group_id": group_id
    }
    duel_bad_res = await client.post("/api/duelos/", json=duel_overdraft_payload, headers=headers_member_a)
    # Debe rechazarse con 400 Bad Request por protección de saldo insuficiente
    assert duel_bad_res.status_code == 400
    assert "fondos suficientes" in duel_bad_res.json()["detail"].lower() or "saldo insuficiente" in duel_bad_res.json()["detail"].lower()

    # Verificación de integridad: Los saldos de ambos participantes no se alteraron
    await db_session.refresh(member_a_record)
    await db_session.refresh(member_b_record)
    assert member_a_record.saldo_grupo == 100
    assert member_b_record.saldo_grupo == 100

    # --------------------------------------------------------------------------
    # FASE 7: INTERACCIÓN ECONÓMICA LEGÍTIMA Y BLOQUEO EN ESCROW
    # --------------------------------------------------------------------------
    # Usuario_Miembro_A lanza un duelo legal por 40 QuestCoins
    duel_valid_payload = {
        "challenged_username": "Usuario_Miembro_B_E2E",
        "game": "Duelo_Precision_E2E",
        "wager": 40,
        "group_id": group_id
    }
    duel_create_res = await client.post("/api/duelos/", json=duel_valid_payload, headers=headers_member_a)
    assert duel_create_res.status_code == 201
    duel_id = duel_create_res.json()["duel_id"]

    # Verificamos que los 40 QC de Usuario_Miembro_A han quedado retenidos en Escrow
    await db_session.refresh(member_a_record)
    assert member_a_record.saldo_grupo == 60  # 100 - 40

    # Usuario_Miembro_B acepta el desafío
    accept_res = await client.post(f"/api/duelos/{duel_id}/action?action=accept", headers=headers_member_b)
    assert accept_res.status_code == 200

    # Verificamos que los 40 QC de Usuario_Miembro_B también han sido retenidos
    await db_session.refresh(member_b_record)
    assert member_b_record.saldo_grupo == 60  # 100 - 40

    # Comprobar estado del Duelo en BD
    stmt_duel = select(Duelo).where(Duelo.id == duel_id)
    duel_record = (await db_session.execute(stmt_duel)).scalar_one()
    assert duel_record.estado == "accepted"
    assert duel_record.tokens_en_juego == 40

    # --------------------------------------------------------------------------
    # FASE 8: AUDITORÍA CONTABLE FINAL Y RECONCILIACIÓN EN EL LEDGER
    # --------------------------------------------------------------------------
    # Total de tokens otorgados en este grupo:
    # Admin (100) + Miembro A (100) + Miembro B (100) = 300 QuestCoins emitidos
    #
    # Saldos actuales en MiembroGrupo:
    # Admin: 100
    # Miembro A: 60
    # Miembro B: 60
    # En custodia en Escrow del duelo: 40 + 40 = 80
    # Total en sistema = 100 + 60 + 60 + 80 = 300 QuestCoins.
    # Cero fugas contables comprobado matemáticamente.
    
    stmt_all_ledger = select(LedgerTransaccion).where(LedgerTransaccion.grupo_id == group_id)
    ledger_entries = (await db_session.execute(stmt_all_ledger)).scalars().all()
    
    # Debe haber exactamente 5 asientos contables:
    # 1. Bienvenida Admin (+100)
    # 2. Bienvenida Miembro A (+100)
    # 3. Bienvenida Miembro B (+100)
    # 4. Retención Escrow Miembro A (-40)
    # 5. Retención Escrow Miembro B (-40)
    assert len(ledger_entries) == 5

    total_emitido = sum(tx.cantidad for tx in ledger_entries if tx.cantidad > 0)
    total_retenido = abs(sum(tx.cantidad for tx in ledger_entries if tx.cantidad < 0))
    assert total_emitido == 300
    assert total_retenido == 80

    await db_session.refresh(admin_member)
    await db_session.refresh(member_a_record)
    await db_session.refresh(member_b_record)
    assert (total_emitido - total_retenido) == (admin_member.saldo_grupo + member_a_record.saldo_grupo + member_b_record.saldo_grupo)
