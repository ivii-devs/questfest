"""
================================================================================
TESTS DE INTEGRACIÓN Y SEGURIDAD: KITS DE EVENTOS Y PRESETS (QuestFest)
================================================================================
Verifica exhaustivamente:
1. Ciclo de vida CRUD de kits (creación, edición, borrado, permisos de autor).
2. Seguridad de roles: solo superadmin puede publicar kits oficiales ('es_oficial').
3. Navegación y filtros: tipo ('oficial', 'comunidad', 'mis-kits'), categoría y texto.
4. Toggle idempotente de Me Gusta (Likes) y reporte de moderación.
5. Inyección atómica en grupo: creación de misiones, ruletas y apuestas, respeto
   de estados ('activa'/'abierta' vs 'propuesta'), incremento de descargas y
   aislamiento de permisos ('verify_group_admin').
================================================================================
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.grupo import Grupo, MiembroGrupo
from app.models.juegos import Apuesta
from app.models.kits import KitEvento, KitReporte
from app.models.misiones import Mision
from app.models.usuario import Usuario
from app.security import create_access_token, get_password_hash


async def setup_test_actors(db_session: AsyncSession):
    """Crea los usuarios y devuelve sus modelos y tokens JWT."""
    admin_user = Usuario(
        username="admin_global_kits",
        password_hash=get_password_hash("AdminPass123!"),
        rol="admin",
        saldo_actual=1000,
    )
    user_a = Usuario(
        username="anfitrion_kits",
        password_hash=get_password_hash("PlayerPass123!"),
        rol="player",
        saldo_actual=100,
    )
    user_b = Usuario(
        username="miembro_kits",
        password_hash=get_password_hash("PlayerPass123!"),
        rol="player",
        saldo_actual=100,
    )
    db_session.add_all([admin_user, user_a, user_b])
    await db_session.commit()
    await db_session.refresh(admin_user)
    await db_session.refresh(user_a)
    await db_session.refresh(user_b)


    return {
        "admin": admin_user,
        "admin_token": create_access_token({"sub": admin_user.username, "user_id": admin_user.id}),
        "user_a": user_a,
        "user_a_token": create_access_token({"sub": user_a.username, "user_id": user_a.id}),
        "user_b": user_b,
        "user_b_token": create_access_token({"sub": user_b.username, "user_id": user_b.id}),
    }


async def setup_test_group(db_session: AsyncSession, user_a: Usuario, user_b: Usuario):
    """Crea una comunidad con user_a como admin y user_b como miembro."""
    grupo = Grupo(
        codigo_unico="QFTEST9",
        nombre="Grupo_Verificacion_Kits",
        descripcion="Comunidad de pruebas para inyección atómica",
        creador_id=user_a.id,
        saldo_inicial=100,
    )
    db_session.add(grupo)
    await db_session.commit()
    await db_session.refresh(grupo)

    miembro_admin = MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=user_a.id,
        rol="admin",
        saldo_grupo=100,
    )
    miembro_raso = MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=user_b.id,
        rol="member",
        saldo_grupo=100,
    )
    db_session.add_all([miembro_admin, miembro_raso])
    await db_session.commit()

    return grupo


def get_kit_payload_base():
    """Devuelve un payload válido para creación de kits."""
    return {
        "titulo": "Kit_Prueba_Social_Fiesta",
        "descripcion": "Descripción detallada del kit de prueba para eventos festivos.",
        "categoria": "Fiesta",
        "icono_url": "https://example.com/icon.png",
        "es_publico": True,
        "es_oficial": False,
        "contenido": {
            "misiones": [
                {
                    "titulo": "Mision_Brindis_3_Personas",
                    "descripcion": "Alzar copa con 3 amigos.",
                    "dificultad": "facil",
                    "recompensa_sugerida": 15,
                    "cupo_maximo": None,
                },
                {
                    "titulo": "Mision_Baile_Colectivo",
                    "descripcion": "Bailar con 2 personas.",
                    "dificultad": "media",
                    "recompensa_sugerida": 30,
                    "cupo_maximo": 5,
                },
            ],
            "ruletas": [
                {
                    "titulo": "Ruleta_Secreto_Divertido",
                    "descripcion": "Contar anécdota.",
                    "dificultad": "media",
                    "recompensa_sugerida": 25,
                }
            ],
            "apuestas": [
                {
                    "titulo": "Apuesta_Primer_Comensal",
                    "opciones": [
                        {"id": "opt1", "text": "El Anfitrión", "multiplier": 2.0},
                        {"id": "opt2", "text": "El Conductor", "multiplier": 2.5},
                    ],
                }
            ],
        },
    }


@pytest.mark.asyncio
async def test_create_kit_regular_user_cannot_forge_official(client: AsyncClient, db_session: AsyncSession):
    """Un usuario estándar no puede forzar es_oficial=True al crear un kit."""
    actors = await setup_test_actors(db_session)
    payload = get_kit_payload_base()
    payload["es_oficial"] = True

    response = await client.post(
        "/api/v1/kits/",
        json=payload,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["titulo"] == "Kit_Prueba_Social_Fiesta"
    assert data["es_oficial"] is False
    assert data["autor_username"] == "anfitrion_kits"
    assert data["total_misiones"] == 2
    assert data["total_ruletas"] == 1
    assert data["total_apuestas"] == 1


@pytest.mark.asyncio
async def test_create_kit_admin_can_create_official(client: AsyncClient, db_session: AsyncSession):
    """Un superadministrador global sí puede publicar kits marcados como oficiales."""
    actors = await setup_test_actors(db_session)
    payload = get_kit_payload_base()
    payload["es_oficial"] = True
    payload["titulo"] = "Kit_Oficial_Verificado_Sistema"

    response = await client.post(
        "/api/v1/kits/",
        json=payload,
        headers={"Authorization": f"Bearer {actors['admin_token']}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["es_oficial"] is True


@pytest.mark.asyncio
async def test_list_kits_filters_and_search(client: AsyncClient, db_session: AsyncSession):
    """Verifica filtrado por tipo ('oficial', 'comunidad', 'mis-kits'), categoría y búsqueda."""
    actors = await setup_test_actors(db_session)

    # 1. Kit oficial
    admin_kit = get_kit_payload_base()
    admin_kit["titulo"] = "Kit_Oficial_Deportes"
    admin_kit["categoria"] = "Deporte"
    admin_kit["es_oficial"] = True
    await client.post(
        "/api/v1/kits/",
        json=admin_kit,
        headers={"Authorization": f"Bearer {actors['admin_token']}"},
    )

    # 2. Kit público comunidad
    user_kit = get_kit_payload_base()
    user_kit["titulo"] = "Kit_Comunidad_Fiesta"
    user_kit["categoria"] = "Fiesta"
    await client.post(
        "/api/v1/kits/",
        json=user_kit,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )

    # 3. Kit privado
    private_kit = get_kit_payload_base()
    private_kit["titulo"] = "Kit_Privado_Solo_Mio"
    private_kit["categoria"] = "Chill"
    private_kit["es_publico"] = False
    await client.post(
        "/api/v1/kits/",
        json=private_kit,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )

    # Filtro tipo=oficial
    res_oficial = await client.get("/api/v1/kits/?tipo=oficial")
    assert res_oficial.status_code == 200
    titulos_oficial = [k["titulo"] for k in res_oficial.json()]
    assert "Kit_Oficial_Deportes" in titulos_oficial
    assert "Kit_Comunidad_Fiesta" not in titulos_oficial

    # Filtro tipo=comunidad
    res_comunidad = await client.get("/api/v1/kits/?tipo=comunidad")
    assert res_comunidad.status_code == 200
    titulos_comunidad = [k["titulo"] for k in res_comunidad.json()]
    assert "Kit_Comunidad_Fiesta" in titulos_comunidad
    assert "Kit_Oficial_Deportes" not in titulos_comunidad

    # Filtro tipo=mis-kits
    res_mis_kits = await client.get(
        "/api/v1/kits/?tipo=mis-kits",
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_mis_kits.status_code == 200
    titulos_mis = [k["titulo"] for k in res_mis_kits.json()]
    assert "Kit_Comunidad_Fiesta" in titulos_mis
    assert "Kit_Privado_Solo_Mio" in titulos_mis
    assert "Kit_Oficial_Deportes" not in titulos_mis

    # Filtro por categoría
    res_cat = await client.get("/api/v1/kits/?categoria=Deporte")
    assert res_cat.status_code == 200
    assert all(k["categoria"] == "Deporte" for k in res_cat.json())

    # Búsqueda libre
    res_search = await client.get("/api/v1/kits/?query=Deportes")
    assert res_search.status_code == 200
    assert len(res_search.json()) >= 1
    assert res_search.json()[0]["titulo"] == "Kit_Oficial_Deportes"


@pytest.mark.asyncio
async def test_update_and_delete_permissions(client: AsyncClient, db_session: AsyncSession):
    """Solo el autor o superadmin pueden modificar o eliminar un kit."""
    actors = await setup_test_actors(db_session)
    res = await client.post(
        "/api/v1/kits/",
        json=get_kit_payload_base(),
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    kit_id = res.json()["id"]

    # user_b intenta modificar -> 403 Forbidden
    res_edit_forbidden = await client.put(
        f"/api/v1/kits/{kit_id}",
        json={"titulo": "Titulo_Modificado_Hack"},
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_edit_forbidden.status_code == 403

    # user_a (autor) modifica -> 200 OK
    res_edit_ok = await client.put(
        f"/api/v1/kits/{kit_id}",
        json={"titulo": "Titulo_Modificado_Autor"},
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_edit_ok.status_code == 200
    assert res_edit_ok.json()["titulo"] == "Titulo_Modificado_Autor"

    # user_b intenta borrar -> 403 Forbidden
    res_delete_forbidden = await client.delete(
        f"/api/v1/kits/{kit_id}",
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_delete_forbidden.status_code == 403

    # user_a borra con éxito -> 204 No Content
    res_delete_ok = await client.delete(
        f"/api/v1/kits/{kit_id}",
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_delete_ok.status_code == 204

    # Verificar que ya no existe -> 404
    res_get = await client.get(f"/api/v1/kits/{kit_id}")
    assert res_get.status_code == 404


@pytest.mark.asyncio
async def test_toggle_kit_like_idempotency(client: AsyncClient, db_session: AsyncSession):
    """El endpoint /like incrementa y decrementa atómicamente el contador."""
    actors = await setup_test_actors(db_session)
    res = await client.post(
        "/api/v1/kits/",
        json=get_kit_payload_base(),
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    kit_id = res.json()["id"]

    # Primer like
    res_like1 = await client.post(
        f"/api/v1/kits/{kit_id}/like",
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_like1.status_code == 200
    assert res_like1.json() == {"liked": True, "likes_count": 1}

    # Segundo like (toggle off)
    res_like2 = await client.post(
        f"/api/v1/kits/{kit_id}/like",
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_like2.status_code == 200
    assert res_like2.json() == {"liked": False, "likes_count": 0}


@pytest.mark.asyncio
async def test_report_kit(client: AsyncClient, db_session: AsyncSession):
    """Denunciar un kit registra la incidencia sin censura ciega."""
    actors = await setup_test_actors(db_session)
    res = await client.post(
        "/api/v1/kits/",
        json=get_kit_payload_base(),
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    kit_id = res.json()["id"]

    res_report = await client.post(
        f"/api/v1/kits/{kit_id}/report",
        json={"motivo": "Contenido que infringe las reglas de la comunidad."},
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_report.status_code == 201

    # El kit sigue accesible públicamente
    res_get = await client.get(f"/api/v1/kits/{kit_id}")
    assert res_get.status_code == 200

    report_stmt = select(KitReporte).filter(KitReporte.kit_id == kit_id)
    report_res = await db_session.execute(report_stmt)
    assert report_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_inject_kit_atomic_in_group_success_and_draft(client: AsyncClient, db_session: AsyncSession):
    """Inyección atómica en bloque verificando persistencia, estados y descargas."""
    actors = await setup_test_actors(db_session)
    grupo = await setup_test_group(db_session, actors["user_a"], actors["user_b"])

    res_kit = await client.post(
        "/api/v1/kits/",
        json=get_kit_payload_base(),
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    kit_id = res_kit.json()["id"]

    injection_payload = {
        "kit_id": kit_id,
        "publicar_inmediatamente": True,
        "misiones_seleccionadas": [
            {
                "titulo": "Mision_Inyectada_A",
                "descripcion": "Descripción A adaptada.",
                "recompensa": 20,
                "cupo_maximo": 3,
            }
        ],
        "ruletas_seleccionadas": [
            {
                "titulo": "Ruleta_Inyectada_B",
                "descripcion": "Descripción Ruleta.",
                "recompensa": 25,
            }
        ],
        "apuestas_seleccionadas": [
            {
                "titulo": "¿Quién pagará la primera ronda?",
                "opciones": [
                    {"id": "opt1", "text": "Carlos", "multiplier": 2.0},
                    {"id": "opt2", "text": "Sofia", "multiplier": 2.5},
                ],
            }
        ],
    }

    # Inyección con admin del grupo
    res_inj = await client.post(
        f"/api/v1/grupos/{grupo.id}/kits/inject",
        json=injection_payload,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_inj.status_code == 200
    data_inj = res_inj.json()
    assert data_inj["misiones_creadas"] == 1
    assert data_inj["ruletas_creadas"] == 1
    assert data_inj["apuestas_creadas"] == 1
    assert data_inj["estado_asignado"] == "activa"

    # Verificar en base de datos
    mision_stmt = select(Mision).filter(
        Mision.grupo_id == grupo.id, Mision.titulo == "Mision_Inyectada_A"
    )
    mision_db = (await db_session.execute(mision_stmt)).scalars().first()
    assert mision_db is not None
    assert mision_db.es_ruleta is False
    assert mision_db.estado == "activa"
    assert mision_db.recompensa == 20
    assert mision_db.cupo_maximo == 3

    ruleta_stmt = select(Mision).filter(
        Mision.grupo_id == grupo.id, Mision.titulo == "Ruleta_Inyectada_B"
    )
    ruleta_db = (await db_session.execute(ruleta_stmt)).scalars().first()
    assert ruleta_db is not None
    assert ruleta_db.es_ruleta is True
    assert ruleta_db.estado == "activa"

    apuesta_stmt = select(Apuesta).filter(
        Apuesta.grupo_id == grupo.id,
        Apuesta.titulo == "¿Quién pagará la primera ronda?",
    )
    apuesta_db = (await db_session.execute(apuesta_stmt)).scalars().first()
    assert apuesta_db is not None
    assert apuesta_db.estado == "abierta"
    assert "opt1" in apuesta_db.opciones
    assert apuesta_db.opciones["opt1"]["text"] == "Carlos"

    kit_db = (
        await db_session.execute(select(KitEvento).filter(KitEvento.id == kit_id))
    ).scalars().first()
    assert kit_db.descargas_count == 1

    # Inyección en modo borrador
    draft_payload = dict(injection_payload)
    draft_payload["publicar_inmediatamente"] = False
    draft_payload["misiones_seleccionadas"] = [
        {
            "titulo": "Mision_Borrador",
            "descripcion": "En espera de activación.",
            "recompensa": 15,
            "cupo_maximo": None,
        }
    ]
    draft_payload["ruletas_seleccionadas"] = []
    draft_payload["apuestas_seleccionadas"] = []

    res_draft = await client.post(
        f"/api/v1/grupos/{grupo.id}/kits/inject",
        json=draft_payload,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_draft.status_code == 200
    assert res_draft.json()["estado_asignado"] == "propuesta"

    mision_draft = (
        await db_session.execute(
            select(Mision).filter(
                Mision.grupo_id == grupo.id, Mision.titulo == "Mision_Borrador"
            )
        )
    ).scalars().first()
    assert mision_draft.estado == "propuesta"


@pytest.mark.asyncio
async def test_inject_kit_permission_denied_for_non_admin(client: AsyncClient, db_session: AsyncSession):
    """Un miembro raso no puede inyectar kits en el grupo -> 403 Forbidden."""
    actors = await setup_test_actors(db_session)
    grupo = await setup_test_group(db_session, actors["user_a"], actors["user_b"])

    injection_payload = {
        "misiones_seleccionadas": [
            {
                "titulo": "Intento_Fraude",
                "descripcion": "No autorizado",
                "recompensa": 100,
            }
        ]
    }

    response = await client.post(
        f"/api/v1/grupos/{grupo.id}/kits/inject",
        json=injection_payload,
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_kit_empty_contents_rejected(client: AsyncClient, db_session: AsyncSession):
    """Crear un kit sin retos (misiones, ruletas ni apuestas) debe retornar 400 Bad Request."""
    actors = await setup_test_actors(db_session)
    payload = get_kit_payload_base()
    payload["contenido"] = {"misiones": [], "ruletas": [], "apuestas": []}

    response = await client.post(
        "/api/v1/kits/",
        json=payload,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert response.status_code == 400
    assert "al menos una misión, ruleta o apuesta" in response.json()["detail"]


@pytest.mark.asyncio
async def test_report_kit_security_validations(client: AsyncClient, db_session: AsyncSession):
    """Verifica protecciones de denuncias: oficial no denunciable, autor no auto-denuncia, no duplicados."""
    actors = await setup_test_actors(db_session)

    # 1. Crear kit oficial
    official_payload = get_kit_payload_base()
    official_payload["titulo"] = "Kit_Oficial_Intocable"
    official_payload["es_oficial"] = True
    res_off = await client.post(
        "/api/v1/kits/",
        json=official_payload,
        headers={"Authorization": f"Bearer {actors['admin_token']}"},
    )
    off_id = res_off.json()["id"]

    # Intentar reportar kit oficial -> 400
    res_rep_off = await client.post(
        f"/api/v1/kits/{off_id}/report",
        json={"motivo": "No me gusta este kit oficial"},
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_rep_off.status_code == 400
    assert "oficiales" in res_rep_off.json()["detail"].lower()

    # 2. Crear kit comunitario
    comm_payload = get_kit_payload_base()
    comm_payload["titulo"] = "Kit_Comunidad_Denunciable"
    res_comm = await client.post(
        "/api/v1/kits/",
        json=comm_payload,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    comm_id = res_comm.json()["id"]

    # Autor intenta denunciar su propio kit -> 400
    res_own = await client.post(
        f"/api/v1/kits/{comm_id}/report",
        json={"motivo": "Auto denuncia"},
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_own.status_code == 400
    assert "propio" in res_own.json()["detail"].lower()

    # user_b reporta -> 201 OK
    res_rep1 = await client.post(
        f"/api/v1/kits/{comm_id}/report",
        json={"motivo": "Contenido spam"},
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_rep1.status_code == 201

    # user_b reporta nuevamente -> 400 Bad Request (duplicado)
    res_rep2 = await client.post(
        f"/api/v1/kits/{comm_id}/report",
        json={"motivo": "Segundo reporte duplicado"},
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_rep2.status_code == 400
    assert "ya has enviado" in res_rep2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_inject_kit_validations_and_integrity(client: AsyncClient, db_session: AsyncSession):
    """Verifica: inyección vacía (400), kit inexistente (404), kit privado ajeno (403), y fecha_aprobacion en apuestas."""
    actors = await setup_test_actors(db_session)
    grupo = await setup_test_group(db_session, actors["user_a"], actors["user_b"])

    # 1. Inyección vacía -> 400
    res_empty = await client.post(
        f"/api/v1/grupos/{grupo.id}/kits/inject",
        json={"misiones_seleccionadas": [], "ruletas_seleccionadas": [], "apuestas_seleccionadas": []},
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_empty.status_code == 400
    assert "al menos una misión" in res_empty.json()["detail"]

    # 2. Inyección con kit_id inexistente -> 404
    res_404 = await client.post(
        f"/api/v1/grupos/{grupo.id}/kits/inject",
        json={
            "kit_id": 99999,
            "misiones_seleccionadas": [{"titulo": "Mision 1", "descripcion": "Descripcion 1", "recompensa": 20}],
        },
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_404.status_code == 404

    # 3. user_a crea un kit privado
    private_payload = get_kit_payload_base()
    private_payload["titulo"] = "Kit_Super_Privado_A"
    private_payload["es_publico"] = False
    res_priv = await client.post(
        "/api/v1/kits/",
        json=private_payload,
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    priv_kit_id = res_priv.json()["id"]

    # user_b crea su propio grupo donde es admin
    grupo_b = Grupo(
        codigo_unico="GRPB01",
        nombre="Grupo_Propio_B",
        descripcion="Comunidad de B",
        creador_id=actors["user_b"].id,
        saldo_inicial=100,
    )
    db_session.add(grupo_b)
    await db_session.commit()
    await db_session.refresh(grupo_b)
    db_session.add(MiembroGrupo(grupo_id=grupo_b.id, usuario_id=actors["user_b"].id, rol="admin", saldo_grupo=100))
    await db_session.commit()

    # user_b intenta inyectar el kit privado de user_a -> 403 Forbidden
    res_forbidden_priv = await client.post(
        f"/api/v1/grupos/{grupo_b.id}/kits/inject",
        json={
            "kit_id": priv_kit_id,
            "misiones_seleccionadas": [{"titulo": "Robo_Privado", "descripcion": "Descripcion Robo", "recompensa": 20}],
        },
        headers={"Authorization": f"Bearer {actors['user_b_token']}"},
    )
    assert res_forbidden_priv.status_code == 403
    assert "kit privado" in res_forbidden_priv.json()["detail"].lower()

    # 4. Inyección inmediata sella fecha_aprobacion en Apuesta
    res_bet_inj = await client.post(
        f"/api/v1/grupos/{grupo.id}/kits/inject",
        json={
            "publicar_inmediatamente": True,
            "misiones_seleccionadas": [],
            "ruletas_seleccionadas": [],
            "apuestas_seleccionadas": [
                {
                    "titulo": "Apuesta_Con_Fecha_Aprobacion",
                    "opciones": [
                        {"id": "o1", "text": "A", "multiplier": 2.0},
                        {"id": "o2", "text": "B", "multiplier": 2.0},
                    ],
                }
            ],
        },
        headers={"Authorization": f"Bearer {actors['user_a_token']}"},
    )
    assert res_bet_inj.status_code == 200

    apuesta_db = (
        await db_session.execute(
            select(Apuesta).filter(
                Apuesta.grupo_id == grupo.id,
                Apuesta.titulo == "Apuesta_Con_Fecha_Aprobacion",
            )
        )
    ).scalars().first()
    assert apuesta_db is not None
    assert apuesta_db.estado == "abierta"
    assert apuesta_db.fecha_aprobacion is not None

