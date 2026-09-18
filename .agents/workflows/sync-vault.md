# Workflow: Sincronización Obligatoria con el Vault de Obsidian

## 1. Reglas Inmutables de Redacción en el Vault

- **Nomenclatura**: Emplea estrictamente **QuestFest** y **QuestCoins**.
- **Prohibición de Emojis**: **PROHIBIDO** incluir emojis en títulos, encabezados o contenido del Vault.
- **Tono Impersonal**: Redacta en tercera persona del singular o estilo impersonal técnico. Prohibido tutear al lector.
- **Principio de Doble Explicación**: Incluye en toda nota conceptual:
  1. *Explicación Técnica*: Fundamentación de ingeniería en lenguaje natural claro.
  2. *Analogía*: Metáfora del mundo real o de juegos que facilite la comprensión intuitiva.
- **Enlaces a Código Fuente (Protocolo VS Code)**:
  - Aplica estrictamente el protocolo: `[archivo.py](vscode://file/<workspace_path>/ruta/al/archivo.py:linea)`.
- **Enlaces Internos**: Usa WikiLinks `[[XX.Y - Nombre de Nota]]` o con alias `[[XX.Y - Nota|Texto]]`.
- **Diagramas Mermaid**: Emplea únicamente `graph TD`, `graph LR` o `sequenceDiagram`. Entrecomilla siempre las etiquetas en bloques graph: `-->|"Etiqueta"|`.

---

## 2. Procedimiento de Sincronización Paso a Paso

Ejecuta este checklist tras modificar código, endpoints, modelos o lógica:

- [ ] **Paso 1: Auditoría Previa del Vault**
  - Inspecciona `00 - Índice General.md` y notas existentes; evita duplicar conceptos ya documentados.
- [ ] **Paso 2: Identificación de Notas Afectadas**
  - Determina qué notas de `01 - Visión General`, `02 - El Motor (Backend)`, `03 - La Interfaz (Frontend)` o `04 - Flujos del Juego` requieren actualización.
- [ ] **Paso 3: Creación de Notas Teóricas Autónomas**
  - Si la funcionalidad introduce un concepto técnico relevante (ej. *CORS*, *WebSockets*, *Idempotencia*), crea la nota en `06 - Conceptos Teóricos` como `06.X - [Concepto sin tildes].md`.
- [ ] **Paso 4: Actualización y Redacción de Notas**
  - Sigue la plantilla canónica: Título numérico, Enlaces de navegación, Explicación Técnica, Analogía, Aplicación en QuestFest, Conceptos Relacionados y Ficheros Físicos.
- [ ] **Paso 5: Reporte Explícito al Usuario**
  - Detalla en la respuesta final la lista exacta de notas creadas, modificadas o eliminadas junto con la justificación técnica de cada ajuste.
