# Gobernanza de Herramientas y Permisos de Ejecución (`tools/permissions.md`)

## 1. Clasificación de Comandos de Terminal

### A. Comandos Seguros Permitidos (Lista Blanca)
Ejecuta de forma autónoma estos comandos de inspección, compilación y verificación estática (siempre dentro de la fase correspondiente del ciclo de vida; no ejecutar pruebas o builds en tareas de análisis, planes o consultas):
- **Testing (Únicamente bajo petición explícita del usuario)**: `pytest`, `pytest-asyncio`, `npm run test`, `npm run test:e2e` (empleando siempre el entorno virtual del backend `backend\venv\Scripts\pytest`). Queda terminantemente vetado ejecutarlos de forma autónoma sin solicitud expresa.
- **Inspección de Estado y Git**: `git status`, `git diff`, `git log -n <N>`, `git branch`.
- **Dependencias y Build**: `npm run build`, `npm run lint`, `pip list`.
- **Contenedores (Estado)**: `docker ps`, `docker-compose ps`, `docker logs`.

### B. Comandos Condicionados a Aprobación Previa (Lista Gris)
Consulta al usuario y obtén autorización explícita antes de ejecutar:
- **Migraciones de Base de Datos**: `alembic upgrade head`, `alembic revision --autogenerate`.
- **Instalación de Nuevos Paquetes**: `npm install <paquete>`, `pip install <paquete>`.
- **Reinicio de Servicios**: `docker-compose down`, `docker-compose up -d`.

### C. Comandos Estrictamente Vetados (Lista Negra)
**PROHIBIDO** ejecutar bajo cualquier circunstancia sin protocolo formal de autorización:
- `git commit`
- `git push`
- `git reset --hard` / `git clean -fd`
- Alteración directa de esquemas de base de datos sin Alembic.
- Eliminación recursiva no supervisada de directorios raíz.

---

## 2. Directivas de Uso de Herramientas de Edición

- **Portabilidad**: Prohíbese insertar rutas locales absolutas de disco (`C:\...`, `file:///...`) en archivos de configuración o documentación.
- **Atomicidad**: Prioriza ediciones de bloques contiguos mediante `replace_file_content` sobre sobrescrituras completas de archivos extensos.

---

## 3. Gobernanza del Ciclo de Vida de Procesos y Puertos (Protocolo Anti-Zombi)

Para evitar bloqueos indefinidos, puertos retenidos (3000, 8000) y procesos zombi en terminal:

### A. Clasificación Estricta del Tipo de Proceso
1. **Procesos Finitos** (ej. `npm run build`, o `pytest`/`npm run test:e2e` cuando hayan sido solicitados explícitamente):
   - Tienen un principio y un fin natural.
   - El agente debe esperar a que el comando termine y verificar el código de salida (exit code 0).
2. **Servidores y Demonios** (ej. `npm run dev`, `uvicorn`):
   - **Nunca terminarán por sí mismos** por diseño de socket en escucha continua.
   - **PROHIBIDO** quedarse esperando a que el proceso concluya o asumir que falló porque la terminal sigue abierta. Deben ejecutarse en segundo plano con `IsDaemon: true`.

### B. Criterio de Validación por Salida (Log Inspection)
- Al lanzar un servidor en segundo plano (`IsDaemon: true` o tarea en segundo plano), inspecciona sus logs inmediatamente tras el arranque.
- Si la salida contiene señales de éxito tales como:
  - `Ready in X ms / Compiled successfully / Local: http://localhost:3000` (Next.js)
  - `Application startup complete / Uvicorn running on http://...` (FastAPI)
  el servicio se declara **Operativo** y se procede de inmediato al siguiente paso sin esperar el cierre del proceso.

### C. Teardown Obligatorio (Finalización Activa)
- Es responsabilidad ineludible del agente **matar explícitamente** todo proceso servidor (`manage_task` con `Action: 'kill'` o cancelación del subproceso) en el momento exacto en que finalicen las pruebas que dependían de él.
- **PROHIBIDO** cerrar una tarea o dar por concluido un plan dejando instancias huérfanas de `node.exe` o `python.exe` escuchando en los puertos del proyecto (3000, 8000).

### D. Verificación Previa y Limpieza de Puertos
- Antes de iniciar cualquier suite o servidor, lista las tareas activas (`manage_task Action: 'list'`) o valida que los puertos requeridos están libres para no colisionar con ejecuciones previas (ej. ejecutando scripts de limpieza preventiva como `node scripts/clean-ports.js` o comprobando listeners de red activos).

