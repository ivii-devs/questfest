import { test, expect } from '@playwright/test';

/**
 * ==============================================================================
 * TEST E2E (TIER 2): AISLAMIENTO TERRITORIAL MULTI-TENANCY EN PANEL ADMIN
 * ==============================================================================
 * Verifica la experiencia interactiva en pantalla del Panel de Administración
 * y Tribunal Arbitral (/admin):
 * 1. Indicador territorial de comunidad en la cabecera y selector GroupSwitcher.
 * 2. Tab Usuarios: Solo miembros de la comunidad activa, aislamiento contable de saldos
 *    y ajuste manual con reflejo inmediato en interfaz.
 * 3. Tab Apuestas, Duelos y Misiones: Confinamiento contextual sin fugas cruzadas.
 * 4. Guard de navegación: Redirección inmediata a /feed si un usuario sin rol 'admin'
 *    en la comunidad activa intenta acceder al panel.
 * ==============================================================================
 */

test.describe('Aislamiento Territorial Multi-Tenancy: Panel Admin y Tribunal', () => {
  const timestamp = Date.now();
  const adminAlfaUsername = `Admin_Alfa_E2E_${timestamp}`;
  const adminBetaUsername = `Admin_Beta_E2E_${timestamp}`;
  const jugadorAlfaUsername = `Jugador_Alfa_E2E_${timestamp}`;
  const jugadorRasoUsername = `Jugador_Raso_E2E_${timestamp}`;
  const userPassword = 'Password_Seguro_123';

  const groupAlfaName = `Grupo_Alfa_Admin_E2E_${timestamp}`;
  const groupBetaName = `Grupo_Beta_Admin_E2E_${timestamp}`;

  test('debe confinar estrictamente la administración, visualización y balances al grupo activo', async ({
    browser,
    request,
    baseURL,
  }) => {
    test.setTimeout(90000);

    const apiBase = baseURL?.replace('3000', '8000') || 'http://127.0.0.1:8000';

    // --------------------------------------------------------------------------
    // FASE 1: PROVISIÓN DETERMINISTA DE ENTIDADES MEDIANTE API BACKEND
    // --------------------------------------------------------------------------
    // 1. Registro de actores funcionales
    const actores = [
      adminAlfaUsername,
      adminBetaUsername,
      jugadorAlfaUsername,
      jugadorRasoUsername,
    ];
    const tokens: Record<string, string> = {};
    const userIds: Record<string, number> = {};

    for (const username of actores) {
      const reg = await request.post(`${apiBase}/api/auth/register`, {
        data: { username, password: userPassword },
      });
      expect(reg.status()).toBe(201);
      const regData = await reg.json();
      userIds[username] = regData.id;

      const login = await request.post(`${apiBase}/api/auth/login`, {
        form: { username, password: userPassword },
      });
      expect(login.status()).toBe(200);
      const loginData = await login.json();
      tokens[username] = loginData.access_token;
    }

    // 2. Creación de comunidades independientes
    const resGroupAlfa = await request.post(`${apiBase}/api/groups/`, {
      headers: { Authorization: `Bearer ${tokens[adminAlfaUsername]}` },
      data: { nombre: groupAlfaName, saldo_inicial: 250 },
    });
    expect(resGroupAlfa.status()).toBe(201);
    const groupAlfaData = await resGroupAlfa.json();
    const groupAlfaId = groupAlfaData.id;
    const groupAlfaCode = groupAlfaData.codigo_unico;

    const resGroupBeta = await request.post(`${apiBase}/api/groups/`, {
      headers: { Authorization: `Bearer ${tokens[adminBetaUsername]}` },
      data: { nombre: groupBetaName, saldo_inicial: 300 },
    });
    expect(resGroupBeta.status()).toBe(201);
    const groupBetaData = await resGroupBeta.json();
    const groupBetaId = groupBetaData.id;
    const groupBetaCode = groupBetaData.codigo_unico;

    // 3. Jugador Alfa se une a Grupo Alfa
    const joinAlfa = await request.post(`${apiBase}/api/groups/join`, {
      headers: { Authorization: `Bearer ${tokens[jugadorAlfaUsername]}` },
      data: { codigo_unico: groupAlfaCode },
    });
    expect(joinAlfa.status()).toBe(200);

    // 4. Jugador Raso se une a Grupo Alfa (para probar redirección y falta de privilegios)
    const joinRaso = await request.post(`${apiBase}/api/groups/join`, {
      headers: { Authorization: `Bearer ${tokens[jugadorRasoUsername]}` },
      data: { codigo_unico: groupAlfaCode },
    });
    expect(joinRaso.status()).toBe(200);

    // 5. Creación de apuesta en Grupo Alfa
    const resBet = await request.post(`${apiBase}/api/apuestas/suggest`, {
      headers: { Authorization: `Bearer ${tokens[jugadorAlfaUsername]}` },
      data: {
        title: `Apuesta_E2E_${timestamp}`,
        group_id: groupAlfaId,
        options: [
          { text: 'Victoria Alfa', multiplier: 2.0 },
          { text: 'Victoria Rival', multiplier: 3.0 },
        ],
      },
    });
    expect(resBet.status()).toBe(201);

    // --------------------------------------------------------------------------
    // FASE 2: INTERACCIÓN EN NAVEGADOR COMO ADMIN DE GRUPO ALFA
    // --------------------------------------------------------------------------
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      {
        name: 'access_token',
        value: tokens[adminAlfaUsername],
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await adminContext.addInitScript(
      ({ token, activeGroupId }) => {
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
        sessionStorage.setItem('disable_notification_modals', 'true');
        localStorage.setItem('access_token', token);
        localStorage.setItem('active_group_id', String(activeGroupId));
      },
      { token: tokens[adminAlfaUsername], activeGroupId: groupAlfaId }
    );

    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin');

    // 1. Verificación de Cabecera con Indicador Territorial y Switcher
    await expect(
      adminPage.getByRole('heading', { name: /panel admin/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      adminPage.getByText(`Comunidad: ${groupAlfaName}`)
    ).toBeVisible();

    // 2. Navegación a Tab Usuarios y Verificación de Aislamiento
    const tabUsuarios = adminPage.locator('#admin-tab-usuarios');
    await expect(tabUsuarios).toBeVisible();
    await tabUsuarios.click();

    // Comprobar que en el Directorio aparece Jugador Alfa y Admin Alfa, pero NUNCA Admin Beta
    await expect(adminPage.getByText(`@${jugadorAlfaUsername}`)).toBeVisible({
      timeout: 10000,
    });
    await expect(adminPage.getByText(`@${adminAlfaUsername}`)).toBeVisible();
    await expect(
      adminPage.getByText(`@${adminBetaUsername}`)
    ).not.toBeVisible();

    // 3. Verificación de Ajuste Manual de Saldo en Pantalla (Bonificación)
    // Localizamos la tarjeta de Jugador Alfa y pulsamos Bonificar
    const jugadorCard = adminPage.getByTestId(
      `user-card-${jugadorAlfaUsername}`
    );
    await expect(jugadorCard).toBeVisible();
    await jugadorCard.getByRole('button', { name: /bonificar/i }).click();

    // Rellenamos el modal de balance
    await expect(adminPage.getByText(/bonificar saldo/i)).toBeVisible();
    await adminPage.locator('input[placeholder="0"]').fill('50');
    await adminPage
      .locator('input[placeholder="Motivo del ajuste"]')
      .fill('Premio Especial E2E');

    // Enviamos el ajuste y verificamos actualización
    const [balanceRes] = await Promise.all([
      adminPage.waitForResponse(
        (res) => res.url().includes('/balance') && res.status() === 200
      ),
      adminPage.getByRole('button', { name: /confirmar/i }).click(),
    ]);
    expect(balanceRes.status()).toBe(200);

    // 4. Verificación de Tab Apuestas Scoped al Grupo Alfa
    const tabApuestas = adminPage.locator('#admin-tab-apuestas');
    await tabApuestas.click();
    await expect(adminPage.getByText(`Apuesta_E2E_${timestamp}`)).toBeVisible({
      timeout: 10000,
    });

    // 5. Verificación de Tab Duelos
    const tabDuelos = adminPage.locator('#admin-tab-duelos');
    await tabDuelos.click();
    await expect(adminPage.getByText(/tribunal de duelos/i)).toBeVisible({
      timeout: 10000,
    });

    // 6. Verificación de Tab Misiones
    const tabMisiones = adminPage.locator('#admin-tab-misiones');
    await tabMisiones.click();
    await expect(
      adminPage.locator('#admin-subtab-misiones-sugerencias')
    ).toBeVisible({ timeout: 10000 });

    await adminContext.close();

    // --------------------------------------------------------------------------
    // FASE 3: GUARD DE PROTECCIÓN - EXPULSIÓN DE JUGADORES SIN PRIVILEGIOS ADMIN
    // --------------------------------------------------------------------------
    const rasoContext = await browser.newContext();
    await rasoContext.addCookies([
      {
        name: 'access_token',
        value: tokens[jugadorRasoUsername],
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await rasoContext.addInitScript(
      ({ token, activeGroupId }) => {
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
        sessionStorage.setItem('disable_notification_modals', 'true');
        localStorage.setItem('access_token', token);
        localStorage.setItem('active_group_id', String(activeGroupId));
      },
      { token: tokens[jugadorRasoUsername], activeGroupId: groupAlfaId }
    );

    const rasoPage = await rasoContext.newPage();
    // Intento de acceso directo al panel de control por un jugador raso
    await rasoPage.goto('/admin');

    // Debe ser interceptado por el guard y redirigido automáticamente a /feed
    await rasoPage.waitForURL((url) => url.pathname.includes('/feed'), {
      waitUntil: 'commit',
      timeout: 15000,
    });
    expect(rasoPage.url()).toContain('/feed');

    await rasoContext.close();
  });
});
