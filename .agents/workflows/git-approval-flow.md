# Workflow: Protocolo de Autorización Estricta para Git y GitHub

## 1. Directiva Negativa Fundamental

> [!CAUTION]
> **PROHIBICIÓN ABSOLUTA DE COMMITS Y PUSHES AUTÓNOMOS**:
> **PROHIBIDO** ejecutar `git commit`, `git push`, crear ramas remotas o tags sin consulta previa y autorización explícita del usuario.

---

## 2. Procedimiento de Solicitud de Autorización

Sigue este procedimiento cuando una tarea requiera persistir o publicar cambios en el repositorio:

- [ ] **Paso 1: Auditoría de Cambios Locales**
  - Ejecuta comandos de solo lectura para inspeccionar el estado del árbol de trabajo:
    ```bash
    git status
    git diff --stat
    ```
- [ ] **Paso 2: Elaboración de la Propuesta de Commit**
  - Redacta una propuesta de mensaje de commit siguiendo *Conventional Commits* (ej. `feat(duelos): ...`, `fix(ledger): ...`, `docs(vault): ...`).
- [ ] **Paso 3: Presentación al Usuario y Solicitud de Visto Bueno**
  - Presenta al usuario:
    1. Lista de archivos modificados, creados o eliminados.
    2. Mensaje de commit propuesto.
    3. Comandos exactos planificados para ejecución (ej. `git add .`, `git commit -m "..."`, `git push origin <rama>`).
- [ ] **Paso 4: Bloqueo de Ejecución hasta Aprobación**
  - Detén la ejecución de herramientas y espera la confirmación explícita del usuario.
- [ ] **Paso 5: Ejecución Tras Autorización**
  - Ejecuta los comandos aprobados única y exclusivamente tras recibir la confirmación afirmativa del usuario.
