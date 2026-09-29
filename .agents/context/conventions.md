# Contexto Técnico: Convenciones de Código y Guía de Humanización

## 1. Convenciones de Tipado y Calidad Técnica

### A. Frontend (TypeScript & React)
- Activa el modo estricto de TypeScript (`strict: true`).
- Prohíbese el uso de `any` injustificado; define interfaces o tipos explícitos para props, estados y payloads.
- Estructura componentes funcionales limpios; extrae la lógica de negocio en hooks personalizados (`use...`).

### B. Backend (Python & FastAPI)
- Aplica anotaciones de tipo estándar (`type hints`) en todas las funciones y métodos.
- Encapsula la validación y serialización en esquemas Pydantic v2 (`app/schemas/`).
- Emite excepciones semánticas mediante `HTTPException` con códigos de estado adecuados.

---

## 2. Guía de Estilo para la Humanización de Comentarios ("Pair Programming")

> [!IMPORTANT]
> Comenta todo código nuevo o modificado como si un **desarrollador senior estuviera explicándole el código a un compañero**.

### Reglas Obligatorias de Redacción:

1. **Tono Natural y Accesible en Español**:
   - Redacta explicaciones directas, humanas y comprensibles en idioma español.
   - Trata al lector como a un colega desarrollador; elimina formulismos fríos o jerga críptica.

2. **Explicación del Propósito ("Por qué"), no de la Sintaxis ("Qué")**:
   - ❌ *Evita comentarios sintácticos*: `// Incrementa el contador` o `# Retorna el usuario`.
   - ✅ *Explica la intención de negocio*: `// Buscamos al usuario por su ID en la base de datos para verificar que su sesión siga activa y que no haya sido revocado tras la emisión del token JWT.`

3. **Advertencias Prácticas y Trampas Técnicas**:
   - Señala efectos secundarios, restricciones de memoria/rendimiento, peculiaridades de iOS/Safari (PWA) o interacciones críticas con Nginx.

4. **Explicación de Reglas de Negocio y Dominio**:
   - Documenta el motivo tras las reglas del juego:
     - *Por qué los duelos congelan los tokens de ambos participantes al aceptar el reto.*
     - *Por qué las apuestas solo devuelven saldo si se anula el evento.*
     - *Por qué el cálculo de la ruleta se ejecuta estrictamente en el backend.*

5. **Explicación de Compromisos de Diseño (Trade-offs)**:
   - Justifica las decisiones técnicas adoptadas frente a alternativas descartadas:
     - `// Usamos actualización optimista aquí para que el botón responda al instante en móviles (PWA); si la API rechaza la transacción, revertimos el estado y mostramos un toast.`

6. **Valor Real sin Sobrecargar (Noise vs. Value)**:
   - Prohíbese comentar asignaciones triviales o importaciones obvias.
   - Concentra los comentarios en lógica de negocio, hooks personalizados, endpoints, middleware y algoritmos de cálculo.

---

## 3. Nomenclatura Funcional y Semántica en Pruebas, Planes y Documentación

> [!IMPORTANT]
> **Prohibición de Nombres Anecdóticos o Coloquiales**:
> Queda terminantemente prohibido utilizar nombres folclóricos, coloquiales, anecdóticos o de humor (como "Peña El Chupinazo", "Peña El Cohete", "fiesta_secreta_123", "usuario_pobre", etc.) en planes de implementación, datos sintéticos de prueba, fixtures, especificaciones E2E o documentación técnica.

### Reglas de Nomenclatura Obligatorias:
1. **Nombres Funcionales y Semánticos**: Emplea siempre identificadores que describan explícitamente el rol, la entidad y la condición técnica evaluada.
   - ❌ *Incorrecto*: `Peña El Chupinazo`
   - ✅ *Correcto*: `Grupo_E2E_Protegido_A` o `Grupo_Verificacion_Multitenant`
   - ❌ *Incorrecto*: `clave_secreta_fiesta`
   - ✅ *Correcto*: `Password_Acceso_Valido_123` / `Password_Acceso_Invalido_456`
   - ❌ *Incorrecto*: `el_fundador`, `poor_user`, `fiestero_loco`
   - ✅ *Correcto*: `Usuario_Admin_Grupo`, `Usuario_Miembro_A`, `Usuario_Miembro_B`
   - ❌ *Incorrecto*: `Reto del Chupito`
   - ✅ *Correcto*: `Mision_Verificacion_Ledger_100QC`
2. **Generación Dinámica con Prefijos**: En pruebas automatizadas contra base de datos, utiliza prefijos semánticos combinados con timestamps o hashes para evitar colisiones: `e2e_admin_${Date.now()}`, `e2e_player_a_${Date.now()}`.
