import pytest
from pydantic import ValidationError
from app.schemas.misiones_schemas import CompleteMissionRequest
from app.models.usuario import Usuario
from app.models.misiones import Mision
from app.crud.misiones_crud import submit_mission_proof

# ==============================================================================
# Tests Unitarios de Esquema Pydantic: CompleteMissionRequest
# ==============================================================================

def test_complete_mission_schema_with_only_image():
    """
    Verifica que la prueba gráfica sea suficiente y el texto explicativo sea opcional.
    """
    req = CompleteMissionRequest(proof_image_url="https://res.cloudinary.com/demo/image/upload/sample.jpg")
    assert req.proof_image_url is not None
    assert str(req.proof_image_url) == "https://res.cloudinary.com/demo/image/upload/sample.jpg"
    assert req.proof_text is None


def test_complete_mission_schema_with_only_text():
    """
    Verifica que una justificación en texto sea suficiente y la prueba gráfica sea opcional.
    """
    req = CompleteMissionRequest(proof_text="Cumplí el reto cantando en el karaoke con el equipo rival.")
    assert req.proof_text == "Cumplí el reto cantando en el karaoke con el equipo rival."
    assert req.proof_image_url is None


def test_complete_mission_schema_with_both_image_and_text():
    """
    Verifica que se puedan aportar conjuntamente foto y texto.
    """
    req = CompleteMissionRequest(
        proof_text="Foto demostrando la hazaña",
        proof_image_url="https://res.cloudinary.com/demo/image/upload/sample.jpg"
    )
    assert req.proof_text == "Foto demostrando la hazaña"
    assert str(req.proof_image_url) == "https://res.cloudinary.com/demo/image/upload/sample.jpg"


def test_complete_mission_schema_empty_fails():
    """
    Verifica que no se permita enviar una solicitud sin imagen ni justificación.
    """
    with pytest.raises(ValidationError) as exc_info:
        CompleteMissionRequest()
    assert "Debes proporcionar al menos una prueba" in str(exc_info.value)


def test_complete_mission_schema_whitespace_text_only_fails():
    """
    Verifica que una cadena vacía o con solo espacios en blanco no se considere prueba válida.
    """
    with pytest.raises(ValidationError) as exc_info:
        CompleteMissionRequest(proof_text="   ", proof_image_url=None)
    assert "Debes proporcionar al menos una prueba" in str(exc_info.value)


# ==============================================================================
# Tests de Integración CRUD y Base de Datos: submit_mission_proof
# ==============================================================================

@pytest.mark.asyncio
async def test_submit_mission_proof_only_image_db(db_session):
    """
    Asegura que a nivel de base de datos se almacene una prueba con prueba_imagen_url
    y prueba_texto nulo, sin errores de integridad.
    """
    user = Usuario(username="cazador_retos", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    mision = Mision(
        titulo="Reto Fotográfico",
        creador_id=user.id,
        descripcion="Consigue una foto divertida",
        recompensa=50,
        fase="global",
        es_ruleta=False,
        estado="activa"
    )
    db_session.add(mision)
    await db_session.commit()
    await db_session.refresh(mision)

    request = CompleteMissionRequest(proof_image_url="https://res.cloudinary.com/demo/image/upload/reto.jpg")
    prueba = await submit_mission_proof(db_session, mision.id, user.id, request)

    assert prueba.id is not None
    assert prueba.mision_id == mision.id
    assert prueba.usuario_id == user.id
    assert prueba.prueba_imagen_url == "https://res.cloudinary.com/demo/image/upload/reto.jpg"
    assert prueba.prueba_texto is None
    assert prueba.estado == "pending"


@pytest.mark.asyncio
async def test_submit_mission_proof_only_text_db(db_session):
    """
    Asegura que a nivel de base de datos se almacene una prueba con prueba_texto
    y prueba_imagen_url nulo, confirmando la opcionalidad del archivo multimedia.
    """
    user = Usuario(username="cazador_texto", password_hash="hash", rol="player", saldo_actual=0)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    mision = Mision(
        titulo="Reto Testimonial",
        creador_id=user.id,
        descripcion="Explica tu hazaña",
        recompensa=30,
        fase="global",
        es_ruleta=False,
        estado="activa"
    )
    db_session.add(mision)
    await db_session.commit()
    await db_session.refresh(mision)

    request = CompleteMissionRequest(proof_text="  Lo conseguí en el escenario principal  ")
    prueba = await submit_mission_proof(db_session, mision.id, user.id, request)

    assert prueba.id is not None
    assert prueba.mision_id == mision.id
    assert prueba.usuario_id == user.id
    assert prueba.prueba_imagen_url is None
    assert prueba.prueba_texto == "Lo conseguí en el escenario principal"
    assert prueba.estado == "pending"


# ==============================================================================
# Tests de Endpoints HTTP (API REST): /api/misiones/{id}/complete
# ==============================================================================

@pytest.mark.asyncio
async def test_api_complete_mission_validation_http(client, db_session):
    """
    Verifica mediante el cliente HTTP ASGI que:
    1. Enviar solo imagen retorne 201.
    2. Enviar solo texto retorne 201.
    3. Enviar sin imagen ni texto retorne 422 Unprocessable Entity.
    """
    # 1. Registrar e iniciar sesión como jugador
    await client.post("/api/auth/register", json={"username": "jugador_api", "password": "password123"})
    login_res = await client.post("/api/auth/login", data={"username": "jugador_api", "password": "password123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    from sqlalchemy import select
    res_user = await db_session.execute(select(Usuario).filter(Usuario.username == "jugador_api"))
    user = res_user.scalars().first()

    # 2. Crear misiones de prueba
    m1 = Mision(titulo="Mision 1", creador_id=user.id, descripcion="D1", recompensa=10, fase="global", estado="activa")
    m2 = Mision(titulo="Mision 2", creador_id=user.id, descripcion="D2", recompensa=20, fase="global", estado="activa")
    m3 = Mision(titulo="Mision 3", creador_id=user.id, descripcion="D3", recompensa=30, fase="global", estado="activa")
    db_session.add_all([m1, m2, m3])
    await db_session.commit()
    await db_session.refresh(m1)
    await db_session.refresh(m2)
    await db_session.refresh(m3)

    # 3. Intentar completar m1 con solo imagen (debe ser 201)
    res_img = await client.post(
        f"/api/misiones/{m1.id}/complete",
        json={"proof_image_url": "https://res.cloudinary.com/test/photo.jpg"},
        headers=headers
    )
    assert res_img.status_code == 201
    assert "proof_id" in res_img.json()

    # 4. Intentar completar m2 con solo texto (debe ser 201)
    res_txt = await client.post(
        f"/api/misiones/{m2.id}/complete",
        json={"proof_text": "Reto cumplido a las 23:00"},
        headers=headers
    )
    assert res_txt.status_code == 201
    assert "proof_id" in res_txt.json()

    # 5. Intentar completar m3 sin pruebas (debe ser 422)
    res_empty = await client.post(
        f"/api/misiones/{m3.id}/complete",
        json={},
        headers=headers
    )
    assert res_empty.status_code == 422
