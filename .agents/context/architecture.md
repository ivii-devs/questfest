# Contexto Técnico: Arquitectura y Topología del Sistema

## 1. Topología del Sistema y Entornos de Ejecución

QuestFest opera bajo dos modalidades de infraestructura arquitectónica:

### Modalidad A: Contenedores Persistentes (Local y VPS)
```
[ Frontend PWA (Next.js 16 / React 19) ]
                 ▲
                 │ (HTTP REST / JSON / SSE / WebPush)
                 ▼
[ NGINX Reverse Proxy (:80 / :443) ]
        │                       │
        ▼                       ▼
[ Next.js (:3000) ]     [ FastAPI Backend (:8000) ]
                                │                   │
                                ▼                   ▼
                      [ PostgreSQL / QueuePool ]  [ Redis / Rate Limiting ]
```
- **Persistencia**: Uvicorn y PostgreSQL permanentes.
- **Canal en Vivo**: Server-Sent Events (SSE) unidireccional vía `/api/feed/stream` con colas en memoria (`EventBroadcaster`).
- **Conexiones DB**: `QueuePool` persistente con `pool_pre_ping=True` y reciclaje cada 1800 segundos.

### Modalidad B: Serverless Perimetral con Vercel Services (Vercel + Supabase)
```
[ Frontend PWA (Next.js 16) ] ── (Rutas Relativas '') ──► [ Vercel Edge Router ]
                                                                   │
                         ┌─────────────────────────────────────────┴────────────────────────┐
                         ▼ (Ruta /(.*) -> servicio 'web')                                   ▼ (Ruta /api/(.*) -> servicio 'api')
          [ Next.js Serverless (frontend/) ]                                 [ FastAPI Lambda (backend/main.py) ]
                                                                                            │
                                                                                            ▼ (NullPool / asyncpg)
                                                                             [ Supabase Transaction Pooler (:6543) ]
                                                                                            │
                                                                                            ▼
                                                                             [ PostgreSQL Supabase ]
```
- **Monorepo en Vercel con Vercel Services**: Root Directory configurado en `./` con `vercel.json` declarando los servicios `web` (`frontend/`) y `api` (`backend/`).
- **Desacoplamiento Estricto**: `frontend/` y `backend/` mantienen sus dependencias de forma completamente autónoma e independiente (`package.json` y `requirements.txt`).
- **Backend Serverless**: Despachado por `backend/main.py`, expuesto automáticamente hacia `/api/*`.
- **Base de Datos Remota**: Supabase PostgreSQL conectado al Transaction Pooler (puerto `6543`). Obligatorio `NullPool` y `statement_cache_size: 0`.
- **Canal en Vivo**: Sondeo Inteligente (*Smart Polling*) con Page Visibility API, suspensión por inactividad de 2 minutos y revalidación al enfoque en `useFeedStream.ts`.

---

## 2. Fuentes Vivas de la Verdad Técnica

Consulta los siguientes archivos antes de realizar asunciones sobre dependencias, esquemas o rutas:

| Dimensión Técnica | Ubicación Relativa de la Fuente de la Verdad |
| :--- | :--- |
| **Stack y Dependencias Frontend** | [frontend/package.json](../../frontend/package.json) |
| **Configuración de Next.js** | [frontend/next.config.ts](../../frontend/next.config.ts) |
| **Punto de Entrada Serverless API** | [backend/main.py](../../backend/main.py) |
| **Definición de Servicios Vercel** | [vercel.json](../../vercel.json) |
| **Dependencias del Backend** | [backend/requirements.txt](../../backend/requirements.txt) |
| **Contenedores y Servicios Docker** | [docker-compose.yml](../../docker-compose.yml) y [docker-compose.prod.yml](../../docker-compose.prod.yml) |
| **Proxy Inverso NGINX** | [nginx.conf](../../nginx.conf) |
| **Motor de BD y Pools de Conexión** | [backend/app/core/database.py](../../backend/app/core/database.py) |
| **Modelos de Datos Relacionales (ORM)** | Directorio [backend/app/models/](../../backend/app/models/) |
| **Esquemas de Entrada/Salida (DTOs)** | Directorio [backend/app/schemas/](../../backend/app/schemas/) |
| **Endpoints y Controladores** | [backend/app/api/](../../backend/app/api/) o [backend/app/routers/](../../backend/app/routers/) |

---

## 3. Directivas Imperativas para Despliegues y Mantenimiento

1. **Arquitectura Vercel Services**:
   - Mantén la definición de servicios desacoplados en `vercel.json`. **PROHIBIDO** duplicar archivos de backend en `frontend/` o viceversa.
2. **Empaquetado Next.js en Vercel**:
   - **PROHIBIDO** forzar `output: 'standalone'` en Vercel. Debe mantenerse `process.env.VERCEL ? undefined : 'standalone'`.
3. **Gestión de Base de Datos en Serverless**:
   - En entornos Serverless (`VERCEL=1`), **nunca instancies pools de conexiones persistentes (`QueuePool`)**. Usa siempre `NullPool`.
   - Al conectar al Transaction Pooler de Supabase (puerto 6543), **mantén siempre `connect_args={"statement_cache_size": 0}`** en asyncpg para evitar fallos de sentencias preparadas.
4. **Comunicación Cliente-Servidor en Producción**:
   - En frontend (`frontend/src/lib/axios.ts`), el cliente en producción en Vercel debe usar `baseURL: ""` (rutas relativas). No inyectes URLs absolutas con puertos locales.
5. **Transmisión de Eventos en Vivo**:
   - **PROHIBIDO** asumir que SSE `/api/feed/stream` funcionará en Vercel Serverless. La lógica reactiva del cliente debe apoyarse en el hook de Sondeo Inteligente (`useFeedStream.ts`) y el gesto `PullToRefresh`.

---

## 4. Principios de Desacoplamiento

- **Aislamiento de Capas**: Prohíbese importar lógica interna del backend o conectar a la base de datos desde el frontend.
- **Contratos REST**: Ejecuta toda comunicación cliente-servidor mediante endpoints REST tipados y autenticados vía cabecera `Authorization: Bearer <token>`.
- **Variables de Entorno Públicas**: Prefija estrictamente las variables de entorno de frontend con `NEXT_PUBLIC_`.
