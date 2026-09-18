# ==============================================================================
# Dockerfile Multi-Stage para Frontend Next.js 16 (QuestFest)
# ==============================================================================
# Utiliza Node.js 20 sobre Alpine Linux y la salida 'standalone' de Next.js
# para generar una imagen de producción de tamaño mínimo (~120MB), segura
# y de bajo consumo de memoria.

# ------------------------------------------------------------------------------
# Etapa 1: Imagen Base
# ------------------------------------------------------------------------------
FROM node:20-alpine AS base

# libc6-compat provee librerías compartidas estándar necesarias para ciertos binarios en Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ------------------------------------------------------------------------------
# Etapa 2: Instalación de Dependencias
# ------------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copiamos únicamente los manifiestos de dependencias para aprovechar la caché de capas
COPY package.json package-lock.json ./

# npm ci garantiza una instalación reproducible basada en package-lock.json
RUN npm ci

# ------------------------------------------------------------------------------
# Etapa 3: Compilación del Proyecto
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Montamos las dependencias resueltas en la etapa anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desactivar telemetría de Next.js durante el build
ENV NEXT_TELEMETRY_DISABLED=1

# Inyección de la URL de API pública en tiempo de construcción (requerida por Next.js para embeberla en el bundle JS)
ARG NEXT_PUBLIC_API_URL=https://questfest.app
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Compilamos la aplicación generando la distribución '.next/standalone'
RUN npm run build

# ------------------------------------------------------------------------------
# Etapa 4: Imagen Final de Producción (Runner)
# ------------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Por seguridad y principio de mínimo privilegio, no ejecutamos como usuario 'root'
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiamos los recursos estáticos de la carpeta pública (manifest, iconos PWA, service worker)
COPY --from=builder /app/public ./public

# Creamos y asignamos permisos al directorio de trabajo interno de Next.js
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copiamos el servidor standalone mínimo y los bundles estáticos con propiedad del usuario 'nextjs'
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Ejecutamos el servidor Node.js autónomo generado por Next.js
CMD ["node", "server.js"]
