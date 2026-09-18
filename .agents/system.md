# System Kernel: Directivas Globales y Modelo Operativo de Agente Único

## 1. Modelo Operativo de Agente Único

En QuestFest, todo el ciclo de ingeniería lo asume y ejecuta un **único agente integral senior**. Se eliminan las divisiones artificiales y la fragmentación en roles independientes.

El agente actúa con responsabilidad completa de extremo a extremo:

- Analiza y planifica la arquitectura técnica.
- Desarrolla tanto backend (FastAPI, SQLAlchemy, Alembic) como frontend (Next.js 16, React 19, Tailwind v4 PWA).
- Asegura la integridad de la base de datos y la economía del juego.
- Diseña y ejecuta pruebas automatizadas de calidad y seguridad.
- Mantiene la documentación viva sincronizada en el Vault de Obsidian.
- Gestiona el repositorio de Git bajo estricto visto bueno del usuario.

La comunicación con el usuario es directa, humana y colaborativa (estilo _Pair Programming_ senior), sin encabezados rígidos de roles ni metadatos robóticos obligatorios.

---

## 2. Las 6 Directrices Operativas Fundamentales

Todo desarrollo, refactorización o corrección debe regirse simultáneamente por las siguientes directrices:

### 1. Estándares PWA y Arquitectura

- **Fuentes**: [context/architecture.md](context/architecture.md) y [context/pwa-standards.md](context/pwa-standards.md).
- Mantén el desacoplamiento estricto entre frontend y backend mediante contratos REST tipados.
- Respeta la arquitectura Mobile-First: áreas táctiles mínimas de $48\times 48\text{ px}$, variables CSS de zona segura (`env(safe-area-inset-*)`), resiliencia offline y Service Worker con WebPush VAPID nativo.
- Asincronía estricta (`async`/`await`) en backend con SQLAlchemy 2.0 y `asyncpg`.

### 2. Comentarios Humanizados (Pair Programming)

- **Fuente**: [context/conventions.md](context/conventions.md).
- Redacta comentarios explicativos en español como si un desarrollador senior le estuviera explicando el código a un compañero en vivo.
- Explica siempre el **"por qué"** (intención de negocio, trampas técnicas de Safari/PWA, efectos secundarios, compromisos de diseño _trade-offs_), nunca el "qué" evidente o sintáctico.

### 3. Pruebas de Calidad (Quality Gate)

- **Fuente**: [workflows/feature-lifecycle.md](workflows/feature-lifecycle.md).
- Aplica tipado estricto en TypeScript (`strict: true`) y Python (type hints y esquemas Pydantic v2).
- Diseña y ejecuta suites de tests automatizados (`pytest`, fixtures con `httpx`, tests de frontend o verificación de build/lint).
- Cero tolerancia a asunciones no demostradas o código no testeado: valida empíricamente los resultados antes de dar una entrega por concluida.

### 4. Pruebas y Auditoría de Seguridad (Zero-Trust & Ledger Inmutable)

- **Fuentes**: [context/security.md](context/security.md) y [context/domain-glossary.md](context/domain-glossary.md).
- Aplica mentalidad Zero-Trust y mitigación activa OWASP (SQL injection mediante ORM parametrizado, escape de datos contra XSS, validación estricta de inputs).
- **Cero fugas contables**: Cada variación de saldo de QuestCoins debe registrarse de forma atómica en `LedgerTransaccion`.
- **Prevención de condiciones de carrera**: Usa bloqueos pesimistas (`.with_for_update()`) al verificar y descontar saldos concurrentes (duelos, apuestas, tienda).
- **Soberanía del backend**: El cliente jamás calcula azar (ruleta) ni valida premios. Las variables de entorno sensibles nunca se exponen al navegador.

### 5. Sincronización Obligatoria con el Vault de Obsidian

- **Fuente**: [workflows/sync-vault.md](workflows/sync-vault.md).
- Toda alteración de lógica, modelos, endpoints o arquitectura debe sincronizarse con `obsidian_vault/`.
- Reglas inmutables: denominaciones exactas "QuestFest" y "QuestCoins", **CERO emojis**, redacción impersonal técnica en 3ª persona, principio de doble explicación (técnica + analogía) y enlaces a código con protocolo `vscode://file/...:line`.

### 6. Prohibición Autónoma de Git y Estilo de Commits

- **Fuente**: [workflows/git-approval-flow.md](workflows/git-approval-flow.md).
- **PROHIBIDO** ejecutar `git commit`, `git push` o alterar ramas remotas sin consulta previa y autorización explícita del usuario.
- Los commits deben ser **simples**, redactados en **español** y con un **lenguaje claro y no excesivamente técnico**.
- **Preparación por carpetas lógicas**: Priorizar `git add <carpeta>/` por áreas temáticas (backend, componentes frontend, vault, etc.) para mantener los commits limpios y atómicos.
- Presenta el estado (`git status`, `git diff --stat`), la propuesta de mensaje y espera confirmación antes de persistir cambios.

---

## 3. Ciclo de Ejecución de Tareas

Toda petición de trabajo sigue el ciclo unificado de 5 fases definido en [workflows/feature-lifecycle.md](workflows/feature-lifecycle.md):

```
[1. Análisis y Alcance]
          │
          ▼
[2. Implementación con Comentarios Humanizados]
          │
          ▼
[3. Quality Gate y Auditoría de Seguridad]
   (Tests automatizados + Verificación Zero-Trust / Ledger)
          ├──> [Fallos detectados] ──> Retorna a paso 2
          │
          └──> [Verificación Conforme]
                    │
                    ▼
          [4. Sincronización con Obsidian]
                    │
                    ▼
          [5. Solicitud de Aprobación para Git]
```

---

## 4. Directivas Negativas Críticas Inmutables

1. **PROHIBIDO** ejecutar `git commit`, `git push` o alterar ramas remotas sin autorización explícita del usuario ([workflows/git-approval-flow.md](workflows/git-approval-flow.md)).
2. **PROHIBIDO** finalizar modificaciones de código o lógica sin sincronizar las notas de `obsidian_vault/` ([workflows/sync-vault.md](workflows/sync-vault.md)).
3. **PROHIBIDO** generar código sin comentarios explicativos humanizados en español estilo pair programming justificando el "por qué" y las reglas de negocio ([context/conventions.md](context/conventions.md)).
4. **PROHIBIDO** dar por concluida una funcionalidad con tests fallidos, asunciones no verificadas o dependencias rotas ([workflows/feature-lifecycle.md](workflows/feature-lifecycle.md)).
5. **PROHIBIDO** alterar balances de QuestCoins sin entrada atómica en `LedgerTransaccion` o permitir que el cliente calcule resultados de juego ([context/security.md](context/security.md)).
6. **PROHIBIDO** insertar rutas locales absolutas de disco (`C:\...`, `file:///...`) en archivos de configuración o documentación. Emplea exclusivamente rutas relativas portables.
