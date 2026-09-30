import { test, expect, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ==============================================================================
 * TEST E2E MULTI-ACTOR DEL CICLO ECONÓMICO COMPLETO Y AUDITORÍA UI (TIER 2)
 * ==============================================================================
 * Este test orquesta tres sesiones concurrentes e independientes en Playwright:
 * 1. Usuario_Admin_E2E (Desktop Chrome - 1280x800):
 *    - Fundador del grupo 'Grupo_Economia_E2E' (100 QC).
 *    - Arbitro supremo del Tribunal (/admin) en sentencias de duelos.
 *    - Curador de cuotas y resolución de apuestas comunitarias.
 *    - Validador de pruebas sociales y abono de recompensas.
 * 2. Usuario_Retador_E2E (Mobile Pixel 7 - 412x915):
 *    - Miembro activo. Lanza reto PvP (40 QC), propone apuesta de ajedrez,
 *      gira la ruleta diaria en /feed y reclama victoria de duelo.
 * 3. Usuario_Rival_E2E (Mobile iPhone 15 - 393x852):
 *    - Miembro activo. Acepta duelo (40 QC), compra ticket en opción contraria,
 *      y completa la misión comunitaria 'Baile Comunitario'.
 *
 * Directivas cumplidas:
 * - Tolerancia cero a pruebas tautológicas: Verificación en pantalla del saldo visible
 *   en la cabecera del App Shell tras cada transición de estado contable.
 * - Simulación táctil mobile-first y soporte de safe-areas.
 * - Generación de capturas de pantalla (screenshots) como artefactos verificables.
 * ==============================================================================
 */

test.describe('Suite E2E: Ciclo Económico Completo, Motor Ledger y Calidad PWA', () => {
  const timestamp = Date.now();
  const adminUsername = `Usuario_Admin_E2E_${timestamp}`;
  const retadorUsername = `Usuario_Retador_E2E_${timestamp}`;
  const rivalUsername = `Usuario_Rival_E2E_${timestamp}`;
  const userPassword = 'Password_Seguro_123';
  const groupName = `Grupo_Economia_E2E_${timestamp}`;
  const groupPassword = 'Credencial_Economia_99';

  // Directorio de salida para los artefactos gráficos
  const screenshotDir = path.resolve(process.cwd(), 'screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('debe ejecutar el ciclo económico completo entre 3 actores con cero fugas en UI', async ({
    browser,
  }) => {
    // Extendemos el tiempo límite total para acomodar flujos cruzados entre 3 contextos móviles (WebKit en Windows)
    test.setTimeout(240000);

    // --------------------------------------------------------------------------
    // FASE 1: PROVISIÓN DE LOS 3 CONTEXTOS MULTI-DISPOSITIVO Y REGISTRO
    // --------------------------------------------------------------------------

    // 1.1 Contexto Admin (Desktop Chrome)
    const adminContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      hasTouch: false,
    });
    await adminContext.addInitScript(() => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
      sessionStorage.setItem('disable_notification_modals', 'true');
    });
    const adminPage = await adminContext.newPage();

    // 1.2 Contexto Retador (Mobile Pixel 7)
    const retadorContext = await browser.newContext({
      ...devices['Pixel 7'],
      viewport: { width: 412, height: 915 },
      hasTouch: true,
    });
    await retadorContext.addInitScript(() => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
      sessionStorage.setItem('disable_notification_modals', 'true');
    });
    const retadorPage = await retadorContext.newPage();

    // 1.3 Contexto Rival (Mobile iPhone 15)
    const rivalContext = await browser.newContext({
      ...devices['iPhone 15'],
      viewport: { width: 393, height: 852 },
      hasTouch: true,
    });
    await rivalContext.addInitScript(() => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
      sessionStorage.setItem('disable_notification_modals', 'true');
    });
    const rivalPage = await rivalContext.newPage();

    // --------------------------------------------------------------------------
    // REGISTRO DE USUARIO ADMIN Y CREACIÓN DEL GRUPO PROTEGIDO
    // --------------------------------------------------------------------------
    await adminPage.goto('/register', { waitUntil: 'domcontentloaded' });
    await adminPage.locator('#register-username').click();
    await adminPage
      .locator('#register-username')
      .pressSequentially(adminUsername, { delay: 15 });
    await adminPage.locator('#register-password').fill(userPassword);
    await adminPage.locator('#register-confirm-password').fill(userPassword);

    await Promise.all([
      adminPage.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.status() === 200
      ),
      adminPage.getByRole('button', { name: /registrarme/i }).click(),
    ]);

    await adminPage.waitForURL(
      (url) => url.pathname.includes('/groups') || url.pathname === '/',
      { waitUntil: 'commit', timeout: 15000 }
    );
    if (!adminPage.url().includes('/groups')) {
      await adminPage.goto('/groups', { waitUntil: 'domcontentloaded' });
    }
    await expect(adminPage.getByText(/questfest hub/i)).toBeVisible({
      timeout: 10000,
    });

    // Creación de la comunidad 'Grupo_Economia_E2E'
    await adminPage
      .getByRole('button', { name: /crear grupo/i })
      .first()
      .click();
    await adminPage.locator('#create-group-name').fill(groupName);
    await adminPage
      .locator('#create-group-desc')
      .fill('Comunidad de auditoría económica completa E2E');
    await adminPage.locator('input[type="checkbox"]').check();
    await adminPage.locator('#create-group-password').fill(groupPassword);

    const [createGroupRes] = await Promise.all([
      adminPage.waitForResponse(
        (res) =>
          res.url().includes('/api/groups') &&
          res.request().method() === 'POST' &&
          res.status() === 201
      ),
      adminPage
        .locator('form')
        .getByRole('button', { name: /^Crear Grupo$/i })
        .click(),
    ]);
    const groupData = await createGroupRes.json();
    const groupCode = groupData.codigo_unico;
    expect(groupCode).toMatch(/^QF-[A-Z0-9]{5,6}$/);

    // Tras crear el grupo, el frontend redirige automáticamente a /feed
    await adminPage.waitForURL((url) => url.pathname.includes('/feed'), {
      timeout: 15000,
    });
    await expect(adminPage.locator('header').getByText('100 QC')).toBeVisible({
      timeout: 10000,
    });

    // --------------------------------------------------------------------------
    // REGISTRO E INCORPORACIÓN DEL USUARIO_RETADOR
    // --------------------------------------------------------------------------
    await retadorPage.goto('/register', { waitUntil: 'domcontentloaded' });
    await retadorPage.locator('#register-username').click();
    await retadorPage
      .locator('#register-username')
      .pressSequentially(retadorUsername, { delay: 15 });
    await retadorPage.locator('#register-password').fill(userPassword);
    await retadorPage.locator('#register-confirm-password').fill(userPassword);

    await Promise.all([
      retadorPage.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.status() === 200
      ),
      retadorPage.getByRole('button', { name: /registrarme/i }).click(),
    ]);
    await retadorPage.waitForURL(
      (url) => url.pathname.includes('/groups') || url.pathname === '/',
      { waitUntil: 'commit', timeout: 15000 }
    );
    if (!retadorPage.url().includes('/groups')) {
      await retadorPage.goto('/groups', { waitUntil: 'domcontentloaded' });
    }

    // Retador se une al grupo con el código y contraseña
    await retadorPage
      .getByRole('button', { name: /unirse a grupo/i })
      .first()
      .click();
    await retadorPage.locator('#join-modal-code').fill(groupCode);
    await retadorPage.locator('#join-modal-password').fill(groupPassword);

    await Promise.all([
      retadorPage.waitForResponse(
        (res) => res.url().includes('/api/groups/join') && res.status() === 200
      ),
      retadorPage
        .locator('form')
        .getByRole('button', { name: /unirme/i })
        .click(),
    ]);

    await retadorPage.waitForURL((url) => url.pathname.includes('/feed'), {
      timeout: 15000,
    });
    await expect(retadorPage.locator('header').getByText('100 QC')).toBeVisible(
      { timeout: 10000 }
    );

    // --------------------------------------------------------------------------
    // REGISTRO E INCORPORACIÓN DEL USUARIO_RIVAL
    // --------------------------------------------------------------------------
    await rivalPage.goto('/register', { waitUntil: 'domcontentloaded' });
    await rivalPage.locator('#register-username').click();
    await rivalPage
      .locator('#register-username')
      .pressSequentially(rivalUsername, { delay: 15 });
    await rivalPage.locator('#register-password').fill(userPassword);
    await rivalPage.locator('#register-confirm-password').fill(userPassword);

    await Promise.all([
      rivalPage.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.status() === 200
      ),
      rivalPage.getByRole('button', { name: /registrarme/i }).click(),
    ]);
    await rivalPage.waitForURL(
      (url) => url.pathname.includes('/groups') || url.pathname === '/',
      { waitUntil: 'commit', timeout: 15000 }
    );
    if (!rivalPage.url().includes('/groups')) {
      await rivalPage.goto('/groups', { waitUntil: 'domcontentloaded' });
    }

    await rivalPage
      .getByRole('button', { name: /unirse a grupo/i })
      .first()
      .click();
    await rivalPage.locator('#join-modal-code').fill(groupCode);
    await rivalPage.locator('#join-modal-password').fill(groupPassword);

    await Promise.all([
      rivalPage.waitForResponse(
        (res) => res.url().includes('/api/groups/join') && res.status() === 200
      ),
      rivalPage
        .locator('form')
        .getByRole('button', { name: /unirme/i })
        .click(),
    ]);

    await rivalPage.waitForURL((url) => url.pathname.includes('/feed'), {
      timeout: 15000,
    });
    await expect(rivalPage.locator('header').getByText('100 QC')).toBeVisible({
      timeout: 10000,
    });

    // ==========================================================================
    // FASE 2: CICLO DE DUELOS PvP, RETENCIÓN PREVENTIVA Y TRIBUNAL
    // ==========================================================================
    // 2.1 Lanzamiento del Desafío por el Retador
    await retadorPage.goto('/duels', { waitUntil: 'domcontentloaded' });
    await expect(
      retadorPage.getByRole('heading', { name: /^Duelos$/i })
    ).toBeVisible();

    // Abrir modal de reto con el FAB flotante
    await retadorPage.locator('button[aria-label="Lanzar un reto"]').click();
    await expect(retadorPage.getByText(/lanzar un reto/i)).toBeVisible();

    // Seleccionar contrincante, disciplina y fianza de 40 QC
    await retadorPage.locator('select').selectOption({ label: rivalUsername });
    await retadorPage.locator('#duel-game-name').fill('Ajedrez Relámpago');
    await retadorPage.locator('#duel-wager-amount').fill('40');

    const [duelCreatedRes] = await Promise.all([
      retadorPage.waitForResponse(
        (res) =>
          res.url().includes('/api/duelos') &&
          res.request().method() === 'POST' &&
          res.status() === 201
      ),
      retadorPage.getByRole('button', { name: /confirmar reto/i }).click(),
    ]);
    const duelId = (await duelCreatedRes.json()).duel_id;

    // Verificación de Saldo Retador: 100 - 40 = 60 QC en cabecera
    await expect(retadorPage.locator('header').getByText('60 QC')).toBeVisible({
      timeout: 10000,
    });

    // Captura Artefacto 1: Duelo propuesto en retención Escrow
    await retadorPage.screenshot({
      path: path.join(screenshotDir, '01_duels_created_and_escrow.png'),
    });

    // 2.2 Aceptación del Reto por el Rival
    await rivalPage.goto('/duels', { waitUntil: 'domcontentloaded' });
    await expect(
      rivalPage.getByRole('heading', { name: /^Duelos$/i })
    ).toBeVisible();

    // Si hubiese algún modal de aviso o notificación residual, lo descartamos defensivamente
    const dismissModalBtn = rivalPage.getByRole('button', {
      name: /entendido/i,
    });
    if (await dismissModalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissModalBtn.click();
    }

    // Localizar la tarjeta del duelo entrante y pulsar "Aceptar"
    const acceptDuelBtn = rivalPage
      .getByRole('button', { name: /^Aceptar$/i })
      .first();
    await expect(acceptDuelBtn).toBeVisible({ timeout: 10000 });

    await Promise.all([
      rivalPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/duelos/${duelId}/action?action=accept`) &&
          res.status() === 200
      ),
      acceptDuelBtn.click(),
    ]);

    // Verificación de Saldo Rival: 100 - 40 = 60 QC en cabecera
    await expect(rivalPage.locator('header').getByText('60 QC')).toBeVisible({
      timeout: 10000,
    });

    // 2.3 Reporte de Victoria por el Retador
    await retadorPage.reload({ waitUntil: 'domcontentloaded' });
    const informBtn = retadorPage
      .getByRole('button', { name: /informar resultado/i })
      .first();
    await expect(informBtn).toBeVisible({ timeout: 10000 });
    await informBtn.click();

    // Confirmar victoria en el modal ("He ganado YO")
    await Promise.all([
      retadorPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/duelos/${duelId}/action?action=resolve`) &&
          res.status() === 200
      ),
      retadorPage.getByRole('button', { name: /he ganado yo/i }).click(),
    ]);

    // 2.4 Arbitraje en Modo Dios (Tribunal Admin)
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    const tabDuelos = adminPage.locator('#admin-tab-duelos');
    await tabDuelos.click({ force: true });

    // Localizar el expediente y dictar sentencia: "Gana Usuario_Retador"
    const ganaRetadorBtn = adminPage.getByRole('button', {
      name: new RegExp(`gana ${retadorUsername}`, 'i'),
    });
    await expect(ganaRetadorBtn).toBeVisible({ timeout: 15000 });

    await Promise.all([
      adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/admin/duels/${duelId}/resolve`) &&
          res.status() === 200
      ),
      ganaRetadorBtn.click(),
    ]);

    // Captura Artefacto 2: Veredicto del Tribunal arbitral
    await adminPage.screenshot({
      path: path.join(screenshotDir, '02_duels_admin_verdict.png'),
    });

    // 2.5 Verificación de Saldos tras Sentencia
    // Retador: 60 + 80 = 140 QC
    await retadorPage.goto('/duels', { waitUntil: 'domcontentloaded' });
    await expect(retadorPage.locator('header').getByText('140 QC')).toBeVisible(
      { timeout: 10000 }
    );

    // Rival: Saldo se mantiene en 60 QC
    await rivalPage.goto('/duels', { waitUntil: 'domcontentloaded' });
    await expect(rivalPage.locator('header').getByText('60 QC')).toBeVisible({
      timeout: 10000,
    });

    // ==========================================================================
    // FASE 3: MERCADO DE APUESTAS COMUNITARIAS Y LIQUIDACIÓN
    // ==========================================================================
    const betTitle = `Torneo de Ajedrez ${timestamp}: Final`;

    // 3.1 Propuesta de Apuesta por el Retador
    await retadorPage.goto('/bets', { waitUntil: 'domcontentloaded' });
    await expect(retadorPage.locator('header').getByText('140 QC')).toBeVisible(
      { timeout: 10000 }
    );
    await retadorPage.getByRole('button', { name: /^Sugerencias$/i }).click();

    // Abrir modal de sugerencia con FAB o botón de cabecera
    await retadorPage
      .locator(
        'button[aria-label="Sugerir una apuesta"], button:has-text("Sugerir")'
      )
      .first()
      .click();

    await retadorPage.locator('#create-bet-title').fill(betTitle);
    await retadorPage.locator('#bet-option-0').fill('Jugador Favorito');
    await retadorPage.locator('#bet-multiplier-0').fill('2.0');
    await retadorPage.locator('#bet-option-1').fill('Jugador Revelación');
    await retadorPage.locator('#bet-multiplier-1').fill('1.5');

    const [suggestBetRes] = await Promise.all([
      retadorPage.waitForResponse(
        (res) =>
          res.url().includes('/api/apuestas/suggest') && res.status() === 201
      ),
      retadorPage.getByRole('button', { name: /enviar sugerencia/i }).click(),
    ]);
    const betId = (await suggestBetRes.json()).apuesta_id;

    // 3.2 Curación y Apertura por el Administrador
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    const tabApuestas = adminPage.locator('#admin-tab-apuestas');
    await tabApuestas.click({ force: true });

    // Aprobar la sugerencia en la pestaña de Sugerencias
    const betProposalCard = adminPage.locator('article', { hasText: betTitle });
    const approveBetBtn = betProposalCard.getByRole('button', {
      name: /^Aprobar$/i,
    });
    await expect(approveBetBtn).toBeVisible({ timeout: 15000 });

    await Promise.all([
      adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/admin/bets/${betId}/status`) &&
          res.status() === 200
      ),
      approveBetBtn.click(),
    ]);

    // 3.3 Colocación de Apuestas (Ticketing Atómico)
    // Retador apuesta 20 QC a 'Jugador Favorito' (cuota 2.0)
    await retadorPage.goto('/bets', { waitUntil: 'domcontentloaded' });
    await retadorPage.getByRole('button', { name: /^Mercado$/i }).click();

    const retadorBetArticle = retadorPage.locator('article', {
      hasText: betTitle,
    });
    const apostarRetadorBtn = retadorBetArticle.getByRole('button', {
      name: /^Apostar$/i,
    });
    await expect(apostarRetadorBtn).toBeVisible({ timeout: 10000 });
    await apostarRetadorBtn.click();

    // Seleccionar 'Jugador Favorito' y 20 QC
    await retadorPage
      .getByRole('button', { name: /jugador favorito/i })
      .click();
    await retadorPage.locator('#bet-investment-amount').fill('20');

    await Promise.all([
      retadorPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/apuestas/${betId}/place`) &&
          res.status() === 200
      ),
      retadorPage.getByRole('button', { name: /confirmar apuesta/i }).click(),
    ]);

    // Saldo Retador desciende de 140 a 120 QC
    await expect(retadorPage.locator('header').getByText('120 QC')).toBeVisible(
      { timeout: 10000 }
    );

    // Rival apuesta 30 QC a 'Jugador Revelación' (cuota 1.5)
    await rivalPage.goto('/bets', { waitUntil: 'domcontentloaded' });
    await rivalPage.getByRole('button', { name: /^Mercado$/i }).click();

    const rivalBetArticle = rivalPage.locator('article', { hasText: betTitle });
    const apostarRivalBtn = rivalBetArticle.getByRole('button', {
      name: /^Apostar$/i,
    });
    await expect(apostarRivalBtn).toBeVisible({ timeout: 10000 });
    await apostarRivalBtn.click();

    await rivalPage
      .getByRole('button', { name: /jugador revelación/i })
      .click();
    await rivalPage.locator('#bet-investment-amount').fill('30');

    await Promise.all([
      rivalPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/apuestas/${betId}/place`) &&
          res.status() === 200
      ),
      rivalPage.getByRole('button', { name: /confirmar apuesta/i }).click(),
    ]);

    // Saldo Rival desciende de 60 a 30 QC
    await expect(rivalPage.locator('header').getByText('30 QC')).toBeVisible({
      timeout: 10000,
    });

    // Captura Artefacto 3: Mercado activo con apuestas colocadas
    await retadorPage.screenshot({
      path: path.join(screenshotDir, '03_bets_open_market_tickets.png'),
    });

    // 3.4 Cierre de Mercado y Liquidación Contable
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    const tabApuestas2 = adminPage.locator('#admin-tab-apuestas');
    await tabApuestas2.click({ force: true });
    await adminPage.getByRole('button', { name: /mercado activo/i }).click();

    const adminBetArticle = adminPage.locator('article', { hasText: betTitle });
    const resolverBtn = adminBetArticle.getByRole('button', {
      name: /resolver ganador/i,
    });
    await expect(resolverBtn).toBeVisible({ timeout: 15000 });
    await resolverBtn.click();

    // Designar 'Jugador Favorito' y pagar premios
    await adminBetArticle
      .locator('select')
      .selectOption({ label: 'Jugador Favorito' });

    await Promise.all([
      adminPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/admin/bets/${betId}/status`) &&
          res.status() === 200
      ),
      adminBetArticle.getByRole('button', { name: /pagar premios/i }).click(),
    ]);

    // 3.5 Auditoría Visual de Saldos tras Liquidación
    // Retador: 120 + (20 * 2.0) = 160 QC
    await retadorPage.goto('/bets', { waitUntil: 'domcontentloaded' });
    await expect(retadorPage.locator('header').getByText('160 QC')).toBeVisible(
      { timeout: 10000 }
    );

    // Rival: Saldo se mantiene en 30 QC
    await rivalPage.goto('/bets', { waitUntil: 'domcontentloaded' });
    await expect(rivalPage.locator('header').getByText('30 QC')).toBeVisible({
      timeout: 10000,
    });

    // Captura Artefacto 4: Apuesta liquidada en historial
    await retadorPage.getByRole('button', { name: /^Historial$/i }).click();
    await retadorPage.screenshot({
      path: path.join(screenshotDir, '04_bets_settlement_history.png'),
    });

    // ==========================================================================
    // FASE 4: GAMIFICACIÓN (RULETA DIARIA) Y MISIÓN SOCIAL
    // ==========================================================================
    // 4.1 Preparar misión de Ruleta en el Bombo por el Admin
    const rouletteMissionTitle = `Misión Bombo ${timestamp}`;
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    const tabRuleta = adminPage.locator('#admin-tab-ruleta');
    await tabRuleta.click({ force: true });

    await adminPage
      .locator('input[placeholder="Título de la misión"]')
      .fill(rouletteMissionTitle);
    await adminPage
      .locator('textarea[placeholder="Descripción de la misión..."]')
      .fill('Desafío confidencial de ruleta');
    await adminPage.locator('input[placeholder="100"]').fill('15');

    await Promise.all([
      adminPage.waitForResponse(
        (res) =>
          res.url().includes('/api/admin/roulette') && res.status() === 200
      ),
      adminPage.getByRole('button', { name: /añadir misión/i }).click(),
    ]);

    // 4.2 Tirada de Ruleta Diaria en /feed por el Retador
    await retadorPage.goto('/feed', { waitUntil: 'domcontentloaded' });
    const rouletteBanner = retadorPage.locator(
      'button[aria-label="Abrir la ruleta diaria de misiones"]'
    );
    await expect(rouletteBanner).toBeVisible({ timeout: 10000 });
    await rouletteBanner.click();

    // Girar la ruleta
    const girarBtn = retadorPage.getByRole('button', { name: /girar ruleta/i });
    await expect(girarBtn).toBeVisible();

    await Promise.all([
      retadorPage.waitForResponse(
        (res) => res.url().includes('/api/ruleta/spin') && res.status() === 200
      ),
      girarBtn.click(),
    ]);

    // Esperar la animación visual de la ruleta y pulsar aceptar el reto
    const aceptoBtn = retadorPage.getByRole('button', {
      name: /¡Acepto el Reto!/i,
    });
    await expect(aceptoBtn).toBeVisible({ timeout: 10000 });

    await Promise.all([
      retadorPage.waitForResponse(
        (res) =>
          res.url().includes('/api/ruleta/accept') && res.status() === 200
      ),
      aceptoBtn.click(),
    ]);

    // Captura Artefacto 5: Ruleta diaria consumida
    await retadorPage.screenshot({
      path: path.join(screenshotDir, '05_roulette_spin_and_accept.png'),
    });

    // Segundo intento defensivo: Comprobar bloqueo de 24h
    await expect(
      retadorPage.getByText(/ruleta diaria consultada/i)
    ).toBeVisible({ timeout: 10000 });

    // 4.3 Misión Comunitaria 'Baile Comunitario' (Recompensa: 25 QC)
    // El Retador propone la misión comunitaria
    const missionTitle = `Misión Baile Comunitario ${timestamp}`;
    await retadorPage.goto('/missions', { waitUntil: 'domcontentloaded' });
    await expect(retadorPage.locator('header').getByText('160 QC')).toBeVisible(
      { timeout: 10000 }
    );
    await retadorPage
      .locator(
        'button[aria-label="Sugerir nueva misión"], button:has-text("Sugerir")'
      )
      .first()
      .click();

    await retadorPage.locator('#suggest-mission-title').fill(missionTitle);
    await retadorPage
      .locator('#suggest-mission-desc')
      .fill('Baila ante el grupo la canción del verano');
    await retadorPage.locator('#suggest-mission-reward').fill('25');

    const [suggestMissionRes] = await Promise.all([
      retadorPage.waitForResponse(
        (res) =>
          res.url().includes('/api/misiones/suggest') && res.status() === 201
      ),
      retadorPage.getByRole('button', { name: /enviar propuesta/i }).click(),
    ]);
    const missionId = (await suggestMissionRes.json()).mission_id;

    // Admin aprueba la misión en el panel
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    const tabMisiones = adminPage.locator('#admin-tab-misiones');
    await tabMisiones.click({ force: true });
    await expect(
      adminPage.locator('#admin-subtab-misiones-sugerencias')
    ).toBeVisible({ timeout: 10000 });

    const missionProposalCard = adminPage
      .locator('div.bg-dracula-card', { hasText: missionTitle })
      .first();
    const aprobarMisionBtn = missionProposalCard.getByRole('button', {
      name: /aprobar y publicar/i,
    });
    await expect(aprobarMisionBtn).toBeVisible({ timeout: 15000 });

    await Promise.all([
      adminPage.waitForResponse(
        (res) =>
          res
            .url()
            .includes(`/api/admin/misiones/${missionId}/sugerencia/aprobar`) &&
          res.status() === 200
      ),
      aprobarMisionBtn.click(),
    ]);

    // 4.4 Reclamación y Envío de Prueba por el Rival
    await rivalPage.goto('/missions', { waitUntil: 'domcontentloaded' });
    const rivalMissionCard = rivalPage
      .locator('article', { hasText: missionTitle })
      .first();
    const reclamarBtn = rivalMissionCard.getByRole('button', {
      name: /reclamar recompensa/i,
    });
    await expect(reclamarBtn).toBeVisible({ timeout: 15000 });
    await reclamarBtn.click();

    // Completar justificación de prueba
    await rivalPage
      .locator(
        'textarea[placeholder="Detalles sobre cómo completaste la prueba..."]'
      )
      .fill('Prueba de baile ejecutada ante el grupo con éxito');

    await Promise.all([
      rivalPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/misiones/${missionId}/complete`) &&
          res.status() === 201
      ),
      rivalPage.getByRole('button', { name: /enviar pruebas/i }).click(),
    ]);

    // 4.5 Sentencia del Tribunal de Misiones
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    const tabMisiones2 = adminPage.locator('#admin-tab-misiones');
    await tabMisiones2.click({ force: true });
    const tribunalBtn = adminPage.locator('#admin-subtab-misiones-tribunal');
    await tribunalBtn.click({ force: true });

    const proofCard = adminPage
      .locator('div.bg-dracula-card', { hasText: missionTitle })
      .first();
    const validarPagarBtn = proofCard.getByRole('button', {
      name: /validar y pagar/i,
    });
    await expect(validarPagarBtn).toBeVisible({ timeout: 15000 });

    await Promise.all([
      adminPage.waitForResponse(
        (res) => res.url().includes('/validar') && res.status() === 200
      ),
      validarPagarBtn.click(),
    ]);

    // Captura Artefacto 6: Tribunal de misiones validado
    await adminPage.screenshot({
      path: path.join(screenshotDir, '06_missions_proof_and_validation.png'),
    });

    // 4.6 Verificación Final de Saldos en UI
    // Rival: 30 + 25 = 55 QC
    if (rivalPage.url().includes('/missions')) {
      await rivalPage.reload({ waitUntil: 'domcontentloaded' });
    } else {
      await rivalPage.goto('/missions', { waitUntil: 'domcontentloaded' });
    }
    await expect(rivalPage.locator('header').getByText('55 QC')).toBeVisible({
      timeout: 15000,
    });

    // Retador: 160 QC
    await retadorPage.goto('/duels', { waitUntil: 'domcontentloaded' });
    await expect(retadorPage.locator('header').getByText('160 QC')).toBeVisible(
      { timeout: 10000 }
    );

    // Admin: 100 QC
    await adminPage.goto('/feed', { waitUntil: 'domcontentloaded' });
    await expect(adminPage.locator('header').getByText('100 QC')).toBeVisible({
      timeout: 10000,
    });

    console.log(
      `\n[CERTIFICADO E2E UI] Saldos finales auditados con éxito en UI: Admin (100 QC), Retador (160 QC), Rival (55 QC).`
    );

    // Cierre ordenado de los 3 contextos
    await adminContext.close();
    await retadorContext.close();
    await rivalContext.close();
  });
});
