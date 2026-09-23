# Gobernanza de Herramientas y Permisos de Ejecución (`tools/permissions.md`)

## 1. Clasificación de Comandos de Terminal

### A. Comandos Seguros Permitidos (Lista Blanca)
Ejecuta de forma autónoma estos comandos de inspección, compilación y pruebas (siempre dentro de la fase correspondiente del ciclo de vida; no ejecutar pruebas o builds en tareas de análisis, planes o consultas):
- **Testing**: `pytest`, `pytest-asyncio`, `npm run test`, `npx vitest` (empleando siempre el entorno virtual del backend `backend\venv\Scripts\pytest`).
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
