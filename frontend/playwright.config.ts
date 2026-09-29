import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración oficial de Playwright para QuestFest PWA.
 * 
 * Diseñada bajo el principio E2E-First con emulación Mobile-First,
 * generación garantizada de artefactos reproducibles (traces, capturas, vídeos)
 * y soporte multi-actor para escenarios de alta complejidad.
 */
export default defineConfig({
  // Directorio raíz donde residen las especificaciones de prueba E2E
  testDir: './e2e',

  // Tiempo límite por test extendido a 60s para acomodar flujos multi-actor con base de datos remota
  timeout: 60000,

  // Ejecución paralela completa para optimizar tiempos en suites grandes
  fullyParallel: true,

  // Evita dejar accidentalmente test.only en entornos de integración o CI
  forbidOnly: !!process.env.CI,

  // Reintentos automáticos en caso de inconsistencia de red transitoria
  retries: process.env.CI ? 2 : 1,

  // Limitar a 1 worker secuencial para asegurar aislamiento determinista y no saturar el servidor local
  workers: 1,

  // Reportería multi-canal: reporte HTML para visualización humana y JSON para análisis programático
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  // Opciones compartidas para todos los proyectos y navegadores
  use: {
    // URL base del frontend de Next.js
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',

    // Generar archivo de traza (.zip) en caso de fallo para inspección forense en Trace Viewer
    trace: 'retain-on-failure',

    // Capturar imagen solo en caso de discrepancia o fallo de aserción
    screenshot: 'only-on-failure',

    // Registrar vídeo de la interacción para depuración visual de escenarios multi-actor
    video: 'retain-on-failure',
  },

  // Proyectos configurados: priorizamos dispositivos móviles para validar los estándares PWA
  projects: [
    {
      name: 'Mobile Chrome (Pixel 7)',
      use: {
        ...devices['Pixel 7'],
        // Garantizamos soporte de gestos táctiles para verificar el target mínimo de 48x48 px
        hasTouch: true,
      },
    },
    {
      name: 'Mobile Safari (iPhone 15)',
      use: {
        ...devices['iPhone 15'],
        // Verificación crítica de safe-area-inset y estilos específicos de WebKit iOS
        hasTouch: true,
      },
    },
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Gestión automática del servidor de desarrollo Next.js si no se encuentra levantado
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
