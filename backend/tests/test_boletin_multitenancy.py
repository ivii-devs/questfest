import pytest
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import Grupo, MiembroGrupo
from app.models.misiones import Mision, PruebaMision
from app.models.juegos import Apuesta, TicketApuesta, Duelo
from app.crud.admin_crud import calculate_summary_stats
from app.api.routers.settings import get_boletin_config, update_boletin_config

@pytest.mark.asyncio
async def test_boletin_stats_group_isolation(db_session):
    """
    Verifica que el cálculo de estadísticas del boletín diario esté estrictamente
    aislado por grupo, reportando líderes, farolillos rojos y actividades específicas.
    """
    # 1. Crear dos comunidades distintas
    grupo_a = Grupo(codigo_unico="QF-TESTA1", nombre="Grupo Fiesta A", saldo_inicial=100)
    grupo_b = Grupo(codigo_unico="QF-TESTB2", nombre="Grupo Fiesta B", saldo_inicial=100)
    db_session.add_all([grupo_a, grupo_b])
    await db_session.commit()
    await db_session.refresh(grupo_a)
    await db_session.refresh(grupo_b)

    # 2. Crear usuarios y membresías
    # En Grupo A: user_a1 (500 QC), user_a2 (50 QC)
    user_a1 = Usuario(username="lider_a", password_hash="h", rol="player", saldo_actual=0)
    user_a2 = Usuario(username="ultimo_a", password_hash="h", rol="player", saldo_actual=0)
    # En Grupo B: user_b1 (300 QC), user_b2 (20 QC)
    user_b1 = Usuario(username="lider_b", password_hash="h", rol="player", saldo_actual=0)
    user_b2 = Usuario(username="ultimo_b", password_hash="h", rol="player", saldo_actual=0)
    db_session.add_all([user_a1, user_a2, user_b1, user_b2])
    await db_session.commit()

    m_a1 = MiembroGrupo(grupo_id=grupo_a.id, usuario_id=user_a1.id, rol="admin", saldo_grupo=500)
    m_a2 = MiembroGrupo(grupo_id=grupo_a.id, usuario_id=user_a2.id, rol="member", saldo_grupo=50)
    m_b1 = MiembroGrupo(grupo_id=grupo_b.id, usuario_id=user_b1.id, rol="admin", saldo_grupo=300)
    m_b2 = MiembroGrupo(grupo_id=grupo_b.id, usuario_id=user_b2.id, rol="member", saldo_grupo=20)
    db_session.add_all([m_a1, m_a2, m_b1, m_b2])
    await db_session.commit()

    # 3. Misión aprobada en Grupo A para user_a2
    mision_a = Mision(grupo_id=grupo_a.id, titulo="Cantar en karaoke", creador_id=user_a1.id, descripcion="D", recompensa=30, fase="Noche 1")
    db_session.add(mision_a)
    await db_session.commit()
    await db_session.refresh(mision_a)

    prueba_a = PruebaMision(mision_id=mision_a.id, usuario_id=user_a2.id, estado="approved")
    db_session.add(prueba_a)
    await db_session.commit()

    # 4. Consultar estadísticas para Grupo A
    stats_a = await calculate_summary_stats(db_session, group_id=grupo_a.id)
    assert stats_a.firstPlace is not None
    assert stats_a.firstPlace.name == "lider_a"
    assert stats_a.firstPlace.points == 500

    assert stats_a.lastPlace is not None
    assert stats_a.lastPlace.name == "ultimo_a"
    assert stats_a.lastPlace.points == 50

    assert stats_a.mostMissions is not None
    assert stats_a.mostMissions.name == "ultimo_a"
    assert stats_a.mostMissions.count == 1

    # 5. Consultar estadísticas para Grupo B (no debe mezclar datos de Grupo A)
    stats_b = await calculate_summary_stats(db_session, group_id=grupo_b.id)
    assert stats_b.firstPlace is not None
    assert stats_b.firstPlace.name == "lider_b"
    assert stats_b.firstPlace.points == 300

    assert stats_b.lastPlace is not None
    assert stats_b.lastPlace.name == "ultimo_b"
    assert stats_b.lastPlace.points == 20

    # Grupo B no tiene misiones aprobadas
    assert stats_b.mostMissions is None

@pytest.mark.asyncio
async def test_boletin_config_group_isolation(db_session):
    """
    Verifica que la configuración horaria y de fases del boletín se almacene
    de forma independiente por grupo, manteniendo fallback al valor global.
    """
    admin = Usuario(username="super_admin", password_hash="h", rol="admin", saldo_actual=0)
    db_session.add(admin)
    await db_session.commit()

    # Guardar configuración para Grupo 99
    payload_g99 = {
        "hora": "08:30",
        "phaseValue": "Madrugada Épica",
        "firstPlace": True,
        "lastPlace": False
    }
    await update_boletin_config(payload=payload_g99, group_id=99, current_user=admin, db=db_session)

    # Recuperar config para Grupo 99
    config_99 = await get_boletin_config(group_id=99, db=db_session)
    assert config_99["hora"] == "08:30"
    assert config_99["phaseValue"] == "Madrugada Épica"
    assert config_99["lastPlace"] is False
    assert config_99["firstPlace"] is True

    # Recuperar config para Grupo 100 (debe retornar defaults globales ya que no tiene personalizada)
    config_100 = await get_boletin_config(group_id=100, db=db_session)
    assert config_100["hora"] == "12:00"
    assert config_100["phaseValue"] == "Noche 1"
    assert config_100["lastPlace"] is True
