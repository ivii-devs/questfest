# Manual de Documentación Técnica - Proyecto QuestFest

Bienvenido al catálogo central de documentación de **QuestFest**. Este Vault de Obsidian constituye un manual técnico y funcional completo de la plataforma, detallando el comportamiento del sistema, sus flujos de datos, la estructura de código fuente y los fundamentos teóricos de ingeniería de software sobre los que está construido.

---

## Estructura Jerárquica del Sistema (Mapas de Contenido - MOC)

La documentación se organiza de forma modular mediante **Mapas de Contenido (MOC)** para cada subsistema del proyecto:

### 00. Normativa y Estándares
- [[00 - Estándares y Reglas del Vault]] — Normas de redacción técnica, principios de claridad, directivas de enlaces a código fuente y mantenimiento del Vault.

### 01. Visión General y Arquitectura
- [[01.0 - Indice y Mapa de Vision General]] — Catálogo del concepto de aplicación, modelo de gamificación con QuestCoins, topología de red local y arquitectura multi-inquilino con aislamiento por grupos.

### 02. El Motor del Juego (Backend FastAPI)
- [[02.0 - Indice y Mapa de El Motor Backend]] — Catálogo de servicios backend: autenticación JWT, misiones con Cloudinary, apuestas y ruleta en JSONB, muro social recursivo, SSE en tiempo real, rate limiting, WebPush VAPID y modelo relacional completo.

### 03. La Interfaz de Usuario (Frontend Next.js)
- [[03.0 - Indice y Mapa de La Interfaz Frontend]] — Catálogo de la aplicación cliente en Next.js 16: pantallas, zona de juego en vivo Dracula, panel de administración "Modo Dios", componentes modulares y arquitectura PWA con soporte offline.

### 04. Flujos del Juego (Historias de Usuario)
- [[04.0 - Indice y Mapa de Flujos del Juego]] — Catálogo de diagramas de secuencia e interacciones de negocio: flujo de validación comunitaria de misiones y flujo transaccional de depósitos de garantía en duelos 1vs1.

### 05. Guías Prácticas y Operaciones
- [[05.0 - Indice y Mapa de Guias Practicas]] — Procedimientos operativos estándar: manual de encendido en desarrollo local, suite de pruebas automatizadas con Pytest y despliegue en producción con NGINX y pipelines CI-CD.

### 06. Conceptos Teóricos y Fundamentos de Ingeniería
- [[06.0 - Indice y Mapa de Conceptos Teoricos]] — Compendio enciclopédico de fundamentos: APIs REST, asincronía, CORS, OpenAPI, JWT, Bcrypt, RBAC, SQLAlchemy ORM, Alembic, JSONB, transacciones ACID, SSR vs CSR, React Context, Edge Middleware, Docker, CDN, PWA, Leaky Bucket, cookies HttpOnly, SSE vs WebSockets, paginación por cursor, VAPID, auditoría, testing de integración, CI-CD, multi-tenancy, patrones GoF y agrupamiento de conexiones.

### 07. Arquitectura y Patrones de Software
- [[07.0 - Indice y Mapa de Patrones Software]] — Catálogo integral, taxonomía y matriz de patrones software: patrones creacionales, estructurales, de comportamiento, arquitectónicos (Clean Architecture, Ledger, Multi-Tenancy) e inversión de control.

---

## Ficheros Físicos del Código Fuente
- Configuración de orquestación de contenedores: [backend/docker-compose.yml](vscode://file/c:/.d/fiestas26-project/backend/docker-compose.yml:1)
- Punto de entrada y controladores de la API: [backend/app/main.py](vscode://file/c:/.d/fiestas26-project/backend/app/main.py:1)
- Bus de eventos asíncrono en memoria: [backend/app/core/events.py](vscode://file/c:/.d/fiestas26-project/backend/app/core/events.py:1)
- Motor económico y fachada de transacciones: [backend/app/crud/ledger_crud.py](vscode://file/c:/.d/fiestas26-project/backend/app/crud/ledger_crud.py:1)
- Punto de entrada de la aplicación de usuario: [frontend/src/app/layout.tsx](vscode://file/c:/.d/fiestas26-project/frontend/src/app/layout.tsx:1)
- Proxy perimetral de enrutamiento Edge: [frontend/src/proxy.ts](vscode://file/c:/.d/fiestas26-project/frontend/src/proxy.ts:1)
- Modelos de datos multi-grupo: [backend/app/models/grupo.py](vscode://file/c:/.d/fiestas26-project/backend/app/models/grupo.py:1)
- Proveedor de contexto multi-grupo: [frontend/src/context/GroupContext.tsx](vscode://file/c:/.d/fiestas26-project/frontend/src/context/GroupContext.tsx:1)
- Hub de bienvenida y gestión comunitaria: [frontend/src/app/groups/page.tsx](vscode://file/c:/.d/fiestas26-project/frontend/src/app/groups/page.tsx:1)
- Manifiesto de dependencias del cliente: [frontend/package.json](vscode://file/c:/.d/fiestas26-project/frontend/package.json:1)
- Manifiesto PWA y Service Worker: [frontend/public/manifest.json](vscode://file/c:/.d/fiestas26-project/frontend/public/manifest.json:1)
- Fixtures de testing y base de datos SQLite en memoria: [backend/tests/conftest.py](vscode://file/c:/.d/fiestas26-project/backend/tests/conftest.py:1)
- Pipeline de integración continua GitHub Actions: [.github/workflows/ci.yml](vscode://file/c:/.d/fiestas26-project/.github/workflows/ci.yml:1)
- Docker Compose de producción: [docker-compose.prod.yml](vscode://file/c:/.d/fiestas26-project/docker-compose.prod.yml:1)

---

> Nota de uso en Obsidian: La vista de grafo (Ctrl + G o Cmd + G en macOS) muestra ahora la estructura jerárquica canónica organizada en 7 constelaciones de MOCs alrededor del Índice General.
