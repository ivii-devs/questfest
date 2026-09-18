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
  - Los commits deben ser **simples y atómicos**, abordando un único cambio o aspecto concreto.
  - El mensaje debe estar redactado obligatoriamente **en español**.
  - Utilizar un **lenguaje claro, directo y no excesivamente técnico**, explicando de forma comprensible para cualquier persona qué se ha hecho o modificado (ej. `feat(duelos): permitir cancelar una apuesta pendiente`, `fix(interfaz): corregir desalineacion en el boton de perfil`, `docs(manual): actualizar instrucciones de instalacion`).
- [ ] **Paso 3: Presentación al Usuario y Solicitud de Visto Bueno**
  - Presenta al usuario:
    1. Lista de archivos modificados, creados o eliminados.
    2. Mensaje de commit propuesto (simple, en español y comprensible).
    3. Comandos exactos planificados para ejecución (ej. `git add .`, `git commit -m "..."`, `git push origin <rama>`).
- [ ] **Paso 4: Bloqueo de Ejecución hasta Aprobación**
  - Detén la ejecución de herramientas y espera la confirmación explícita del usuario.
- [ ] **Paso 5: Ejecución Tras Autorización**
  - Ejecuta los comandos aprobados única y exclusivamente tras recibir la confirmación afirmativa del usuario.

---

## 3. Estrategia de Preparación de Cambios: Carpetas Lógicas

Al existir múltiples modificaciones dispersas en el repositorio (frontend, backend, vault, etc.), **se debe priorizar la preparación por carpetas o módulos temáticos** (`git add <carpeta>/`) en lugar de listar archivos uno por uno o realizar inclusiones masivas indiscriminadas (`git add .`).

### Ejemplos de uso por ámbito:
- **Frontend por características:**
  ```bash
  git add frontend/src/components/groups/
  git add frontend/src/components/admin/
  ```
- **Backend por capas o módulos:**
  ```bash
  git add backend/app/routers/
  git add backend/app/models/
  ```
- **Documentación de Obsidian:**
  ```bash
  git add obsidian_vault/
  ```
- **Configuración o Agentes:**
  ```bash
  git add .agents/
  ```

*Nota:* Si un cambio específico asocia únicamente dos o tres archivos puntuales distribuidos en distintas rutas (por ejemplo, una página y su componente modal), agrúpalos en un único comando: `git add ruta/archivo1 ruta/archivo2`.
