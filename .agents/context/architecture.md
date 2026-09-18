# Contexto Técnico: Arquitectura y Topología del Sistema

## 1. Topología del Sistema

```
[ Frontend PWA (Next.js 16 / React 19) ]
                 ▲
                 │ (HTTP REST / JSON / WebPush)
                 ▼
[ Backend API (FastAPI / Python 3.12+) ]
         │                   │
         ▼                   ▼
[ PostgreSQL / SQLAlchemy ]  [ Redis / Rate Limiting ]
```

- **Frontend PWA**: Interfaz progresiva, orientada a móviles y desacoplada del motor de backend.
- **Backend API**: API REST asíncrona encargada de la lógica de negocio, persistencia relacional, control de estado y autenticación JWT.
- **Servicios Auxiliares**: 
  - Redis para limitación de tasa (*rate limiting* con `slowapi`).
  - Cloudinary para almacenamiento y optimización de activos multimedia.
  - WebPush para entrega de notificaciones en tiempo real al Service Worker.
- **Segundo Cerebro**: Vault de Obsidian en `obsidian_vault/` que documenta la totalidad del sistema.

---

## 2. Fuentes Vivas de la Verdad Técnica

Consulta los siguientes archivos antes de realizar asunciones sobre dependencias, esquemas o rutas:

| Dimensión Técnica | Ubicación Relativa de la Fuente de la Verdad |
| :--- | :--- |
| **Stack y Dependencias Frontend** | [frontend/package.json](../../frontend/package.json) |
| **Configuración de Next.js** | [frontend/next.config.ts](../../frontend/next.config.ts) |
| **Stack y Dependencias Backend** | [backend/requirements.txt](../../backend/requirements.txt) |
| **Contenedores y Servicios** | [docker-compose.yml](../../docker-compose.yml) y [docker-compose.prod.yml](../../docker-compose.prod.yml) |
| **Proxy Inverso y Rutas de Red** | [nginx.conf](../../nginx.conf) |
| **Modelos de Datos Relacionales (ORM)** | Directorio [backend/app/models/](../../backend/app/models/) |
| **Esquemas de Entrada/Salida (DTOs)** | Directorio [backend/app/schemas/](../../backend/app/schemas/) |
| **Endpoints y Controladores** | [backend/app/api/](../../backend/app/api/) o [backend/app/routers/](../../backend/app/routers/) |

---

## 3. Principios de Desacoplamiento

- **Aislamiento de Capas**: Prohíbese importar lógica interna del backend o conectar a la base de datos desde el frontend.
- **Contratos REST**: Ejecuta toda comunicación cliente-servidor mediante endpoints REST tipados y autenticados vía cabecera `Authorization: Bearer <token>`.
- **Variables de Entorno Públicas**: Prefija estrictamente las variables de entorno de frontend con `NEXT_PUBLIC_`.
