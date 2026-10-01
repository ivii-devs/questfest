import { test, expect } from '@playwright/test';

/**
 * ==============================================================================
 * TEST E2E: VERIFICACIÓN DE FEED, HOMOGENIZACIÓN DE CABECERAS Y ESTABILIDAD BOTTOMNAV
 * ==============================================================================
 * Este test valida las 3 áreas corregidas de acuerdo con los estándares de calidad:
 * 1. Renderizado y lectura completa del contenido de publicaciones y respuestas en el Feed.
 * 2. Homogenización de cabeceras en todas las pestañas con sus respectivos iconos temáticos.
 * 3. Persistencia ininterrumpida de la barra de navegación inferior (BottomNav) al alternar entre pestañas.
 * ==============================================================================
 */

test.describe('E2E: Feed, Iconografía de Cabeceras y Persistencia de BottomNav', () => {
  const timestamp = Date.now();
  const testUsername = `Jugador_Feed_${timestamp}`;
  const testPassword = 'Password_Seguro_123';
  const groupName = `Peña_Feed_${timestamp}`;
  const postMessage = `Desafío nocturno número ${timestamp}: ¿Quién se atreve?`;
  const replyMessage = `Yo me apunto al reto ${timestamp}!`;

  test('debe publicar y leer mensajes/respuestas en el feed, mostrar iconos en todas las pestañas y mantener BottomNav estable', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // Descartar prompt de instalación PWA y boletines automáticos para evitar oclusión táctil
    await page.addInitScript(() => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
      sessionStorage.setItem('disable_notification_modals', 'true');
    });

    // --------------------------------------------------------------------------
    // 1. REGISTRO Y ENTRADA AL HUB DE GRUPOS
    // --------------------------------------------------------------------------
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /nuevo jugador/i })).toBeVisible();

    await page.locator('#register-username').click();
    await page.locator('#register-username').pressSequentially(testUsername, { delay: 15 });
    await page.locator('#register-password').fill(testPassword);
    await page.locator('#register-confirm-password').fill(testPassword);

    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.status() === 200),
      page.getByRole('button', { name: /registrarme/i }).click(),
    ]);

    await page.waitForURL((url) => url.pathname.includes('/groups') || url.pathname === '/', {
      waitUntil: 'commit',
      timeout: 15000,
    });
    if (!page.url().includes('/groups')) {
      await page.goto('/groups');
    }
    await expect(page.getByText(/questfest hub/i)).toBeVisible({ timeout: 10000 });

    // --------------------------------------------------------------------------
    // 2. CREACIÓN DE GRUPO PARA ACTIVAR EL APP SHELL Y NAVEGACIÓN
    // --------------------------------------------------------------------------
    await page.getByRole('button', { name: /crear grupo/i }).first().click();
    await page.locator('#create-group-name').fill(groupName);
    await page.locator('#create-group-desc').fill('Comunidad de prueba para feed y navegación');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/groups') && res.request().method() === 'POST' && res.status() === 201
      ),
      page.locator('form').getByRole('button', { name: /^Crear Grupo$/i }).click(),
    ]);

    // Tras crear el grupo, el frontend redirige automáticamente a /feed
    await page.waitForURL((url) => url.pathname.includes('/feed'), {
      timeout: 15000,
    });

    // --------------------------------------------------------------------------
    // 3. VERIFICACIÓN DEL FEED: PUBLICACIÓN Y LECTURA DE MENSAJE Y RESPUESTA
    // --------------------------------------------------------------------------
    // Localizamos el formulario de publicación
    const postTextarea = page.getByRole('textbox', { name: /contenido de la publicación/i });
    await expect(postTextarea).toBeVisible();
    await postTextarea.fill(postMessage);

    // Enviamos la publicación e interceptamos la respuesta del backend
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/feed') && res.request().method() === 'POST' && res.status() === 201
      ),
      page.getByRole('button', { name: /enviar publicación/i }).click(),
    ]);

    // Comprobamos que el texto del post aparece en el feed de forma visible y legible
    const renderedPostText = page.getByText(postMessage);
    await expect(renderedPostText).toBeVisible({ timeout: 10000 });

    // Ahora enviamos una respuesta al post recién creado
    const replyButton = page.getByRole('button', { name: /responder a la publicación/i }).first();
    await replyButton.click();

    const replyInput = page.getByRole('textbox', { name: /escribe tu respuesta/i });
    await expect(replyInput).toBeVisible();
    await replyInput.fill(replyMessage);

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/reply') && res.request().method() === 'POST' && res.status() === 201
      ),
      page.getByRole('button', { name: /enviar respuesta/i }).click(),
    ]);

    // Verificamos que el texto de la respuesta se muestra legible en el hilo
    const renderedReplyText = page.getByText(replyMessage);
    await expect(renderedReplyText).toBeVisible({ timeout: 10000 });

    // --------------------------------------------------------------------------
    // 4. VERIFICACIÓN DE HOMOGENIZACIÓN DE CABECERAS CON ICONOS EN TODAS LAS PESTAÑAS
    // --------------------------------------------------------------------------
    const bottomNav = page.locator('nav.bottom-nav-glass');
    await expect(bottomNav).toBeVisible();

    // A) Pestaña Feed: Comprobar cabecera con icono Home
    const feedHeader = page.locator('header.app-shell-header');
    await expect(feedHeader.getByRole('heading', { name: /feed/i })).toBeVisible();
    await expect(feedHeader.locator('svg.lucide-home, svg.lucide-house')).toBeVisible();

    // B) Pestaña Ranking: Comprobar cabecera con icono Trophy
    await bottomNav.getByRole('link', { name: /ranking/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/ranking'), { timeout: 10000 });
    await expect(bottomNav).toBeVisible();
    const rankingHeader = page.locator('header.app-shell-header');
    await expect(rankingHeader.getByRole('heading', { name: /ranking/i })).toBeVisible();
    await expect(rankingHeader.locator('svg.lucide-trophy')).toBeVisible();

    // C) Pestaña Apuestas: Comprobar cabecera con icono Dice5
    await bottomNav.getByRole('link', { name: /apuestas/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/bets'), { timeout: 10000 });
    await expect(bottomNav).toBeVisible();
    const betsHeader = page.locator('header.app-shell-header');
    await expect(betsHeader.getByRole('heading', { name: /apuestas/i })).toBeVisible();
    await expect(betsHeader.locator('svg.lucide-dice-5')).toBeVisible();

    // D) Pestaña Misiones: Comprobar cabecera con icono Target
    await bottomNav.getByRole('link', { name: /misiones/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/missions'), { timeout: 10000 });
    await expect(bottomNav).toBeVisible();
    const missionsHeader = page.locator('header.app-shell-header');
    await expect(missionsHeader.getByRole('heading', { name: /misiones/i })).toBeVisible();
    await expect(missionsHeader.locator('svg.lucide-target')).toBeVisible();

    // E) Pestaña Duelos: Comprobar cabecera con icono Swords
    await bottomNav.getByRole('link', { name: /duelos/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/duels'), { timeout: 10000 });
    await expect(bottomNav).toBeVisible();
    const duelsHeader = page.locator('header.app-shell-header');
    await expect(duelsHeader.getByRole('heading', { name: /duelos/i })).toBeVisible();
    await expect(duelsHeader.locator('svg.lucide-swords')).toBeVisible();

    // F) Pestaña Stats: Comprobar cabecera con icono BarChart2
    await bottomNav.getByRole('link', { name: /stats/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/stats'), { timeout: 10000 });
    await expect(bottomNav).toBeVisible();
    const statsHeader = page.locator('header.app-shell-header');
    await expect(statsHeader.getByRole('heading', { name: /estadísticas/i })).toBeVisible();
    await expect(statsHeader.locator('svg.lucide-chart-no-axes-column, svg.lucide-bar-chart-2').first()).toBeVisible();

    // --------------------------------------------------------------------------
    // 5. VERIFICACIÓN DE ESTABILIDAD DE BOTTOMNAV AL CONMUTAR REPETIDAMENTE
    // --------------------------------------------------------------------------
    // Realizamos navegación secuencial rápida y verificamos que el elemento nav nunca es null o invisible
    for (const tab of ['Feed', 'Apuestas', 'Misiones', 'Duelos', 'Ranking', 'Stats']) {
      const link = bottomNav.getByRole('link', { name: new RegExp(tab, 'i') });
      await link.click();
      await expect(bottomNav).toBeVisible();
    }
  });
});
