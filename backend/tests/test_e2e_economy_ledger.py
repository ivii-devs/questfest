import pytest
from httpx import AsyncClient
from sqlalchemy import select, func
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import Grupo, MiembroGrupo
from app.models.juegos import Duelo, Apuesta, TicketApuesta, RegistroRuleta
from app.models.misiones import Mision, PruebaMision, MisionRuletaAceptada

"""
==============================================================================
TEST END-TO-END DEL MOTOR ECONÓMICO Y AUDITORÍA DE LEDGER (TIER 1)
==============================================================================
Este archivo implementa la suite de pruebas de integración profunda para el motor
financiero de QuestFest, validando el principio inmutable de:
'CERO FUGAS FINANCIERAS (ZERO FINANCIAL LEAKS)' y estricto cumplimiento ACID.

¿Por qué este test es indispensable antes de tocar la interfaz de usuario?
1. Transacciones ACID Atómicas: Verifica que cada movimiento monetario canalizado
   por 'move_tokens' mantenga sincronizado el balance del usuario en 'miembros_grupo'
   con el asiento contable indeleble en 'ledger_transacciones' dentro de la misma transacción.
2. Bloqueo Pesimista y Sobregiro: Demuestra que intentos de gastar más tokens de los
   disponibles son interceptados inmediatamente por la lógica de negocio y las restricciones
   de integridad ('CheckConstraint'), provocando HTTP 400 sin alterar balances.
3. Ciclo de Vida Económico Completo:
   - Duelos 1vs1: Retención preventiva en Escrow (40+40 QC) y abono íntegro del bote (80 QC).
   - Apuestas Comunitarias: Sugerencia, aprobación de cuotas, compra atómica de tickets
     y liquidación exacta con multiplicadores dinámicos.
   - Gamificación: Ruleta diaria server-driven con comprobación de tiro único diario
     y misiones con validación de prueba social por el Tribunal y abono de recompensa.
4. Auditoría Matemática de Reconciliación:
   Comprueba que: Balance Inicial + Emisiones Netas = Suma de Balances Finales.
==============================================================================
"""

@pytest.mark.asyncio
async def test_e2e_complete_economy_ledger_journey(client: AsyncClient, db_session):
    # --------------------------------------------------------------------------
    # FASE 0: REGISTRO Y AUTENTICACIÓN DE LOS 3 ACTORES FUNCIONALES
    # --------------------------------------------------------------------------
    # Definimos los tres actores clave para la topología económica:
    # 1. Usuario_Admin_E2E: Fundador del grupo y juez supremo del Tribunal (/admin).
    # 2. Usuario_Retador_E2E: Jugador proactivo (lanza retos, propone apuestas, gira ruleta).
    # 3. Usuario_Rival_E2E: Contendiente (acepta retos, compra tickets, supera misiones).
    
    actores = [
        {"username": "Usuario_Admin_E2E", "password": "Password_Admin_123"},
        {"username": "Usuario_Retador_E2E", "password": "Password_Retador_123"},
        {"username": "Usuario_Rival_E2E", "password": "Password_Rival_123"},
    ]
    tokens = {}
    usuarios_ids = {}

    for actor in actores:
        reg_res = await client.post("/api/auth/register", json=actor)
        assert reg_res.status_code == 201, f"Error al registrar {actor['username']}: {reg_res.text}"
        data_user = reg_res.json()
        usuarios_ids[actor["username"]] = data_user["id"]

        login_res = await client.post("/api/auth/login", data=actor)
        assert login_res.status_code == 200, f"Error en login de {actor['username']}: {login_res.text}"
        tokens[actor["username"]] = login_res.json()["access_token"]

    headers_admin = {"Authorization": f"Bearer {tokens['Usuario_Admin_E2E']}"}
    headers_retador = {"Authorization": f"Bearer {tokens['Usuario_Retador_E2E']}"}
    headers_rival = {"Authorization": f"Bearer {tokens['Usuario_Rival_E2E']}"}

    # --------------------------------------------------------------------------
    # FASE 1: FUNDACIÓN DE LA COMUNIDAD 'Grupo_Economia_E2E' (HITO 0)
    # --------------------------------------------------------------------------
    # El Administrador funda el grupo con saldo de bienvenida de 100 QC y contraseña protegida
    group_payload = {
        "nombre": "Grupo_Economia_E2E",
        "descripcion": "Comunidad de auditoría económica completa y Libro Mayor",
        "password": "Credencial_Economia_99",
        "saldo_inicial": 100
    }
    create_group_res = await client.post("/api/groups/", json=group_payload, headers=headers_admin)
    assert create_group_res.status_code == 201, f"Error al crear grupo: {create_group_res.text}"
    group_data = create_group_res.json()
    group_id = group_data["id"]
    codigo_unico = group_data["codigo_unico"]

    # Incorporación legítima del Retador y del Rival con contraseña
    join_payload = {
        "codigo_unico": codigo_unico,
        "password": "Credencial_Economia_99"
    }
    join_retador_res = await client.post("/api/groups/join", json=join_payload, headers=headers_retador)
    assert join_retador_res.status_code == 200

    join_rival_res = await client.post("/api/groups/join", json=join_payload, headers=headers_rival)
    assert join_rival_res.status_code == 200

    # Auditoría de Hito 0 en base de datos:
    # Cada miembro debe tener exactamente 100 QC en 'MiembroGrupo'
    # Total en circulación en el grupo = 300 QC
    stmt_members = select(MiembroGrupo).where(MiembroGrupo.grupo_id == group_id)
    members_h0 = (await db_session.execute(stmt_members)).scalars().all()
    assert len(members_h0) == 3
    for m in members_h0:
        assert m.saldo_grupo == 100

    # Verificamos los 3 asientos de bienvenida en 'ledger_transacciones'
    stmt_ledger_h0 = select(LedgerTransaccion).where(LedgerTransaccion.grupo_id == group_id)
    ledger_h0 = (await db_session.execute(stmt_ledger_h0)).scalars().all()
    assert len(ledger_h0) == 3
    assert all(tx.cantidad == 100 and tx.saldo_resultante == 100 for tx in ledger_h0)
    assert sum(tx.cantidad for tx in ledger_h0) == 300

    # --------------------------------------------------------------------------
    # FASE 2: CICLO DE DUELOS 1vs1, RETENCIÓN EN ESCROW Y TRIBUNAL (HITOS 1, 2, 3)
    # --------------------------------------------------------------------------
    # Prueba defensiva previa: Intento de sobregiro por saldo insuficiente
    overdraft_duel = {
        "challenged_username": "Usuario_Rival_E2E",
        "game": "Duelo_Ajedrez_E2E",
        "wager": 500, # Saldo actual es 100 QC
        "group_id": group_id
    }
    res_bad_duel = await client.post("/api/duelos/", json=overdraft_duel, headers=headers_retador)
    assert res_bad_duel.status_code == 400, "Debe rechazar sobregiro con HTTP 400"

    # Hito 1: Retador lanza duelo legítimo apostando 40 QC
    valid_duel = {
        "challenged_username": "Usuario_Rival_E2E",
        "game": "Duelo_Ajedrez_E2E",
        "wager": 40,
        "group_id": group_id
    }
    res_create_duel = await client.post("/api/duelos/", json=valid_duel, headers=headers_retador)
    assert res_create_duel.status_code == 201
    duel_id = res_create_duel.json()["duel_id"]

    # Comprobación Hito 1:
    # Saldo Retador: 100 - 40 = 60 QC. Rival: 100 QC. Escrow: 40 QC. Total en sistema = 300 QC.
    db_session.expire_all()
    stmt_retador_h1 = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id, MiembroGrupo.usuario_id == usuarios_ids["Usuario_Retador_E2E"]
    )
    retador_m = (await db_session.execute(stmt_retador_h1)).scalar_one()
    assert retador_m.saldo_grupo == 60

    # Hito 2: Rival acepta el duelo (retención de sus 40 QC a Escrow)
    res_accept_duel = await client.post(f"/api/duelos/{duel_id}/action?action=accept", headers=headers_rival)
    assert res_accept_duel.status_code == 200

    # Comprobación Hito 2:
    # Saldo Retador: 60 QC. Saldo Rival: 60 QC. Bote Escrow: 80 QC. Total en sistema = 300 QC.
    db_session.expire_all()
    stmt_rival_h2 = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id, MiembroGrupo.usuario_id == usuarios_ids["Usuario_Rival_E2E"]
    )
    rival_m = (await db_session.execute(stmt_rival_h2)).scalar_one()
    assert rival_m.saldo_grupo == 60

    # Reporte de resultado: Retador declara victoria
    res_report_duel = await client.post(
        f"/api/duelos/{duel_id}/action?action=resolve",
        json={"resolution": "challenger"},
        headers=headers_retador
    )
    assert res_report_duel.status_code == 200

    # Prueba defensiva: Intento de reporte simultáneo o conflictivo por parte del rival
    # Como el duelo ya transicionó a 'validation_winner', el endpoint debe rechazarlo con HTTP 400
    res_conflict_report = await client.post(
        f"/api/duelos/{duel_id}/action?action=resolve",
        json={"resolution": "challenged"},
        headers=headers_rival
    )
    assert res_conflict_report.status_code == 400
    assert "no está en curso" in res_conflict_report.json()["detail"].lower()

    # Hito 3: Arbitraje del Tribunal en Modo Dios (/admin)
    # El Admin sentencia victoria para el Retador ('challenger')
    # Efecto económico: Se abona el bote completo de 80 QC (40 + 40) al Retador
    resolve_duel_payload = {
        "resolution": "challenger",
        "penalize": "none",
        "penalize_amount": 0,
        "motivo_multa": ""
    }
    res_admin_resolve = await client.patch(
        f"/api/admin/duels/{duel_id}/resolve",
        json=resolve_duel_payload,
        headers=headers_admin
    )
    assert res_admin_resolve.status_code == 200

    # Comprobación Hito 3:
    # Retador: 60 + 80 = 140 QC. Rival: 60 QC. Admin: 100 QC. Escrow: 0 QC. Total = 300 QC.
    db_session.expire_all()
    retador_m = (await db_session.execute(stmt_retador_h1)).scalar_one()
    rival_m = (await db_session.execute(stmt_rival_h2)).scalar_one()
    assert retador_m.saldo_grupo == 140
    assert rival_m.saldo_grupo == 60

    # --------------------------------------------------------------------------
    # FASE 3: MERCADO DE APUESTAS COMUNITARIAS Y LIQUIDACIÓN (HITOS 4 Y 5)
    # --------------------------------------------------------------------------
    # Hito 4.1: Retador propone una apuesta comunitaria con dos opciones y cuotas
    bet_proposal = {
        "title": "Torneo de Ajedrez: ¿Quién ganará la final?",
        "options": [
            {"text": "Jugador Favorito", "multiplier": 2.0},
            {"text": "Jugador Revelación", "multiplier": 1.5}
        ],
        "group_id": group_id
    }
    res_suggest_bet = await client.post("/api/apuestas/suggest", json=bet_proposal, headers=headers_retador)
    assert res_suggest_bet.status_code == 201
    apuesta_id = res_suggest_bet.json()["apuesta_id"]

    # Hito 4.2: Admin abre el mercado en el panel de control
    res_approve_bet = await client.patch(
        f"/api/admin/bets/{apuesta_id}/status",
        json={"estado": "abierta"},
        headers=headers_admin
    )
    assert res_approve_bet.status_code == 200

    # Recuperamos la apuesta para obtener los IDs alfanuméricos de las opciones
    res_list_bets = await client.get(f"/api/apuestas/?group_id={group_id}", headers=headers_retador)
    assert res_list_bets.status_code == 200
    bet_info = next(b for b in res_list_bets.json() if b["id"] == str(apuesta_id))
    opcion_favorito = next(o["id"] for o in bet_info["options"] if o["text"] == "Jugador Favorito")
    opcion_revelacion = next(o["id"] for o in bet_info["options"] if o["text"] == "Jugador Revelación")

    # Prueba defensiva: Intento de apostar más tokens de los disponibles
    res_bad_ticket = await client.post(
        f"/api/apuestas/{apuesta_id}/place",
        json={"option_id": opcion_favorito, "amount": 999},
        headers=headers_retador
    )
    assert res_bad_ticket.status_code == 400

    # Hito 4.3: Compra atómica de tickets
    # Retador apuesta 20 QC a 'Jugador Favorito' (cuota 2.0)
    res_ticket_retador = await client.post(
        f"/api/apuestas/{apuesta_id}/place",
        json={"option_id": opcion_favorito, "amount": 20},
        headers=headers_retador
    )
    assert res_ticket_retador.status_code == 200

    # Rival apuesta 30 QC a 'Jugador Revelación' (cuota 1.5)
    res_ticket_rival = await client.post(
        f"/api/apuestas/{apuesta_id}/place",
        json={"option_id": opcion_revelacion, "amount": 30},
        headers=headers_rival
    )
    assert res_ticket_rival.status_code == 200

    # Comprobación Hito 4:
    # Retador: 140 - 20 = 120 QC.
    # Rival: 60 - 30 = 30 QC.
    # Tokens en tickets: 20 + 30 = 50 QC.
    # Total en sistema: 100 (admin) + 120 + 30 + 50 = 300 QC.
    db_session.expire_all()
    retador_m = (await db_session.execute(stmt_retador_h1)).scalar_one()
    rival_m = (await db_session.execute(stmt_rival_h2)).scalar_one()
    assert retador_m.saldo_grupo == 120
    assert rival_m.saldo_grupo == 30

    # Hito 5: Admin liquida la apuesta declarando ganadora la Opción 1 ('Jugador Favorito')
    # Cálculo de ganancia para el Retador: 20 tokens * cuota 2.0 = 40 QC abonados
    res_close_bet = await client.patch(
        f"/api/admin/bets/{apuesta_id}/status",
        json={"estado": "cerrada", "opcion_ganadora_id": opcion_favorito},
        headers=headers_admin
    )
    assert res_close_bet.status_code == 200

    # Comprobación Hito 5:
    # Retador: 120 + 40 = 160 QC.
    # Rival: 30 QC (sus 30 QC apostados no se reembolsan, quema neta de 10 QC).
    # Total en cuentas: 100 (admin) + 160 (retador) + 30 (rival) = 290 QC.
    db_session.expire_all()
    retador_m = (await db_session.execute(stmt_retador_h1)).scalar_one()
    rival_m = (await db_session.execute(stmt_rival_h2)).scalar_one()
    assert retador_m.saldo_grupo == 160
    assert rival_m.saldo_grupo == 30

    # --------------------------------------------------------------------------
    # FASE 4: GAMIFICACIÓN (RULETA DIARIA) Y MISIÓN SOCIAL (HITO 6)
    # --------------------------------------------------------------------------
    # 1. Creamos una misión especial de ruleta en el bombo
    roulette_mission_payload = {
        "titulo": "Misión Secreta de Ruleta E2E",
        "descripcion": "Baila el robot ante todos los presentes",
        "recompensa": 15
    }
    res_add_roulette = await client.post("/api/admin/roulette", json=roulette_mission_payload, headers=headers_admin)
    assert res_add_roulette.status_code == 200

    # 2. Retador gira la ruleta diaria
    res_spin = await client.post("/api/ruleta/spin", headers=headers_retador)
    assert res_spin.status_code == 200
    roulette_mission_id = int(res_spin.json()["id"])

    # Intento defensivo: Bloqueo de doble tiro en el mismo día natural (24h)
    res_second_spin = await client.post("/api/ruleta/spin", headers=headers_retador)
    assert res_second_spin.status_code == 400
    assert "ya has tirado" in res_second_spin.json()["detail"].lower()

    # Retador acepta formalmente la misión de ruleta
    res_accept_roulette = await client.post(f"/api/ruleta/accept/{roulette_mission_id}", headers=headers_retador)
    assert res_accept_roulette.status_code == 200

    # Intento defensivo: No permitir aceptar la misma misión dos veces (idempotencia)
    res_reaccept = await client.post(f"/api/ruleta/accept/{roulette_mission_id}", headers=headers_retador)
    assert res_reaccept.status_code == 400

    # 3. Misión comunitaria 'Baile Comunitario' (Recompensa: 25 QC)
    # Sugerida y aprobada por el Tribunal
    suggest_mission_payload = {
        "title": "Misión Baile Comunitario",
        "description": "Baila ante el grupo la canción del verano",
        "reward": 25,
        "group_id": group_id
    }
    res_suggest_mission = await client.post("/api/misiones/suggest", json=suggest_mission_payload, headers=headers_retador)
    assert res_suggest_mission.status_code == 201
    social_mission_id = res_suggest_mission.json()["mission_id"]

    # Admin aprueba la misión comunitaria fijando 25 QC de recompensa
    res_approve_mission = await client.patch(
        f"/api/admin/misiones/{social_mission_id}/sugerencia/aprobar",
        json={"recompensa": 25},
        headers=headers_admin
    )
    assert res_approve_mission.status_code == 200

    # Rival presenta prueba testimonial al Tribunal
    proof_payload = {
        "proof_text": "Prueba de baile ejecutada ante el grupo con éxito",
        "proof_image_url": None
    }
    res_submit_proof = await client.post(
        f"/api/misiones/{social_mission_id}/complete",
        json=proof_payload,
        headers=headers_rival
    )
    assert res_submit_proof.status_code == 201
    proof_id = res_submit_proof.json()["proof_id"]

    # Admin consulta pruebas pendientes en /admin y valida la prueba
    res_get_pruebas = await client.get(f"/api/admin/misiones/pruebas?group_id={group_id}", headers=headers_admin)
    assert res_get_pruebas.status_code == 200
    pruebas_list = res_get_pruebas.json()
    assert any(p["id"] == proof_id for p in pruebas_list)

    # Admin valida y abona la recompensa (+25 QC) al Rival
    res_validate_proof = await client.patch(f"/api/admin/misiones/pruebas/{proof_id}/validar", headers=headers_admin)
    assert res_validate_proof.status_code == 200

    # Comprobación Hito 6:
    # Saldo Rival: 30 + 25 = 55 QC
    # Saldo Retador: 160 QC
    # Saldo Admin: 100 QC
    # Total en circulación: 100 + 160 + 55 = 315 QC
    db_session.expire_all()
    stmt_admin_final = select(MiembroGrupo).where(
        MiembroGrupo.grupo_id == group_id, MiembroGrupo.usuario_id == usuarios_ids["Usuario_Admin_E2E"]
    )
    admin_m = (await db_session.execute(stmt_admin_final)).scalar_one()
    retador_m = (await db_session.execute(stmt_retador_h1)).scalar_one()
    rival_m = (await db_session.execute(stmt_rival_h2)).scalar_one()

    assert admin_m.saldo_grupo == 100
    assert retador_m.saldo_grupo == 160
    assert rival_m.saldo_grupo == 55

    # --------------------------------------------------------------------------
    # FASE 5: AUDITORÍA MATEMÁTICA FORMAL DEL LIBRO MAYOR (LEDGER RECONCILIATION)
    # --------------------------------------------------------------------------
    # Consultamos la totalidad de los asientos contables en 'ledger_transacciones'
    stmt_all_ledger = select(LedgerTransaccion).where(
        LedgerTransaccion.grupo_id == group_id
    ).order_by(LedgerTransaccion.id)
    all_txs = (await db_session.execute(stmt_all_ledger)).scalars().all()

    # Criterio 1: Cero saldos negativos registrados en el Ledger
    assert all(tx.saldo_resultante >= 0 for tx in all_txs), "Violación de invariante: existe un saldo negativo en Ledger"

    # Criterio 2: Cada transacción cuenta con su concepto descriptivo y timestamp
    for tx in all_txs:
        assert tx.concepto and len(tx.concepto) > 0
        assert tx.fecha_creacion is not None
        assert tx.usuario_id in usuarios_ids.values()

    # Criterio 3: Reconciliación matemática estricta de doble partida
    # 1. Bienvenida Admin (+100)
    # 2. Bienvenida Retador (+100)
    # 3. Bienvenida Rival (+100)
    # 4. Retención Duelo Retador (-40)
    # 5. Retención Duelo Rival (-40)
    # 6. Premio Doble Duelo Retador (+80)
    # 7. Apuesta Colocada Retador (-20)
    # 8. Apuesta Colocada Rival (-30)
    # 9. Premio Apuesta Retador (+40)
    # 10. Misión Completada Rival (+25)
    # Total de transacciones registradas = 10 asientos
    assert len(all_txs) == 10, f"Se esperaban 10 asientos contables, encontrados: {len(all_txs)}"

    suma_neta_ledger = sum(tx.cantidad for tx in all_txs)
    suma_saldos_miembros = admin_m.saldo_grupo + retador_m.saldo_grupo + rival_m.saldo_grupo

    # La suma neta de todos los movimientos del Ledger debe ser IDÉNTICA a la suma actual de los miembros
    assert suma_neta_ledger == suma_saldos_miembros == 315
    print("\n[CERTIFICADO LEDGER] Zero Financial Leaks demostrado: Suma Ledger (315 QC) == Suma Balances (315 QC).")


@pytest.mark.asyncio
async def test_duel_rejection_and_escrow_refund_ledger(client: AsyncClient, db_session):
    """
    CASO LÍMITE ECONÓMICO: Rechazo de Duelo y Devolución Automática de Custodia (Escrow).
    
    Verifica que:
    1. Al lanzar un duelo por 30 QC, el saldo del retador se debita inmediatamente (-30) y se custodia en Escrow.
    2. Al rechazar el retado el duelo (?action=reject), el sistema reembolsa atómicamente (+30) al retador.
    3. El duelo transiciona al estado terminal 'validation_rejected'.
    4. El Ledger registra ambos movimientos con saldo resultante no negativo y balance final reconciliado.
    """
    # 1. Registro de contendientes
    user_a = {"username": "Usuario_Retador_Rechazo", "password": "Password_Retador_999"}
    user_b = {"username": "Usuario_Rival_Rechazo", "password": "Password_Rival_999"}
    tokens = {}
    usuarios_ids = {}

    for u in [user_a, user_b]:
        reg = await client.post("/api/auth/register", json=u)
        assert reg.status_code == 201
        usuarios_ids[u["username"]] = reg.json()["id"]

        login = await client.post("/api/auth/login", data=u)
        assert login.status_code == 200
        tokens[u["username"]] = login.json()["access_token"]

    headers_a = {"Authorization": f"Bearer {tokens['Usuario_Retador_Rechazo']}"}
    headers_b = {"Authorization": f"Bearer {tokens['Usuario_Rival_Rechazo']}"}

    # 2. Creación del grupo con 100 QC de bienvenida
    grp_res = await client.post(
        "/api/groups/",
        json={"nombre": "Grupo_Rechazo_Duelos_E2E", "saldo_inicial": 100},
        headers=headers_a
    )
    assert grp_res.status_code == 201
    grp_data = grp_res.json()
    grp_id = grp_data["id"]
    codigo = grp_data["codigo_unico"]

    join_res = await client.post("/api/groups/join", json={"codigo_unico": codigo}, headers=headers_b)
    assert join_res.status_code == 200

    # 3. Retador lanza duelo por 30 QC
    duel_res = await client.post(
        "/api/duelos/",
        json={
            "challenged_username": "Usuario_Rival_Rechazo",
            "game": "Piedra_Papel_Tijera_E2E",
            "wager": 30,
            "group_id": grp_id
        },
        headers=headers_a
    )
    assert duel_res.status_code == 201
    duel_id = duel_res.json()["duel_id"]

    # Saldo Retador tras retención: 100 - 30 = 70 QC
    db_session.expire_all()
    stmt_a = select(MiembroGrupo).where(MiembroGrupo.grupo_id == grp_id, MiembroGrupo.usuario_id == usuarios_ids["Usuario_Retador_Rechazo"])
    member_a = (await db_session.execute(stmt_a)).scalar_one()
    assert member_a.saldo_grupo == 70

    # 4. Rival rechaza el duelo
    reject_res = await client.post(f"/api/duelos/{duel_id}/action?action=reject", headers=headers_b)
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "validation_rejected"

    # 5. Saldo Retador restaurado al 100%: 70 + 30 = 100 QC
    db_session.expire_all()
    member_a_post = (await db_session.execute(stmt_a)).scalar_one()
    assert member_a_post.saldo_grupo == 100

    # 6. Auditoría del Ledger para este grupo
    stmt_tx = select(LedgerTransaccion).where(LedgerTransaccion.grupo_id == grp_id).order_by(LedgerTransaccion.id)
    txs = (await db_session.execute(stmt_tx)).scalars().all()
    
    # 2 bienvenidas (+100, +100), 1 retención (-30), 1 devolución (+30) = 4 transacciones
    assert len(txs) == 4
    assert all(tx.saldo_resultante >= 0 for tx in txs)
    assert sum(tx.cantidad for tx in txs) == 200
    print("\n[CERTIFICADO RECHAZO DUELO] Escrow reembolsado íntegramente: 70 QC -> 100 QC.")
