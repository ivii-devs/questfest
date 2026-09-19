"""
================================================================================
ROUTER DE ADMINISTRACIÓN Y TRIBUNAL: QuestFest
================================================================================
Este enrutador centraliza todas las operaciones de control, supervisión y arbitraje
del juego. Está protegido a nivel de router por la dependencia `get_admin_user`,
lo que garantiza que ninguna ruta pueda ser invocada por un jugador raso.

Áreas principales cubiertas:
1. Gestión de Contenido: Subida de medios a Cloudinary y anuncios oficiales.
2. Notificaciones Administrativas: Creación, programación y preview de audiencias.
3. Supervisión Contable: Ajustes de saldo, auditoría con Ledger y log de acciones.
4. Resumen Diario: Cómputo de líderes, farolillos rojos y mayores ganadores/perdedores.
5. Mercado de Apuestas: Edición de cuotas, apertura y liquidación con abono seguro.
6. Tribunal de Duelos: Arbitraje en disputas (victoria, empate, sanciones).
7. Tribunal de Misiones: Curación de sugerencias y verificación de pruebas.
================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from starlette.concurrency import run_in_threadpool
import cloudinary.uploader

from app.core.database import get_db
from app.dependencies import get_admin_user
from app.crud.admin_crud import calculate_summary_stats
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.publicaciones import Publicacion
from app.models.notificaciones import NotificacionAdmin
from app.models.misiones import Mision, PruebaMision
from app.models.juegos import TicketApuesta, Duelo, Apuesta
from app.schemas.admin_schemas import (
    AnuncioCreate, NotificacionCreate, NotificacionResponse,
    GlobalStats, UserBalanceUpdate, RuletaMisionCreate, AudiencePreviewRequest,
    DailySummaryStatsResponse, StatUser, DuelStat, BetStatusUpdate,
    AdminAprobarSugerencia, AdminRechazarPrueba
)
from app.schemas.auth_schemas import UserResponse
from app.schemas.apuestas_schemas import AdminEditBetRequest
from app.schemas.user_schemas import TransactionResponse
from pydantic import BaseModel

# DTO para dictar sentencias administrativas sobre duelos en conflicto
class AdminResolveDuelRequest(BaseModel):
    resolution: str
    penalize: str = "none"
    penalize_amount: int = 0
    motivo_multa: str = ""

router = APIRouter(
    tags=["Admin Panel"],
    dependencies=[Depends(get_admin_user)]
)

# --------------------------------------------------------------------------
# 1. GESTIÓN DE CONTENIDO Y MEDIOS
# --------------------------------------------------------------------------

@router.post("/upload-media")
async def upload_media(file: UploadFile = File(...)):
    """
    Sube un archivo multimedia (imagen o vídeo) directamente a Cloudinary.
    
    ¿Por qué usamos `run_in_threadpool`?
    El SDK oficial de Cloudinary (`cloudinary.uploader.upload`) es síncrono y bloqueante.
    Si lo llamáramos de forma directa en la función `async`, detendría por completo
    el bucle de eventos de asyncio durante la transferencia de red hacia el CDN.
    Al delegarlo al threadpool de Starlette, liberamos a los demás usuarios concurrentes.
    """
    try:
        result = await run_in_threadpool(cloudinary.uploader.upload, file.file)
        return {"url": result.get("secure_url")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo archivo a Cloudinary: {str(e)}")

@router.post("/announcements")
async def create_announcement(anuncio: AnuncioCreate, db: AsyncSession = Depends(get_db)):
    """
    Publica un anuncio institucional en el Muro Social.
    
    Se marca con `es_sistema=True` para que el frontend le dé un tratamiento visual
    destacado (borde dorado, distintivo oficial, no editable por jugadores).
    """
    pub = Publicacion(
        tipo="social",
        es_sistema=True,
        contenido=anuncio.contenido,
        media_url=anuncio.media_url
    )
    db.add(pub)
    await db.commit()
    return {"message": "Anuncio creado"}

# --------------------------------------------------------------------------
# 2. SISTEMA DE NOTIFICACIONES ADMINISTRATIVAS
# --------------------------------------------------------------------------

@router.post("/notifications", response_model=NotificacionResponse)
async def create_notification(notif: NotificacionCreate, db: AsyncSession = Depends(get_db)):
    """
    Emite o programa una notificación dirigida a una audiencia determinada.
    
    Si `fecha_programada` está en el futuro, el estado inicial es 'pending'
    para que un cron o worker en segundo plano la despache en su momento. Si no,
    se marca inmediatamente como 'sent'.
    """
    nueva = NotificacionAdmin(
        titulo=notif.titulo,
        mensaje=notif.mensaje,
        media_url=notif.media_url,
        fecha_programada=notif.fecha_programada,
        destinatario_tipo=notif.destinatario_tipo,
        destinatario_id=notif.destinatario_id,
        config_boletin=notif.config_boletin,
        estado="pending" if notif.fecha_programada else "sent"
    )
    db.add(nueva)
    await db.commit()
    await db.refresh(nueva)
    return nueva

@router.post("/notifications/preview-audience", response_model=List[UserResponse])
async def preview_audience(request: AudiencePreviewRequest, db: AsyncSession = Depends(get_db)):
    """
    Permite al administrador ver qué usuarios recibirán el aviso antes de lanzarlo.
    
    Segmentaciones soportadas:
    - 'all': Todos los usuarios registrados.
    - 'bankrupt': Usuarios cuyo saldo es 0 o negativo (candidatos a rescate).
    - 'specific': Un único jugador identificado por su ID.
    - 'no_bet': Usuarios que aún no han realizado ninguna apuesta en el día de hoy.
    """
    if request.destinatario_tipo == 'all':
        result = await db.execute(select(Usuario))
        return result.scalars().all()
    elif request.destinatario_tipo == 'bankrupt':
        result = await db.execute(select(Usuario).where(Usuario.saldo_actual <= 0))
        return result.scalars().all()
    elif request.destinatario_tipo == 'specific':
        if not request.destinatario_id:
            return []
        result = await db.execute(select(Usuario).where(Usuario.id == request.destinatario_id))
        return result.scalars().all()
    elif request.destinatario_tipo == 'no_bet':
        from datetime import date
        subq = select(TicketApuesta.usuario_id).where(TicketApuesta.fecha == date.today()).subquery()
        result = await db.execute(select(Usuario).where(Usuario.id.notin_(select(subq))))
        return result.scalars().all()
    return []

@router.get("/notifications", response_model=List[NotificacionResponse])
async def list_notifications(db: AsyncSession = Depends(get_db)):
    """Lista el historial de notificaciones administrativas ordenadas de más reciente a más antigua."""
    result = await db.execute(select(NotificacionAdmin).order_by(NotificacionAdmin.fecha_creacion.desc()))
    return result.scalars().all()

# --------------------------------------------------------------------------
# 3. SUPERVISIÓN Y CONTROL DE USUARIOS Y FONDOS
# --------------------------------------------------------------------------

@router.get("/users/stats", response_model=GlobalStats)
async def get_global_stats(db: AsyncSession = Depends(get_db)):
    """
    Devuelve métricas macroeconómicas del juego:
    - Número total de participantes registrados.
    - Masa monetaria global en circulación (suma de tokens en cuentas).
    """
    total_users = await db.scalar(select(func.count(Usuario.id)))
    total_tokens = await db.scalar(select(func.sum(Usuario.saldo_actual)))
    return GlobalStats(total_users=total_users or 0, total_tokens=total_tokens or 0)

@router.get("/users", response_model=List[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    """Lista completa de usuarios para el panel de administración, ordenados alfabéticamente."""
    result = await db.execute(select(Usuario).order_by(Usuario.username))
    return result.scalars().all()

@router.post("/users/{user_id}/balance", response_model=UserResponse)
async def update_user_balance(
    user_id: int, 
    update_data: UserBalanceUpdate, 
    db: AsyncSession = Depends(get_db),
    admin_user: Usuario = Depends(get_admin_user)
):
    """
    Ajuste manual de saldo ejecutado por un administrador.
    
    Reglas críticas de integridad contable:
    1. El saldo de un usuario no puede quedar por debajo de 0 (se trunca si la resta excediera).
    2. Todo movimiento manual DEBE reflejarse en el `LedgerTransaccion` con su snapshot `saldo_resultante`.
    3. Se emite una notificación al usuario para justificar el ajuste en su pantalla.
    4. Se crea un registro indeleble en la tabla de `AuditLog` para garantizar trazabilidad interna.
    """
    user = await db.scalar(select(Usuario).where(Usuario.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.saldo_actual += update_data.cantidad
    if user.saldo_actual < 0:
        user.saldo_actual = 0
        
    # Registro inmutable en el Libro Contable (Ledger)
    tx = LedgerTransaccion(
        usuario_id=user.id,
        cantidad=update_data.cantidad,
        concepto=update_data.concepto,
        saldo_resultante=user.saldo_actual
    )
    db.add(tx)
    
    # Notificación informativa directa al usuario afectado
    notif = NotificacionAdmin(
        titulo="Actualización de Saldo",
        mensaje=update_data.concepto,
        destinatario_tipo="specific",
        destinatario_id=user.id,
        estado="sent"
    )
    db.add(notif)

    # Registro de auditoría administrativa para saber qué admin realizó el cambio y por qué
    from app.crud.audit_crud import log_admin_action
    await log_admin_action(
        db=db,
        admin_id=admin_user.id,
        action="update_user_balance",
        entity="usuario",
        entity_id=user_id,
        details={"cantidad": update_data.cantidad, "concepto": update_data.concepto, "saldo_nuevo": user.saldo_actual}
    )
    
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/users/{user_id}/transactions", response_model=List[TransactionResponse])
async def get_user_transactions(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    Historial completo de movimientos contables de un usuario concreto.
    Permite al administrador auditar fraudes, recargas o devoluciones.
    """
    result = await db.execute(
        select(LedgerTransaccion)
        .where(LedgerTransaccion.usuario_id == user_id)
        .order_by(LedgerTransaccion.fecha_creacion.desc())
    )
    transactions = result.scalars().all()
    response = []
    for tx in transactions:
        response.append(TransactionResponse(
            id=tx.id,
            type='income' if tx.cantidad > 0 else 'expense',
            amount=tx.cantidad,
            concept=tx.concepto,
            date=tx.fecha_creacion.isoformat(),
            balance=tx.saldo_resultante
        ))
    return response

# --------------------------------------------------------------------------
# 4. RULETA Y RESÚMENES DIARIOS
# --------------------------------------------------------------------------

@router.post("/roulette", response_model=dict)
async def create_roulette_mission(mision: RuletaMisionCreate, current_user: Usuario = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    """
    Crea una misión exclusiva para el bombo de la Ruleta Diaria.
    Nace con `es_ruleta=True` y en fase 'activa' para estar disponible en los sorteos.
    """
    nueva_mision = Mision(
        titulo=mision.titulo,
        descripcion=mision.descripcion,
        recompensa=mision.recompensa,
        creador_id=current_user.id,
        fase="activa",
        es_ruleta=True,
        media_url=mision.media_url
    )
    db.add(nueva_mision)
    await db.commit()
    return {"message": "Misión de ruleta añadida al bombo"}

@router.get("/summary-stats", response_model=DailySummaryStatsResponse)
async def get_summary_stats(
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Genera el resumen estadístico diario para el boletín matutino de la fiesta.
    Soporta filtrado contextual por 'group_id' para previsualizar las estadísticas del grupo activo.
    """
    return await calculate_summary_stats(db=db, group_id=group_id)

# --------------------------------------------------------------------------
# 5. GESTIÓN Y RESOLUCIÓN DE APUESTAS
# --------------------------------------------------------------------------

@router.put("/bets/{bet_id}")
async def edit_suggested_bet(bet_id: int, edit_data: AdminEditBetRequest, db: AsyncSession = Depends(get_db)):
    """
    Permite al administrador corregir el texto o reajustar los multiplicadores
    de una apuesta propuesta por un jugador antes de abrirla al público general.
    Solo se permite en estado 'propuesta'.
    """
    result = await db.execute(select(Apuesta).where(Apuesta.id == bet_id))
    bet = result.scalars().first()
    if not bet:
        raise HTTPException(status_code=404, detail="Apuesta no encontrada")
        
    if bet.estado != 'propuesta':
        raise HTTPException(status_code=400, detail="Solo se pueden editar apuestas en estado propuesta")
        
    bet.titulo = edit_data.title
    
    # Reconstruimos la estructura JSONB de opciones con IDs secuenciales basados en 1
    new_options = {}
    for i, opt in enumerate(edit_data.options):
        opt_id = str(i + 1)
        new_options[opt_id] = {
            "text": opt.text,
            "multiplier": opt.multiplier
        }
        
    bet.opciones = new_options
    
    await db.commit()
    return {"message": "Apuesta actualizada exitosamente"}

@router.patch("/bets/{bet_id}/status")
async def update_bet_status(bet_id: int, update_data: BetStatusUpdate, db: AsyncSession = Depends(get_db)):
    """
    Transición de estados del mercado de apuestas:
    - 'abierta': Pone la apuesta a disposición de los usuarios y sella `fecha_aprobacion`.
    - 'rechazada': Descarta la sugerencia sin admitir más participación.
    - 'cerrada': Dictamina la opción ganadora y liquida los premios.
    
    Mecánica de liquidación:
    1. Busca todos los tickets que apostaron por `opcion_ganadora_id`.
    2. Calcula `ganancia = ticket.cantidad * multiplicador`.
    3. Invoca `move_tokens` con `auto_commit=False` para aislar los abonos dentro del saldo del grupo de la apuesta.
    4. Realiza un `commit` atómico único al final: si ocurre un fallo no hay pagos parciales inconsistentes.
    """
    result = await db.execute(select(Apuesta).where(Apuesta.id == bet_id))
    bet = result.scalars().first()
    if not bet:
        raise HTTPException(status_code=404, detail="Apuesta no encontrada")
        
    if update_data.estado == "abierta":
        from sqlalchemy.sql import func
        bet.estado = "abierta"
        bet.fecha_aprobacion = func.now()
        await db.commit()
        return {"status": "abierta"}
        
    elif update_data.estado == "rechazada":
        bet.estado = "rechazada"
        await db.commit()
        return {"status": "rechazada"}
        
    elif update_data.estado == "cerrada":
        if not update_data.opcion_ganadora_id:
            raise HTTPException(status_code=400, detail="Debe proveer opcion_ganadora_id")
            
        bet.estado = "cerrada"
        bet.opcion_ganadora_id = update_data.opcion_ganadora_id
        
        # Recuperamos todos los boletos ganadores
        ticket_result = await db.execute(
            select(TicketApuesta).where(
                (TicketApuesta.apuesta_id == bet.id) & 
                (TicketApuesta.opcion_id == update_data.opcion_ganadora_id)
            )
        )
        winning_tickets = ticket_result.scalars().all()
        
        # Obtenemos el multiplicador fijado en la opción ganadora
        multiplier = bet.opciones.get(update_data.opcion_ganadora_id, {}).get("multiplier", 1.0)
        
        for ticket in winning_tickets:
            user_result = await db.execute(select(Usuario).where(Usuario.id == ticket.usuario_id))
            user = user_result.scalars().first()
            if user:
                from app.crud.ledger_crud import move_tokens
                ganancia = int(ticket.cantidad * float(multiplier))
                # Abonamos los tokens con auto_commit=False para mantener atomicidad
                await move_tokens(
                    db=db, 
                    user_id=user.id, 
                    amount=ganancia, 
                    concept=f"Premio de apuesta: {bet.titulo}", 
                    group_id=bet.grupo_id,
                    auto_commit=False
                )
                
        await db.commit()
        return {"status": "cerrada"}
        
    raise HTTPException(status_code=400, detail="Estado no válido")

@router.get("/duels")
async def get_admin_duels(group_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Obtiene los duelos para el tribunal administrativo, filtrados opcionalmente por grupo.
    """
    from sqlalchemy.orm import selectinload
    stmt = select(Duelo).options(selectinload(Duelo.retador), selectinload(Duelo.retado))
    if group_id is not None:
        stmt = stmt.where(Duelo.grupo_id == group_id)
    stmt = stmt.order_by(Duelo.id.desc())
    result = await db.execute(stmt)
    duels = result.scalars().all()
    return [
        {
            "id": d.id,
            "challenger": d.retador.username,
            "challenged": d.retado.username,
            "game": d.juego,
            "wager": d.tokens_en_juego,
            "status": d.estado,
            "winner": d.retador.username if d.ganador_id == d.retador_id else (d.retado.username if d.ganador_id == d.retado_id else None),
            "challenger_avatar": d.retador.avatar_url,
            "challenged_avatar": d.retado.avatar_url,
            "fecha_creacion": d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None,
            "reported_resolution": d.reported_resolution
        }
        for d in duels
    ]

# --------------------------------------------------------------------------
# 6. TRIBUNAL ADMINISTRATIVO DE DUELOS
# --------------------------------------------------------------------------

@router.get("/duels")
async def get_admin_duels(group_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Obtiene los duelos para el panel del Tribunal Administrativo.
    Carga de forma eager los perfiles de retador y retado para no disparar consultas N+1.
    Soporta filtrado opcional por `group_id` para administradores locales.
    """
    from sqlalchemy.orm import selectinload
    stmt = select(Duelo).options(selectinload(Duelo.retador), selectinload(Duelo.retado))
    if group_id is not None:
        stmt = stmt.where(Duelo.grupo_id == group_id)
    stmt = stmt.order_by(Duelo.id.desc())
    result = await db.execute(stmt)
    duels = result.scalars().all()
    return [
        {
            "id": d.id,
            "challenger": d.retador.username,
            "challenged": d.retado.username,
            "game": d.juego,
            "wager": d.tokens_en_juego,
            "status": d.estado,
            "winner": d.retador.username if d.ganador_id == d.retador_id else (d.retado.username if d.ganador_id == d.retado_id else None),
            "challenger_avatar": d.retador.avatar_url,
            "challenged_avatar": d.retado.avatar_url,
            "fecha_creacion": d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None,
            "reported_resolution": d.reported_resolution
        }
        for d in duels
    ]

@router.patch("/duels/{duel_id}/resolve")
async def resolve_duel_admin(duel_id: int, resolve_data: AdminResolveDuelRequest, db: AsyncSession = Depends(get_db)):
    """
    Dicta sentencia inapelable sobre un duelo en conflicto o pendiente de arbitraje.
    
    Casos contemplados:
    A. Victoria limpia ("challenger" o "challenged"):
       El ganador recibe la bolsa total (2 * tokens_en_juego) en su saldo de grupo.
    B. Empate sin sanción ("draw" con penalize="none"):
       Si los tokens estaban bloqueados en Escrow (estado 'accepted' o 'validation_winner'),
       se reembolsa a cada participante su apuesta inicial.
       Si fue rechazado antes de aceptar, se cancela sin transferencias.
    C. Empate con sanción disciplinaria ("draw" con penalize="challenger" o "challenged"):
       Se devuelven las apuestas bloqueadas y se aplica una multa punitiva (retirada de tokens)
       al infractor culpable, acompañada de su notificación justificativa.
    """
    from sqlalchemy.orm import selectinload
    duel = await db.scalar(
        select(Duelo)
        .options(selectinload(Duelo.retador), selectinload(Duelo.retado))
        .where(Duelo.id == duel_id)
    )
    if not duel:
        raise HTTPException(status_code=404, detail="Duelo no encontrado")
    
    if duel.estado in ("completed", "penalized_challenger"):
        raise HTTPException(status_code=400, detail="El duelo ya está resuelto")
    
    from app.crud.ledger_crud import move_tokens
    
    # Determinamos si los tokens fueron efectivamente descontados en la fase de aceptación
    tokens_bloqueados = duel.estado in ("accepted", "validation_winner")
    
    if resolve_data.resolution in ("challenger", "challenged"):
        winner = duel.retador if resolve_data.resolution == "challenger" else duel.retado
        loser = duel.retado if resolve_data.resolution == "challenger" else duel.retador
        ganancia = 2 * duel.tokens_en_juego
        duel.ganador_id = winner.id
        duel.estado = "completed"
        
        # Abonamos el bote acumulado al ganador dentro del grupo correspondiente
        await move_tokens(
            db=db,
            user_id=winner.id,
            amount=ganancia,
            concept=f"Premio doble por duelo: {duel.juego}",
            group_id=duel.grupo_id,
            auto_commit=False
        )
        
        msg_base = f"El Tribunal ha dictado sentencia. @{winner.username} ha vencido a @{loser.username} en el duelo '{duel.juego}' y se lleva un premio de {ganancia} tokens."
        msg_retador = msg_base
        msg_retado = msg_base
        
    elif resolve_data.resolution == "draw":
        if resolve_data.penalize == "challenger":
            duel.estado = "penalized_challenger"
        elif resolve_data.penalize == "challenged":
            duel.estado = "completed"
            duel.reported_resolution = "penalized_challenged"
        else:
            duel.estado = "completed"
            
        if resolve_data.penalize == "none":
            # Sin sanción: reembolso limpio o cancelación
            if not tokens_bloqueados:
                msg_retador = "La solicitud de rechazo ha sido aceptada. El duelo se ha cancelado sin movimientos de tokens."
                msg_retado = "La solicitud de rechazo ha sido aceptada. El duelo se ha cancelado sin movimientos de tokens."
            else:
                await move_tokens(db, duel.retador.id, duel.tokens_en_juego, f"Devolución empate duelo: {duel.juego}", group_id=duel.grupo_id, auto_commit=False)
                await move_tokens(db, duel.retado.id, duel.tokens_en_juego, f"Devolución empate duelo: {duel.juego}", group_id=duel.grupo_id, auto_commit=False)
                msg_retador = f"El Tribunal ha dictado un Empate en el duelo '{duel.juego}' contra {duel.retado.username}. Los {duel.tokens_en_juego} tokens han sido devueltos a vuestras cuentas."
                msg_retado = f"El Tribunal ha dictado un Empate en el duelo '{duel.juego}' contra {duel.retador.username}. Los {duel.tokens_en_juego} tokens han sido devueltos a vuestras cuentas."
        else:
            # Sanción punitiva con multa disciplinaria
            if not resolve_data.motivo_multa:
                raise HTTPException(status_code=400, detail="Debes indicar un motivo de multa")
            if resolve_data.penalize_amount <= 0:
                raise HTTPException(status_code=400, detail="La multa debe ser mayor que 0")
                
            if tokens_bloqueados:
                await move_tokens(db, duel.retador.id, duel.tokens_en_juego, f"Devolución duelo cancelado: {duel.juego}", group_id=duel.grupo_id, auto_commit=False)
                await move_tokens(db, duel.retado.id, duel.tokens_en_juego, f"Devolución duelo cancelado: {duel.juego}", group_id=duel.grupo_id, auto_commit=False)
                
            fined_user = duel.retador if resolve_data.penalize == "challenger" else duel.retado
            # Descuento disciplinario (importe negativo)
            await move_tokens(db, fined_user.id, -resolve_data.penalize_amount, f"Multa Tribunal por duelo: {duel.juego}", group_id=duel.grupo_id, auto_commit=False)
            
            multa_msg = f"El Tribunal te ha multado con {resolve_data.penalize_amount} tokens por: {resolve_data.motivo_multa}"
            msg_innocent = f"El duelo '{duel.juego}' ha sido cancelado porque tu oponente ha sido multado con {resolve_data.penalize_amount} tokens por: {resolve_data.motivo_multa}"
            
            if resolve_data.penalize == "challenger":
                msg_retador = multa_msg
                msg_retado = msg_innocent
            else:
                msg_retador = msg_innocent
                msg_retado = multa_msg
    else:
        raise HTTPException(status_code=400, detail="Resolución inválida")
        
    # Notificaciones oficiales del Tribunal a ambos combatientes
    notif1 = NotificacionAdmin(
        titulo="⚖️ Veredicto del Tribunal",
        mensaje=msg_retador,
        destinatario_tipo="specific",
        destinatario_id=duel.retador_id,
        estado="sent"
    )
    notif2 = NotificacionAdmin(
        titulo="⚖️ Veredicto del Tribunal",
        mensaje=msg_retado,
        destinatario_tipo="specific",
        destinatario_id=duel.retado_id,
        estado="sent"
    )
    db.add(notif1)
    db.add(notif2)
    
    await db.commit()
    return {"message": "Duelo resuelto"}

# --------------------------------------------------------------------------
# 7. TRIBUNAL DE MISIONES Y PRUEBAS
# --------------------------------------------------------------------------

@router.get("/misiones/sugerencias")
async def get_admin_sugerencias(group_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Obtiene el listado de misiones sugeridas por la comunidad pendientes de evaluación.
    Calcula en memoria los upvotes y downvotes agregados por los jugadores.
    """
    from sqlalchemy.orm import joinedload
    from app.models.misiones import VotoMision
    stmt = select(Mision).options(joinedload(Mision.creador)).filter(Mision.estado == "propuesta")
    if group_id is not None:
        stmt = stmt.filter(Mision.grupo_id == group_id)
    stmt = stmt.order_by(Mision.fecha_creacion.desc())
    result = await db.execute(stmt)
    misiones = result.scalars().all()
    
    mision_ids = [m.id for m in misiones]
    
    votos = []
    if mision_ids:
        votos_result = await db.execute(select(VotoMision).filter(VotoMision.mision_id.in_(mision_ids)))
        votos = votos_result.scalars().all()
    
    response_list = []
    for m in misiones:
        m_votos = [v for v in votos if v.mision_id == m.id]
        upvotes = sum(1 for v in m_votos if v.tipo_voto == "up")
        downvotes = sum(1 for v in m_votos if v.tipo_voto == "down")
        
        response_list.append({
            "id": str(m.id),
            "title": m.titulo,
            "description": m.descripcion,
            "reward": m.recompensa,
            "author": m.creador.username if m.creador else str(m.creador_id),
            "upvotes": upvotes,
            "downvotes": downvotes,
            "createdAt": m.fecha_creacion.isoformat() if m.fecha_creacion else None
        })
    return response_list

@router.patch("/misiones/{mision_id}/sugerencia/aprobar")
async def aprobar_sugerencia(mision_id: int, data: AdminAprobarSugerencia, db: AsyncSession = Depends(get_db)):
    """
    Aprueba una sugerencia de misión, fija la recompensa final asignada por el tribunal
    y la promociona a estado 'activa' notificando al usuario creador.
    """
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(Mision).options(selectinload(Mision.creador)).filter(Mision.id == mision_id, Mision.estado == "propuesta"))
    mision = result.scalars().first()
    if not mision:
        raise HTTPException(status_code=404, detail="Sugerencia no encontrada")
        
    mision.estado = "activa"
    mision.recompensa = data.recompensa
    
    notif = NotificacionAdmin(
        titulo="¡Sugerencia Aprobada!",
        mensaje=f"Tu sugerencia '{mision.titulo}' ha sido aprobada por el Tribunal y ya está disponible para que todos la jueguen. ¡Gracias por tu aportación!",
        destinatario_tipo="specific",
        destinatario_id=mision.creador_id,
        estado="sent"
    )
    db.add(notif)
    
    await db.commit()
    return {"message": "Sugerencia aprobada y publicada"}

@router.patch("/misiones/{mision_id}/sugerencia/rechazar")
async def rechazar_sugerencia(mision_id: int, db: AsyncSession = Depends(get_db)):
    """Descarta y elimina de la base de datos una sugerencia de misión no apta."""
    result = await db.execute(select(Mision).filter(Mision.id == mision_id, Mision.estado == "propuesta"))
    mision = result.scalars().first()
    if not mision:
        raise HTTPException(status_code=404, detail="Sugerencia no encontrada")
        
    await db.delete(mision)
    await db.commit()
    return {"message": "Sugerencia eliminada"}

@router.get("/misiones/pruebas")
async def get_admin_pruebas(group_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Obtiene las pruebas gráficas o escritas presentadas por los jugadores
    que están pendientes de validación ('pending'), filtradas opcionalmente por grupo.
    """
    from sqlalchemy.orm import selectinload
    stmt = (
        select(PruebaMision)
        .options(selectinload(PruebaMision.usuario), selectinload(PruebaMision.mision))
        .filter(PruebaMision.estado == "pending")
    )
    if group_id is not None:
        stmt = stmt.join(PruebaMision.mision).filter(Mision.grupo_id == group_id)
    stmt = stmt.order_by(PruebaMision.fecha_creacion.desc())
    result = await db.execute(stmt)
    pruebas = result.scalars().all()
    
    response = []
    for p in pruebas:
        response.append({
            "id": p.id,
            "mision_id": p.mision.id,
            "mision_title": p.mision.titulo,
            "mision_reward": p.mision.recompensa,
            "usuario": p.usuario.username,
            "usuario_avatar": p.usuario.avatar_url,
            "proof_text": p.prueba_texto,
            "proof_image_url": p.prueba_imagen_url,
            "createdAt": p.fecha_creacion.isoformat() if p.fecha_creacion else None
        })
    return response

@router.patch("/misiones/pruebas/{prueba_id}/validar")
async def validar_prueba(prueba_id: int, db: AsyncSession = Depends(get_db)):
    """
    Valida la prueba de una misión, acreditando la recompensa en el saldo del grupo correspondiente
    mediante el motor de doble partida del Ledger (`move_tokens`), notificando al jugador.
    """
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(PruebaMision)
        .options(selectinload(PruebaMision.usuario), selectinload(PruebaMision.mision))
        .filter(PruebaMision.id == prueba_id, PruebaMision.estado == "pending")
    )
    prueba = result.scalars().first()
    if not prueba:
        raise HTTPException(status_code=404, detail="Prueba no encontrada o ya procesada")
        
    prueba.estado = "approved"
    
    usuario = prueba.usuario
    mision = prueba.mision

    # Abonar recompensa al saldo del grupo de la misión mediante move_tokens
    from app.crud.ledger_crud import move_tokens
    await move_tokens(
        db=db,
        user_id=usuario.id,
        amount=mision.recompensa,
        concept=f"Misión completada: {mision.titulo}",
        group_id=mision.grupo_id,
        auto_commit=False
    )
    
    notif = NotificacionAdmin(
        titulo="✅ Misión Validada",
        mensaje=f"El Tribunal ha validado tu prueba para '{mision.titulo}'. Se han añadido 💰 {mision.recompensa} a tu cuenta.",
        destinatario_tipo="specific",
        destinatario_id=usuario.id,
        estado="sent"
    )
    db.add(notif)
    
    await db.commit()
    return {"message": "Prueba validada correctamente"}

@router.patch("/misiones/pruebas/{prueba_id}/rechazar")
async def rechazar_prueba(prueba_id: int, data: AdminRechazarPrueba, db: AsyncSession = Depends(get_db)):
    """
    Rechaza una prueba aportada por un usuario especificando el motivo pedagógico
    para que el jugador comprenda por qué su prueba no cumplió los requisitos.
    """
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(PruebaMision)
        .options(selectinload(PruebaMision.usuario), selectinload(PruebaMision.mision))
        .filter(PruebaMision.id == prueba_id, PruebaMision.estado == "pending")
    )
    prueba = result.scalars().first()
    if not prueba:
        raise HTTPException(status_code=404, detail="Prueba no encontrada o ya procesada")
        
    prueba.estado = "rejected"
    
    notif = NotificacionAdmin(
        titulo="❌ Prueba Rechazada",
        mensaje=f"El Tribunal ha rechazado tu prueba para '{prueba.mision.titulo}'. Motivo: {data.motivo}",
        destinatario_tipo="specific",
        destinatario_id=prueba.usuario.id,
        estado="sent"
    )
    db.add(notif)
    
    await db.commit()
    return {"message": "Prueba rechazada"}
