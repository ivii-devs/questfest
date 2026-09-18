# Workflow: Ciclo de Vida de Funcionalidades (Feature Lifecycle)

Este workflow define el procedimiento estándar y secuencial que el **Agente Único** ejecuta para concebir, implementar, validar, documentar y preparar la entrega de cualquier funcionalidad en QuestFest.

---

## 1. Diagrama de Flujo del Ciclo de Vida

```
[1. Análisis y Alcance Técnico]
               │
               ▼
[2. Implementación Multicapa con Comentarios Humanizados]
   (Backend / Frontend PWA / Modelos y Esquemas)
               │
               ▼
[3. Quality Gate y Auditoría de Seguridad]
   (Pruebas pytest/npm + Verificación OWASP & Ledger)
               ├──> [Defectos detectados] ──> (Retorna a fase 2 para corrección)
               │
               └──> [Validación Conforme]
                       │
                       ▼
[4. Sincronización del Vault de Obsidian]
                       │
                       ▼
[5. Solicitud de Aprobación para Git]
```

---

## 2. Procedimiento Paso a Paso

- [ ] **Fase 1: Análisis y Alcance Técnico**
  - Examina los requerimientos del usuario y determina los componentes afectados (backend, frontend, base de datos, configuración).
  - Consulta las fuentes vivas de la verdad técnica ([context/architecture.md](../context/architecture.md)).
  - Diseña el enfoque asegurando el desacoplamiento cliente-servidor y la invarianza de reglas de negocio.

- [ ] **Fase 2: Implementación con Comentarios Humanizados**
  - Desarrolla el código necesario manteniendo tipado estricto en Python y TypeScript.
  - Incluye obligatoriamente comentarios explicativos en español estilo Pair Programming justificando el "por qué", las reglas de negocio y los posibles compromisos técnicos ([context/conventions.md](../context/conventions.md)).
  - Si afecta a la interfaz de usuario, aplica rigurosamente los estándares PWA: enfoque Mobile-First, target táctil $\ge 48\times 48\text{ px}$, safe-area-inset y degradación offline ([context/pwa-standards.md](../context/pwa-standards.md)).

- [ ] **Fase 3: Quality Gate y Auditoría de Seguridad (Zero-Trust)**
  - Ejecuta validaciones de compilación y tipado (`npm run lint`, `npm run build` en frontend).
  - Diseña y corre la suite de pruebas automatizadas en backend (`pytest tests/ -v`).
  - Audita el cumplimiento de seguridad ([context/security.md](../context/security.md)):
    - Consultas SQLAlchemy parametrizadas (sin inyección SQL).
    - Protección y validación de endpoints y DTOs con Pydantic v2.
    - Cero fugas contables: verificar que todo movimiento de QuestCoins esté respaldado atómicamente en `LedgerTransaccion`.
    - Bloqueos pesimistas (`.with_for_update()`) en operaciones concurrentes para prevenir condiciones de carrera.
    - Soberanía absoluta del backend en azar y recompensas.
  - **Criterio de Aprobación**: Si algún test falla o se detecta una vulnerabilidad, se corrigen los defectos en Fase 2 antes de avanzar.

- [ ] **Fase 4: Sincronización con el Vault de Obsidian**
  - Ejecuta el procedimiento determinista estipulado en [workflows/sync-vault.md](sync-vault.md).
  - Actualiza o crea las notas pertinentes en `obsidian_vault/` bajo las reglas inmutables (sin emojis, tono impersonal, doble explicación técnica + analogía, enlaces `vscode://`).

- [ ] **Fase 5: Solicitud de Aprobación para Git**
  - Inspecciona el árbol de trabajo mediante comandos de solo lectura (`git status`, `git diff --stat`).
  - Redacta una propuesta de mensaje de commit simple, en español y con lenguaje accesible y no excesivamente técnico.
  - Presenta el resumen al usuario y solicita autorización previa según [workflows/git-approval-flow.md](git-approval-flow.md).
