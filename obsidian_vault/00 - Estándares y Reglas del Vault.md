# 00 - Estándares y Reglas del Vault

> Enlace de navegación: Volver al [[00 - Índice General]]

---

## Estándares de Redacción y Mantenimiento del Vault - QuestFest

Este documento establece el marco normativo de obligado cumplimiento para la redacción, actualización, adición y eliminación de notas dentro del Vault de Obsidian de **QuestFest**. Su propósito es asegurar una documentación homogénea, rigurosa y comprensible, así como preservar el contexto técnico tanto para usuarios humanos como para sistemas de Inteligencia Artificial.

---

## 1. Nomenclatura Oficial y Restricciones

- **Nombre de la Aplicación**: **QuestFest** (quedan obsoletas denominaciones anteriores como *Fiestas26*).
- **Moneda Virtual**: **QuestCoins**.
- **Sin Emojis**: Ninguna nota del Vault contendrá emoticonos ni emojis de ningún tipo.

---

## 2. Tono y Filosofía de Redacción

1. **Rigor Técnico en Lenguaje Natural y Comprensible**:
   Las notas deben emplear una terminología técnica precisa de ingeniería de software (por ejemplo: *asincronía non-blocking*, *JWT*, *propiedades ACID*, *ORM*, *Edge Middleware*), estructurada dentro de un **lenguaje natural, claro y accesible** que facilite una comprensión sencilla y amena.
2. **Tono Impersonal de Manual Técnico**:
   Redacción objetiva en 3ª persona del singular o impersonal. Se evita dirigirse al lector en 2ª persona (*"tú"*, *"imagina"*).
3. **Principio de Doble Explicación**:
   Cada concepto se desarrolla mediante:
   - `## Explicación Técnica`: Exposición formal del concepto en lenguaje natural.
   - `## Analogía de [Nombre del Modelo]`: Metáfora del mundo real o de dinámicas de juego para fijar la comprensión intuitiva.

---

## 3. Generación Automática de Notas Teóricas

Cualquier concepto de ingeniería de software mencionado en el sistema que requiera un desarrollo propio dará lugar a la creación de una **nueva nota independiente** en la sección `06 - Conceptos Teóricos`, a menos que dicha nota ya exista.

---

## 4. Revisión Integral y Prevención de Redundancias

Antes de realizar cambios en la documentación, se auditará el Vault existente. Si un concepto ya cuenta con una nota explicativa, no se duplicará información; se vinculará mediante un enlace WikiLink (`\[\[06.X - ...\]\]`).

---

## 5. Sincronización Código-Vault y Reporte Explícito

1. **Actualización por Cambios de Código**: Cada modificación, refactorización o adición en el código fuente o tras ejecutar un plan de implementación obligará a revisar y actualizar el Vault de Obsidian.
2. **Notificación al Usuario**: Al término de cada modificación, se reportará explícitamente qué notas fueron creadas o editadas y el motivo técnico correspondiente.

---

## 6. Estructura Canónica de una Nota

```markdown
# XX.Y - [Título de la Nota]

> Enlace de navegación: Volver al \[\[XX.0 - Indice y Mapa de Seccion\]\]

---

## Explicación Técnica

[Fundamentación de ingeniería de software en lenguaje natural...]

---

## Analogía de [Nombre del Modelo]

[Explicación con metáfora intuitiva...]

---

## Aplicación en el Proyecto QuestFest

[Detalles específicos de la implementación en QuestFest...]

---

## Conceptos Teóricos Relacionados
- \[\[06.X - Concepto Relacionado\]\]

---

## Ficheros Físicos del Código Fuente
- [Componente]: [backend/app/main.py](vscode://file/c:/.d/fiestas26-project/backend/app/main.py:21) *(Línea 21: función)*
```

---

## 7. Referencias Físicas y Enlaces a Código (Protocolo VS Code)

- **Protocolo `vscode://file/` Obligatorio**: Todos los enlaces a ficheros de código fuente se redactan utilizando el protocolo URI `vscode://file/<workspace>/[ruta]:[linea]` (por ejemplo: `[backend/app/main.py](vscode://file/c:/.d/fiestas26-project/backend/app/main.py:21)`).
- **Prevención de Nodos Fantasma**: Al ser reconocido como un protocolo externo, Obsidian no genera nodos en la Vista Gráfica, manteniendo el grafo 100% limpio y abriendo el archivo en VS Code directamente en la línea indicada sin provocar el error `"Folder already exists"`.
- **Mermaid**: Entrecomillado obligatorio de etiquetas con comillas dobles `-->|"etiqueta"|` y uso estricto de flechas `-->` / `-.->` en bloques `graph`.
