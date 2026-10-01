import pytest


@pytest.mark.asyncio
async def test_feed_publish_reply_and_read_contract(client):
    """
    Verifica el contrato API en inglés del Muro Social:
    - Creación de publicación con 'content'
    - Respuesta al hilo con 'content'
    - Lectura del feed con 'content' e 'is_system'
    """
    # 1. Registrar y autenticar usuario
    user_payload = {"username": "feed_tester", "password": "secure_password"}
    reg_res = await client.post("/api/auth/register", json=user_payload)
    assert reg_res.status_code == 201

    login_res = await client.post("/api/auth/login", data=user_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Publicar un nuevo post con campo 'content'
    post_payload = {"content": "Mensaje principal de prueba", "media_url": None}
    post_res = await client.post("/api/feed/", json=post_payload, headers=headers)
    assert post_res.status_code == 201
    post_data = post_res.json()
    assert "post_id" in post_data
    post_id = post_data["post_id"]

    # 3. Publicar respuesta al post con campo 'content'
    reply_payload = {"content": "Respuesta al hilo de prueba"}
    reply_res = await client.post(
        f"/api/feed/{post_id}/reply", json=reply_payload, headers=headers
    )
    assert reply_res.status_code == 201
    reply_data = reply_res.json()
    assert "reply_id" in reply_data

    # 4. Obtener publicaciones del feed y verificar el esquema de salida
    feed_res = await client.get("/api/feed/?limit=10", headers=headers)
    assert feed_res.status_code == 200
    feed_data = feed_res.json()
    assert len(feed_data) >= 1

    created_post = next((p for p in feed_data if p["id"] == post_id), None)
    assert created_post is not None
    assert created_post["content"] == "Mensaje principal de prueba"
    assert created_post["is_system"] is False
    assert "author" in created_post
    assert "time_ago" in created_post

    # 5. Verificar que la respuesta está anidada con 'content' e 'is_system'
    assert len(created_post["replies"]) == 1
    reply_item = created_post["replies"][0]
    assert reply_item["content"] == "Respuesta al hilo de prueba"
    assert reply_item["is_system"] is False
    assert reply_item["author"] == "feed_tester"
