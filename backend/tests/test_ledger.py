import pytest
from app.crud.ledger_crud import move_tokens
from app.models.usuario import Usuario, LedgerTransaccion
from sqlalchemy.future import select
from fastapi import HTTPException

@pytest.mark.asyncio
async def test_move_tokens_positive(db_session):
    # Crear usuario de prueba
    user = Usuario(username="test_ledger_user", password_hash="hash", rol="player", saldo_actual=100)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Otorgar 50 QuestCoins
    await move_tokens(db_session, user.id, 50, "Bono de bienvenida")
    await db_session.refresh(user)

    assert user.saldo_actual == 150

    # Verificar registro en Ledger
    stmt = select(LedgerTransaccion).where(LedgerTransaccion.usuario_id == user.id)
    tx = (await db_session.execute(stmt)).scalar_one()
    assert tx.cantidad == 50
    assert tx.concepto == "Bono de bienvenida"
    assert tx.saldo_resultante == 150

@pytest.mark.asyncio
async def test_move_tokens_overdraft_protection(db_session):
    # Crear usuario con saldo 20
    user = Usuario(username="poor_user", password_hash="hash", rol="player", saldo_actual=20)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Intentar deducir 50 QuestCoins (debe lanzar excepcion por saldo insuficiente)
    with pytest.raises(HTTPException) as exc_info:
        await move_tokens(db_session, user.id, -50, "Compra imposible")

    assert exc_info.value.status_code == 400
    assert "saldo insuficiente" in exc_info.value.detail.lower() or "denegada" in exc_info.value.detail.lower()

    # El saldo no debe haber cambiado
    await db_session.refresh(user)
    assert user.saldo_actual == 20
