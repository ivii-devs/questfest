import { test, expect } from '@playwright/test';

/**
 * ==============================================================================
 * TEST E2E EXHAUSTIVO (NIVEL 2): EXPERIENCIA MOBILE-FIRST PWA Y MULTI-ACTOR
 * ==============================================================================
 * Este test ejerce la interfaz de usuario en dispositivo móvil emulado (Pixel 7).
 * 
 * Principios aplicados (.agents/context/testing-standards.md):
 * 1. Multi-Actor: Simula dos contextos de navegador completamente aislados (Admin y Miembro).
 * 2. Inyección de Fallos: Intento deliberado de unión con credencial incorrecta en UI.
 * 3. Nomenclatura Funcional: Todos los identificadores son semánticos y dinámicos (cero nombres informales).
 * 4. Verificación Black-Box: Localizadores basados en accesibilidad (getByRole, getByLabel).
 * 5. Artefacto Reproducible: Trazas de red, capturas e informe generado al concluir.
 * ==============================================================================
 */

test.describe('Escenario E2E Exhaustivo: Ciclo de Grupo Protegido y Navegación PWA', () => {
  const timestamp = Date.now();
  const adminUsername = `Usuario_Admin_${timestamp}`;
  const memberUsername = `Usuario_Miembro_${timestamp}`;
  const userPassword = 'Password_Seguro_123';
  const groupName = `Grupo_E2E_Protegido_${timestamp}`;
  const validGroupPassword = 'Credencial_Acceso_Valida_77';
  const invalidGroupPassword = 'Credencial_Acceso_Invalida_00';

  test('debe permitir registro de admin, creación de grupo protegido, rechazo por credencial errónea y unión válida de miembro', async ({ browser }) => {
    // Extendemos el timeout para absorber llamadas de red sobre la base de datos remota
    test.setTimeout(60000);

    // --------------------------------------------------------------------------
    // PASO 1: CONTEXTO DEL USUARIO_ADMIN - REGISTRO E INICIO DE SESIÓN
    // --------------------------------------------------------------------------
    // Instanciamos el contexto aislado para el administrador
    const adminContext = await browser.newContext();
    // Pre-descartamos el aviso de instalación PWA para evitar oclusión de botones en Safari/iOS
    await adminContext.addInitScript(() => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    });
    const adminPage = await adminContext.newPage();

    // Navegamos a la pantalla de registro
    await adminPage.goto('/register');
    await expect(adminPage.getByRole('heading', { name: /nuevo jugador/i })).toBeVisible();

    // Rellenamos el formulario de alta con credenciales funcionales asegurando hidratación
    await adminPage.locator('#register-username').click();
    await adminPage.locator('#register-username').pressSequentially(adminUsername, { delay: 15 });
    await adminPage.locator('#register-password').fill(userPassword);
    await adminPage.locator('#register-confirm-password').fill(userPassword);

    // Enviamos el registro y esperamos la confirmación del login y navegación al Hub
    await Promise.all([
      adminPage.waitForResponse(res => res.url().includes('/api/auth/login') && res.status() === 200),
      adminPage.getByRole('button', { name: /registrarme/i }).click(),
    ]);
    await adminPage.waitForURL(url => url.pathname.includes('/groups') || url.pathname === '/', { waitUntil: 'commit', timeout: 15000 });

    // Si nos deja en la raíz '/', nos aseguramos de estar en '/groups'
    if (!adminPage.url().includes('/groups')) {
      await adminPage.goto('/groups');
    }
    await expect(adminPage.getByText(/questfest hub/i)).toBeVisible({ timeout: 10000 });

    // --------------------------------------------------------------------------
    // PASO 2: CREACIÓN DE GRUPO PROTEGIDO POR CONTRASEÑA
    // --------------------------------------------------------------------------
    // Abrimos el modal de creación de comunidades
    await adminPage.getByRole('button', { name: /crear grupo/i }).first().click();

    // Rellenamos los datos del nuevo grupo
    await adminPage.locator('#create-group-name').fill(groupName);
    await adminPage.locator('#create-group-desc').fill('Entidad de prueba automatizada E2E');

    // Activamos la protección por contraseña mediante el checkbox
    await adminPage.locator('input[type="checkbox"]').check();
    await adminPage.locator('#create-group-password').fill(validGroupPassword);

    // Interceptamos la respuesta de la API para obtener el código único generado
    const [createGroupResponse] = await Promise.all([
      adminPage.waitForResponse(res => res.url().includes('/api/groups') && res.request().method() === 'POST' && res.status() === 201),
      adminPage.locator('form').getByRole('button', { name: /^Crear Grupo$/i }).click(),
    ]);

    const createdGroupData = await createGroupResponse.json();
    const groupCode = createdGroupData.codigo_unico;
    expect(groupCode).toMatch(/^QF-[A-Z0-9]{5,6}$/);

    // Verificamos que la tarjeta del grupo recién creado aparece visible en el dashboard
    await expect(adminPage.getByText(groupName).first()).toBeVisible({ timeout: 10000 });

    // --------------------------------------------------------------------------
    // PASO 3: CONTEXTO DEL USUARIO_MIEMBRO - REGISTRO E INYECCIÓN DE FALLOS
    // --------------------------------------------------------------------------
    // Creamos un segundo contexto de navegador totalmente independiente (sesión limpia)
    const memberContext = await browser.newContext();
    // Pre-descartamos el aviso de instalación PWA para evitar oclusión de botones en Safari/iOS
    await memberContext.addInitScript(() => {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    });
    const memberPage = await memberContext.newPage();

    await memberPage.goto('/register');
    await memberPage.locator('#register-username').click();
    await memberPage.locator('#register-username').pressSequentially(memberUsername, { delay: 15 });
    await memberPage.locator('#register-password').fill(userPassword);
    await memberPage.locator('#register-confirm-password').fill(userPassword);
    await Promise.all([
      memberPage.waitForResponse(res => res.url().includes('/api/auth/login') && res.status() === 200),
      memberPage.getByRole('button', { name: /registrarme/i }).click(),
    ]);

    await memberPage.waitForURL(url => url.pathname.includes('/groups') || url.pathname === '/', { waitUntil: 'commit', timeout: 15000 });
    if (!memberPage.url().includes('/groups')) {
      await memberPage.goto('/groups');
    }

    // Inyección de Fallo 1: Intentar unirse al grupo con contraseña incorrecta
    await memberPage.getByRole('button', { name: /unirse a grupo/i }).first().click();
    await memberPage.locator('#join-modal-code').fill(groupCode);
    await memberPage.locator('#join-modal-password').fill(invalidGroupPassword);

    // Enviamos y capturamos el rechazo 401 del backend
    const [joinFailResponse] = await Promise.all([
      memberPage.waitForResponse(res => res.url().includes('/api/groups/join') && res.status() === 401),
      memberPage.locator('form').getByRole('button', { name: /unirme/i }).click(),
    ]);
    expect(joinFailResponse.status()).toBe(401);

    // Comprobamos que el toast o mensaje de error se refleja en la interfaz
    await expect(memberPage.locator('.react-hot-toast, [role="status"], [aria-live="polite"]').first()).toBeVisible();

    // --------------------------------------------------------------------------
    // PASO 4: INCORPORACIÓN LEGÍTIMA Y TRANSICIÓN DE ESTADO AL FEED
    // --------------------------------------------------------------------------
    // Introducimos la credencial correcta
    await memberPage.locator('#join-modal-password').fill(validGroupPassword);

    const [joinSuccessResponse] = await Promise.all([
      memberPage.waitForResponse(res => res.url().includes('/api/groups/join') && res.status() === 200),
      memberPage.locator('form').getByRole('button', { name: /unirme/i }).click(),
    ]);
    expect(joinSuccessResponse.status()).toBe(200);

    // Tras unirse exitosamente, el frontend redirige automáticamente al feed del grupo
    await memberPage.waitForURL(url => url.pathname.includes('/feed'), { waitUntil: 'commit', timeout: 15000 });
    expect(memberPage.url()).toContain('/feed');

    // --------------------------------------------------------------------------
    // PASO 5: VERIFICACIÓN DE ESTÁNDARES PWA Y NAVEGACIÓN BOTTOMNAV
    // --------------------------------------------------------------------------
    // Comprobamos la presencia de la barra de navegación inferior móvil
    const bottomNav = memberPage.locator('nav.bottom-nav-glass, nav.fixed');
    await expect(bottomNav).toBeVisible();

    // Navegamos al Ranking del grupo usando el enlace de la barra inferior
    const rankingLink = bottomNav.getByRole('link', { name: /ranking/i });
    await expect(rankingLink).toBeVisible();
    await rankingLink.click();

    // Verificamos que cargó la ruta /ranking
    await memberPage.waitForURL(url => url.pathname.includes('/ranking'), { waitUntil: 'commit', timeout: 10000 });
    expect(memberPage.url()).toContain('/ranking');

    // Cierre ordenado de los contextos de prueba
    await adminContext.close();
    await memberContext.close();
  });
});
