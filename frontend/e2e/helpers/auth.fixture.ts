import { test as base, Browser, BrowserContext, Page, devices } from '@playwright/test';

/**
 * Fixture de autenticación y soporte multi-actor para pruebas E2E en QuestFest.
 * 
 * ¿Por qué este enfoque?
 * Para cumplir con el Principio 4 (escenarios de dificultad media-alta),
 * necesitamos probar interacciones donde dos o más usuarios reales (ej. Admin vs Jugador)
 * actúan en paralelo contra el sistema.
 * 
 * En lugar de compartir la misma sesión o sobrescribir cookies en un único navegador,
 * este helper permite instanciar múltiples 'BrowserContext' totalmente independientes.
 * Cada contexto almacena sus propias cookies HttpOnly de JWT y estado de almacenamiento,
 * garantizando que no existan colisiones de sesión en pruebas concurrentes.
 */

export interface MultiActorPages {
  // Contexto y página principal (por ejemplo, el Creador/Admin del grupo)
  adminPage: Page;
  adminContext: BrowserContext;
  // Contexto y página del segundo actor (el Jugador que se une o reta)
  playerPage: Page;
  playerContext: BrowserContext;
}

export const test = base.extend<{
  multiActor: MultiActorPages;
}>({
  multiActor: async ({ browser }, use) => {
    // 1. Instanciamos el contexto aislado para el Administrador simulando un dispositivo móvil
    const adminContext = await browser.newContext({
      ...devices['Pixel 7'],
      viewport: { width: 412, height: 915 },
      hasTouch: true,
    });
    const adminPage = await adminContext.newPage();

    // 2. Instanciamos el contexto aislado para el Jugador competidor
    const playerContext = await browser.newContext({
      ...devices['Pixel 7'],
      viewport: { width: 412, height: 915 },
      hasTouch: true,
    });
    const playerPage = await playerContext.newPage();

    // 3. Proporcionamos ambos actores al escenario de prueba
    await use({
      adminPage,
      adminContext,
      playerPage,
      playerContext,
    });

    // 4. Limpieza ordenada de contextos al finalizar la prueba para liberar memoria
    await adminContext.close();
    await playerContext.close();
  },
});

export { expect } from '@playwright/test';
