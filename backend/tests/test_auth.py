import pytest

@pytest.mark.asyncio
async def test_register_and_login_flow(client):
    # 1. Registro de nuevo usuario
    reg_payload = {
        "username": "jugador_test",
        "password": "password123"
    }
    response = await client.post("/api/auth/register", json=reg_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "jugador_test"
    assert data["rol"] == "player"
    assert data["saldo_actual"] == 0

    # 2. Login con credenciales validas
    login_payload = {
        "username": "jugador_test",
        "password": "password123"
    }
    login_res = await client.post("/api/auth/login", data=login_payload)
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

    # Verificar presencia de cookies de sesion
    assert "refresh_token" in login_res.cookies

@pytest.mark.asyncio
async def test_login_invalid_password(client):
    # Registro previo
    await client.post("/api/auth/register", json={"username": "user_invalid", "password": "correct_pass"})

    # Login con password erroneo
    res = await client.post("/api/auth/login", data={"username": "user_invalid", "password": "wrong_pass"})
    assert res.status_code == 401
    assert "incorrectos" in res.json()["detail"]
