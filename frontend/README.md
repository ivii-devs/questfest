# QuestFest - Cliente Web PWA

Aplicación web progresiva (PWA) de QuestFest construida con Next.js (App Router), Tailwind CSS y temática inspirada en Dracula.

## Requisitos previos

- Node.js 20+
- Servidor backend de QuestFest en ejecución (por defecto en `http://localhost:8000`)

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   Copiar `.env.example` a `.env.local` y definir la URL de la API del backend:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. Iniciar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## Comandos disponibles

- `npm run dev`: Inicia el entorno de desarrollo con recarga en caliente.
- `npm run build`: Compila la aplicación para producción.
- `npm run start`: Inicia el servidor de producción tras compilar.
- `npm run lint`: Ejecuta el linter (ESLint) para verificar estándares de código.
