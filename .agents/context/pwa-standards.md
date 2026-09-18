# Contexto Técnico: Estándares Obligatorios PWA (Progressive Web App)

## 1. Instalabilidad y Manifiesto de Aplicación

- Mantén la integridad técnica de `manifest.json` / `manifest.webmanifest`.
- Configura el modo de visualización en `display: "standalone"`.
- Sincroniza `theme-color` y `background-color` con la paleta de diseño visual.
- Asegura íconos adaptativos en resoluciones 192x192 y 512x512 con soporte para máscara (*maskable*).

---

## 2. Service Workers y Resiliencia Offline

- Registra el Service Worker en el arranque del cliente sin bloquear el hilo principal de renderizado.
- Aplica las siguientes estrategias de caché:
  - *Cache-First*: Para activos estáticos inmutables (fuentes, íconos, logos).
  - *Stale-While-Revalidate*: Para rutas de navegación y contenido visual frecuente.
  - *Network-First con Fallback Offline*: Para llamadas a la API REST que involucren transacciones o saldos (`Ledger`, `Duelos`, `Apuestas`).
- Proporciona una pantalla de desconexión (*Offline Screen*) comprensible; evita pantallas de error genéricas del navegador.

---

## 3. Ergonomía y Experiencia de Usuario Móvil Nativa

- Diseña bajo enfoque Mobile-First: valida layouts en pantallas móviles antes que en escritorio.
- Configura un área táctil mínima de **48x48 píxeles** para cualquier botón, enlace o elemento interactivo.
- Aplica variables CSS de zona segura para evitar solapamientos con cámaras y barras gestuales:
  ```css
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  ```
- Fija el tamaño de fuente mínimo en `16px` en inputs para prevenir el zoom automático en iOS/Safari.
- Controla el *overscroll-behavior* para neutralizar tirones o recargas accidentales al deslizar.

---

## 4. Notificaciones Push y Sincronización en Segundo Plano

- Emplea la Web Push API nativa del navegador mediante suscripciones VAPID (`pywebpush` en backend).
- Solicita permisos de notificación únicamente tras acciones de valor del usuario (ej. unirse a una misión o aceptar un duelo).
- Implementa listeners de `push` y `notificationclick` en el Service Worker para redireccionar al usuario a la vista correspondiente.
