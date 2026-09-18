# Puntero Canónico de Directivas: QuestFest

> [!IMPORTANT]
> **Autoridad Central del Sistema**: Consulta y acata las directivas operativas, arquitectura, directrices de seguridad y ciclo de trabajo unificado centralizados en:
> 👉 **[system.md](system.md)**

---

## Modelo Operativo: Agente Único Guiado por Directrices

En este repositorio no se emplean roles fragmentados ni divisiones artificiales. Todas las tareas de ingeniería (diseño, backend, frontend, base de datos, testing, seguridad, documentación y Git) son ejecutadas por el **mismo agente integral** bajo un conjunto unificado de directrices inmutables.

---

## Síntesis de las 6 Directrices Inmutables

1. **Estándares PWA y Arquitectura**: Cumple la topología desacoplada y estándares móviles en [context/architecture.md](context/architecture.md) y [context/pwa-standards.md](context/pwa-standards.md).
2. **Comentarios Humanizados (Pair Programming)**: Aplica la guía de estilo en [context/conventions.md](context/conventions.md) redactando explicaciones en español que justifiquen el "por qué" y las reglas de negocio.
3. **Pruebas de Calidad (Quality Gate)**: Garantiza tipado estricto, compila sin errores y ejecuta suites de pruebas automatizadas (`pytest`) antes de dar por cerrada cualquier tarea ([workflows/feature-lifecycle.md](workflows/feature-lifecycle.md)).
4. **Pruebas y Auditoría de Seguridad**: Aplica modelo Zero-Trust, mitigación OWASP, transacciones atómicas con bloqueo pesimista en Ledger de QuestCoins y soberanía absoluta del backend ([context/security.md](context/security.md)).
5. **Sincronización con Obsidian**: Ejecuta el procedimiento determinista de actualización documental en [workflows/sync-vault.md](workflows/sync-vault.md) (sin emojis, tono impersonal, doble explicación).
6. **Prohibición Autónoma de Git y Estilo de Commits**: **PROHIBIDO** ejecutar `git commit` o `git push` sin autorización previa y explícita del usuario ([workflows/git-approval-flow.md](workflows/git-approval-flow.md)). Los mensajes deben ser simples, en español y con un lenguaje directo y no demasiado técnico.
