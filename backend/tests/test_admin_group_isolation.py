import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import Grupo, MiembroGrupo
from app.models.juegos import Duelo, Apuesta, TicketApuesta
from app.models.misiones import Mision, PruebaMision

"""
==============================================================================
TEST DE AISLAMIENTO TERRITORIAL MULTI-TENANCY: PANEL ADMIN Y TRIBUNAL (TIER 1)
==============================================================================
Valida que un administrador de una comunidad NO tenga acceso de lectura,
arbitraje, modificación de saldos ni validación de pruebas sobre comunidades ajenas.

Reglas de Oro Verificadas:
1. Código HTTP 403 Forbidden ante cualquier intento de sentencia cruzada.
2. Aislamiento absoluto de listados de usuarios, duelos, apuestas y misiones.
3. Actualización de balances locales ('saldo_grupo') en el Ledger Transaccional.
==============================================================================
"""

@pytest.mark.asyncio
async def test_admin_group_isolation_multi_tenancy(client: AsyncClient, db_session):
    # --------------------------------------------------------------------------
    # 1. REGISTRO Y AUTENTICACIÓN DE ACTORES CON NOMENCLATURA SEMÁNTICA
    # --------------------------------------------------------------------------
    actores = [
        {"username": "Admin_Alfa_E2E", "password": "Password_Alfa_123"},
        {"username": "Admin_Beta_E2E", "password": "Password_Beta_123"},
        {"username": "Jugador_Alfa_1_E2E", "password": "Password_Jugador_123"},
        {"username": "Jugador_Alfa_2_E2E", "password": "Password_Jugador_456"},
        {"username": "Jugador_Beta_1_E2E", "password": "Password_Jugador_789"},
    ]
    tokens = {}
    users_id = {}

    for actor in actores:
        reg_res = await client.post("/api/auth/register", json=actor)
        assert reg_res.status_code == 201, f"Error registro {actor['username']}: {reg_res.text}"
        users_id[actor["username"]] = reg_res.json()["id"]

        login_res = await client.post("/api/auth/login", data=actor)
        assert login_res.status_code == 200, f"Error login {actor['username']}: {login_res.text}"
        tokens[actor["username"]] = login_res.json()["access_token"]

    def auth_header(username: str):
        return {"Authorization": f"Bearer {tokens[username]}"}

    # --------------------------------------------------------------------------
    # 2. CREACIÓN DE COMUNIDADES INDEPENDIENTES
    # --------------------------------------------------------------------------
    # Admin Alfa funda Grupo Alfa con saldo inicial de 200 QC
    res_ga = await client.post(
        "/api/groups/",
        json={"nombre": "Grupo_Alfa_Admin_E2E", "saldo_inicial": 200},
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert res_ga.status_code == 201
    alfa_id = res_ga.json()["id"]
    code_alfa = res_ga.json()["codigo_unico"]

    # Admin Beta funda Grupo Beta con saldo inicial de 200 QC
    res_gb = await client.post(
        "/api/groups/",
        json={"nombre": "Grupo_Beta_Admin_E2E", "saldo_inicial": 200},
        headers=auth_header("Admin_Beta_E2E")
    )
    assert res_gb.status_code == 201
    beta_id = res_gb.json()["id"]
    code_beta = res_gb.json()["codigo_unico"]

    # Jugadores Alfa se unen al Grupo Alfa
    res_j1_join = await client.post(
        "/api/groups/join",
        json={"codigo_unico": code_alfa},
        headers=auth_header("Jugador_Alfa_1_E2E")
    )
    assert res_j1_join.status_code == 200
    res_j2_join = await client.post(
        "/api/groups/join",
        json={"codigo_unico": code_alfa},
        headers=auth_header("Jugador_Alfa_2_E2E")
    )
    assert res_j2_join.status_code == 200

    # Jugador Beta se une al Grupo Beta
    res_jb_join = await client.post(
        "/api/groups/join",
        json={"codigo_unico": code_beta},
        headers=auth_header("Jugador_Beta_1_E2E")
    )
    assert res_jb_join.status_code == 200

    # --------------------------------------------------------------------------
    # 3. AISLAMIENTO TERRITORIAL EN MERCADO DE APUESTAS
    # --------------------------------------------------------------------------
    # Jugador Alfa sugiere una apuesta en Grupo Alfa
    res_bet = await client.post(
        "/api/apuestas/suggest",
        json={
            "title": "Apuesta_Torneo_Alfa_E2E",
            "group_id": alfa_id,
            "options": [
                {"text": "Opción Uno", "multiplier": 2.0},
                {"text": "Opción Dos", "multiplier": 3.0}
            ]
        },
        headers=auth_header("Jugador_Alfa_1_E2E")
    )
    assert res_bet.status_code == 201
    bet_id = res_bet.json()["apuesta_id"]

    # Intento de arbitraje cruzado: Admin Beta intenta editar o abrir la apuesta de Alfa -> 403 Forbidden
    cross_edit = await client.put(
        f"/api/admin/bets/{bet_id}",
        json={
            "title": "Hack_Apuesta_Alfa",
            "options": [
                {"text": "Opción Manipulada 1", "multiplier": 50.0},
                {"text": "Opción Manipulada 2", "multiplier": 1.5}
            ]
        },
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_edit.status_code == 403, f"Admin Beta no debe poder editar apuestas de Alfa: {cross_edit.text}"

    cross_open = await client.patch(
        f"/api/admin/bets/{bet_id}/status",
        json={"estado": "abierta"},
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_open.status_code == 403, f"Admin Beta no debe poder abrir apuestas de Alfa: {cross_open.text}"

    # Admin Alfa administra legítimamente su apuesta -> 200 OK
    legit_open = await client.patch(
        f"/api/admin/bets/{bet_id}/status",
        json={"estado": "abierta"},
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_open.status_code == 200

    # Jugador Alfa compra ticket
    res_list_bets = await client.get(f"/api/apuestas/?group_id={alfa_id}", headers=auth_header("Jugador_Alfa_1_E2E"))
    bet_options = res_list_bets.json()[0]["options"]
    first_opt_id = bet_options[0]["id"]
    res_ticket = await client.post(
        f"/api/apuestas/{bet_id}/place",
        json={"option_id": first_opt_id, "amount": 30},
        headers=auth_header("Jugador_Alfa_1_E2E")
    )
    assert res_ticket.status_code == 200

    # Admin Beta intenta liquidar la apuesta de Alfa -> 403 Forbidden
    cross_close = await client.patch(
        f"/api/admin/bets/{bet_id}/status",
        json={"estado": "cerrada", "opcion_ganadora_id": first_opt_id},
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_close.status_code == 403

    # Admin Alfa liquida su apuesta -> 200 OK
    legit_close = await client.patch(
        f"/api/admin/bets/{bet_id}/status",
        json={"estado": "cerrada", "opcion_ganadora_id": first_opt_id},
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_close.status_code == 200

    # --------------------------------------------------------------------------
    # 4. AISLAMIENTO TERRITORIAL EN TRIBUNAL DE DUELOS
    # --------------------------------------------------------------------------
    # Duelo entre Jugadores de Alfa dentro de Grupo Alfa
    res_duel = await client.post(
        "/api/duelos/",
        json={
            "challenged_username": "Jugador_Alfa_2_E2E",
            "game": "Duelo_Ajedrez_E2E",
            "wager": 25,
            "group_id": alfa_id
        },
        headers=auth_header("Jugador_Alfa_1_E2E")
    )
    assert res_duel.status_code == 201
    duel_id = res_duel.json()["duel_id"]

    # El retado acepta el duelo
    res_accept = await client.post(
        f"/api/duelos/{duel_id}/action?action=accept",
        headers=auth_header("Jugador_Alfa_2_E2E")
    )
    assert res_accept.status_code == 200

    # Admin Alfa no puede espiar duelos de Grupo Beta
    cross_view_duels = await client.get(f"/api/admin/duels?group_id={beta_id}", headers=auth_header("Admin_Alfa_E2E"))
    assert cross_view_duels.status_code == 403

    # Admin Beta intenta dictar sentencia sobre el duelo de Alfa -> 403 Forbidden
    cross_resolve_duel = await client.patch(
        f"/api/admin/duels/{duel_id}/resolve",
        json={"resolution": "challenger", "penalize": "none"},
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_resolve_duel.status_code == 403

    # Admin Alfa resuelve legítimamente su duelo -> 200 OK
    legit_resolve_duel = await client.patch(
        f"/api/admin/duels/{duel_id}/resolve",
        json={"resolution": "challenger", "penalize": "none"},
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_resolve_duel.status_code == 200

    # --------------------------------------------------------------------------
    # 5. AISLAMIENTO TERRITORIAL EN TRIBUNAL DE MISIONES Y PRUEBAS
    # --------------------------------------------------------------------------
    # Jugador Alfa sugiere misión en Grupo Alfa
    res_mision_sug = await client.post(
        "/api/misiones/suggest",
        json={
            "title": "Mision_Fotografica_Alfa_E2E",
            "description": "Subir una foto del logotipo Alfa",
            "reward": 50,
            "group_id": alfa_id
        },
        headers=auth_header("Jugador_Alfa_1_E2E")
    )
    assert res_mision_sug.status_code == 201
    mision_id = res_mision_sug.json()["mission_id"]

    # Admin Beta intenta aprobar la misión de Alfa -> 403 Forbidden
    cross_approve_mision = await client.patch(
        f"/api/admin/misiones/{mision_id}/sugerencia/aprobar",
        json={"recompensa": 80},
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_approve_mision.status_code == 403

    # Admin Alfa aprueba legítimamente la misión -> 200 OK
    legit_approve_mision = await client.patch(
        f"/api/admin/misiones/{mision_id}/sugerencia/aprobar",
        json={"recompensa": 80},
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_approve_mision.status_code == 200

    # Jugador Alfa presenta prueba para la misión
    res_prueba = await client.post(
        f"/api/misiones/{mision_id}/complete",
        json={"proof_text": "Evidencia presentada para verificación"},
        headers=auth_header("Jugador_Alfa_2_E2E")
    )
    assert res_prueba.status_code == 201
    prueba_id = res_prueba.json()["proof_id"]

    # Admin Beta intenta validar o rechazar la prueba de Alfa -> 403 Forbidden
    cross_val_prueba = await client.patch(
        f"/api/admin/misiones/pruebas/{prueba_id}/validar",
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_val_prueba.status_code == 403

    cross_rej_prueba = await client.patch(
        f"/api/admin/misiones/pruebas/{prueba_id}/rechazar",
        json={"motivo": "Rechazo no autorizado"},
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_rej_prueba.status_code == 403

    # Admin Alfa valida la prueba de su grupo -> 200 OK
    legit_val_prueba = await client.patch(
        f"/api/admin/misiones/pruebas/{prueba_id}/validar",
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_val_prueba.status_code == 200

    # --------------------------------------------------------------------------
    # 6. AISLAMIENTO TERRITORIAL EN GESTIÓN DE USUARIOS Y SALDOS
    # --------------------------------------------------------------------------
    # Admin Alfa lista usuarios de Grupo Alfa -> Solo miembros de Alfa
    res_users_alfa = await client.get(
        f"/api/admin/users?group_id={alfa_id}",
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert res_users_alfa.status_code == 200
    alfa_user_names = [u["username"] for u in res_users_alfa.json()]
    assert "Jugador_Alfa_1_E2E" in alfa_user_names
    assert "Jugador_Alfa_2_E2E" in alfa_user_names
    assert "Jugador_Beta_1_E2E" not in alfa_user_names, "Fuga de privacidad: usuario de Beta visible en Alfa"

    # Admin Alfa intenta consultar miembros de Grupo Beta -> 403 Forbidden
    cross_users_beta = await client.get(
        f"/api/admin/users?group_id={beta_id}",
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert cross_users_beta.status_code == 403

    # Admin Beta intenta modificar el saldo de un usuario de Grupo Alfa -> 403 Forbidden
    cross_balance = await client.post(
        f"/api/admin/users/{users_id['Jugador_Alfa_1_E2E']}/balance",
        json={
            "cantidad": 500,
            "concepto": "Intrusión financiera ilegítima",
            "group_id": alfa_id
        },
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_balance.status_code == 403

    # Admin Alfa ajusta legítimamente el saldo local en su grupo -> 200 OK
    legit_balance = await client.post(
        f"/api/admin/users/{users_id['Jugador_Alfa_1_E2E']}/balance",
        json={
            "cantidad": 50,
            "concepto": "Bonificación legítima de Admin Alfa",
            "group_id": alfa_id
        },
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_balance.status_code == 200

    # Admin Beta intenta auditar transacciones del usuario en Grupo Alfa -> 403 Forbidden
    cross_txs = await client.get(
        f"/api/admin/users/{users_id['Jugador_Alfa_1_E2E']}/transactions?group_id={alfa_id}",
        headers=auth_header("Admin_Beta_E2E")
    )
    assert cross_txs.status_code == 403

    # Admin Alfa audita legítimamente las transacciones en su grupo -> 200 OK
    legit_txs = await client.get(
        f"/api/admin/users/{users_id['Jugador_Alfa_1_E2E']}/transactions?group_id={alfa_id}",
        headers=auth_header("Admin_Alfa_E2E")
    )
    assert legit_txs.status_code == 200
    assert len(legit_txs.json()) > 0
