# Contexto Técnico: Glosario de Dominio y Reglas de Negocio

## 1. Nomenclatura Oficial Inmutable

- **Nombre de la Plataforma**: **QuestFest**. **PROHIBIDO** emplear denominaciones antiguas (como *Fiestas26*).
- **Token Oficial del Sistema**: **QuestCoins**. Denominación exclusiva para el saldo y transacciones de puntos.

---

## 2. Entidades Principales del Dominio

| Modelo ORM | Tabla | Función en el Sistema |
| :--- | :--- | :--- |
| **`Usuario`** | `usuarios` | Participante o administrador. Contiene balance de QuestCoins, rol y perfil. |
| **`LedgerTransaccion`** | `ledger_transacciones` | Registro contable inmutable de todo movimiento de QuestCoins. |
| **`Mision`** | `misiones` | Desafío o reto con recompensa en QuestCoins y criterios de validación. |
| **`PruebaMision`** | `pruebas_misiones` | Evidencia multimedia o textual enviada por un usuario para superar una misión. |
| **`Duelo`** | `duelos` | Enfrentamiento PvP directo entre dos usuarios con apuesta de QuestCoins. |
| **`Apuesta`** | `apuestas` | Evento o pronóstico colectivo con pozo de QuestCoins. |
| **`TicketApuesta`** | `tickets_apuestas` | Boleto individual de apuesta emitido por un usuario. |
| **`RegistroRuleta`** | `registros_ruleta` | Registro auditable de tiradas y premios de la ruleta diaria. |
| **`Publicacion`** | `publicaciones` | Publicación en el muro social del evento para interacción comunitaria. |
| **`PushSubscription`** | `push_subscriptions` | Credenciales de suscripción VAPID para entrega de notificaciones WebPush. |
| **`AuditLog`** | `audit_logs` | Pista de auditoría de eventos de seguridad y acciones administrativas. |

---

## 3. Reglas Invariantes del Negocio de Gamificación

1. **Inmutabilidad del Ledger Contable**:
   - Respalda cada variación de saldo mediante una fila en `LedgerTransaccion`.
   - **PROHIBIDO** actualizar balances mediante sentencias directas de base de datos sin generar la transacción contable asociada.
2. **Congelamiento Temporal en Duelos (Escrow PvP)**:
   - Bloquea inmediatamente los QuestCoins de ambos contendientes al aceptar el reto para evitar doble gasto durante la partida.
   - Reintegra el saldo bloqueado si el duelo expira o se cancela.
3. **Liquidación de Apuestas**:
   - Reintegra los QuestCoins únicamente si el evento resulta cancelado por la administración.
   - En resolución estándar, distribuye el pozo entre los acertantes descontando las comisiones aplicables.
4. **Cálculo de Ruleta en Servidor**:
   - Determina el premio y la aleatoriedad de la ruleta estrictamente en el backend dentro de una transacción protegida; prohíbese confiar en valores calculados por el cliente.
