# Contexto Técnico: Directivas de Seguridad, Auditoría Zero-Trust y Ledger Inmutable

## 1. Filosofía de Seguridad y Modelo Zero-Trust

- **Desconfianza por Defecto**: Todo payload, parámetro, cabecera o dato proveniente del cliente o de servicios externos se considera potencialmente malicioso hasta ser validado exhaustivamente.
- **Tipado y Validación Estricta**:
  - En backend, valida cada entrada y salida mediante esquemas Pydantic v2 (`app/schemas/`). Prohíbese procesar diccionarios sin tipar o datos crudos de peticiones HTTP.
  - En frontend, mantén tipado estricto en TypeScript (`strict: true`) sin recurrir a tipos `any`.
- **Mitigación OWASP Top 10**:
  - **Inyecciones SQL**: Emplea exclusivamente el ORM SQLAlchemy 2.0 con consultas parametrizadas asíncronas (`select()`, `update()`). Prohíbese construir sentencias SQL concatenando cadenas de texto.
  - **Autenticación y Autorización**:
    - Protege endpoints mediante verificación de tokens JWT y dependencias de seguridad de FastAPI (`get_current_user`).
    - Emite y valida refresh tokens almacenados en cookies `HttpOnly`, `Secure` y con directiva `SameSite`.
  - **Protección contra Abuso y Fuerza Bruta**:
    - Aplica limitación de tasa (*rate limiting*) mediante Redis (`slowapi`) en endpoints sensibles: autenticación, tiradas de ruleta, creación de duelos y transacciones.
  - **XSS y Sanitización**:
    - Escapa y valida cualquier texto introducido por usuarios antes de persistirlo o presentarlo en la interfaz de la PWA.

---

## 2. Invarianza Contable y Dominio de Gamificación (Ledger Inmutable)

> [!CAUTION]
> **CERO FUGAS CONTABLES EN QUESTCOINS**:
> El saldo de los usuarios y las transacciones de juego constituyen el activo crítico del sistema. Cualquier inconsistencia o condición de carrera en este ámbito compromete la integridad global de la aplicación.

### Reglas Inmutables del Ledger:
1. **Atomicidad Absoluta**:
   - Todo movimiento de saldo (ingreso, débito, retención, transferencia o premio) debe persistirse de forma atómica junto con una entrada en `LedgerTransaccion`.
   - **PROHIBIDO** actualizar balances de usuarios de forma directa sin generar su correspondiente asiento contable auditable.
2. **Prevención de Condiciones de Carrera (Race Conditions & Double-Spending)**:
   - Emplea bloqueos pesimistas en base de datos (`SELECT ... FOR UPDATE` mediante `.with_for_update()`) en la sesión SQLAlchemy al verificar y debitar saldo de usuarios en operaciones concurrentes (ej. aceptar duelos, emitir tickets de apuestas, compras en tienda).
   - Verifica la disponibilidad efectiva de saldo suficiente antes de ejecutar cualquier retención o cobro.
3. **Escrow y Congelamiento Temporal en Duelos**:
   - Al aceptar un duelo PvP, congela inmediatamente los QuestCoins de ambos participantes para impedir que se utilicen simultáneamente en otras actividades durante el encuentro.
   - En caso de cancelación o expiración, restituye los fondos de forma atómica e idempotente.
4. **Soberanía Absoluta del Backend**:
   - **PROHIBIDO** permitir que el cliente frontend calcule, determine o sugiera resultados de juegos de azar (ruleta), cálculos de probabilidades, liquidaciones o validaciones de misiones.
   - La aleatoriedad (RNG) y la validación de premios se ejecutan única y exclusivamente en el motor de backend.

---

## 3. Protección de Secretos, Credenciales y Variables de Entorno

- **Aislamiento de Secretos**:
  - **PROHIBIDO** versionar o escribir en duro contraseñas, claves privadas VAPID, secretos JWT (`SECRET_KEY`) o cadenas de conexión a base de datos.
  - Toda configuración sensible debe consumirse a través de variables de entorno administradas con Pydantic `BaseSettings` (`backend/app/core/config.py`).
- **Seguridad en Frontend**:
  - En la aplicación Next.js, ninguna variable privada del backend debe ser importada o inyectada en el bundle del navegador.
  - Emplea exclusivamente el prefijo `NEXT_PUBLIC_` para valores estrictamente públicos (como la clave pública VAPID o la URL pública de la API).
