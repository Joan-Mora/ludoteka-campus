import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type TestInfo } from '@playwright/test';
import { accounts, forbiddenByRole, labPassword, publicRoutes, ROLES, routesByRole, shotsDir, slug, storageFor, type E2ERole } from './accounts';

async function shoot(page: Page, info: TestInfo, name: string) {
  const dir = path.join(shotsDir, info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function checkPage(page: Page, info: TestInfo, route: string, name: string, errors: string[]) {
  errors.length = 0;
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByText('Abriendo Ludoteka Campus')).toHaveCount(0);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect.soft(overflow, `${route}: desborde horizontal de ${overflow}px`).toBeLessThanOrEqual(1);
  await shoot(page, info, name);
  expect(errors, `${route}: errores de JavaScript`).toEqual([]);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to (load|connect|execute|apply|frame)/i.test(message.text())) errors.push(`CSP: ${message.text()}`);
  });
  return errors;
}

test.describe('público', () => {
  for (const route of publicRoutes) {
    test(`ruta ${route}`, async ({ page }, info) => {
      const errors = watchErrors(page);
      await checkPage(page, info, route, `publico-${slug(route)}`, errors);
    });
  }
});

test('ingreso con contraseña y código', async ({ page }, info) => {
  test.skip(info.project.name !== 'android' || (process.env.E2E_TARGET ?? 'local') !== 'local', 'una sola vez, contra el servidor local');
  await page.goto('/ingresar');
  await page.getByLabel('Correo institucional').fill(accounts.student);
  await page.getByLabel('Contraseña').fill(labPassword());
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await page.getByRole('button', { name: /Código de desarrollo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await shoot(page, info, 'ingreso-codigo');
});

async function signedContext(browser: Browser, info: TestInfo, role: E2ERole, overrides: BrowserContextOptions = {}): Promise<BrowserContext | null> {
  const storage = storageFor(role);
  if (!existsSync(storage)) return null;
  const { baseURL, ...use } = info.project.use;
  const context = await browser.newContext({ ...use, baseURL, storageState: storage, ...overrides });
  const login = await context.request.post('/api/auth/login', { data: { email: accounts[role], password: labPassword() } });
  const body = login.ok() ? ((await login.json()) as { accessToken?: string }) : {};
  if (!body.accessToken) {
    await context.close();
    return null;
  }
  await context.addInitScript((token) => sessionStorage.setItem('eq_access', token), body.accessToken);
  return context;
}

const VIRTUAL_AUTHENTICATOR = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } as const;

test('llave de acceso: registrar en Ajustes y entrar sin contraseña', async ({ browser }, info) => {
  test.skip(info.project.name !== 'android' || (process.env.E2E_TARGET ?? 'local') !== 'local', 'autenticador virtual de Chromium, contra el servidor local');
  const signed = await signedContext(browser, info, 'teacher');
  test.skip(!signed, 'sin sesión de docente');
  const page = await signed!.newPage();
  const cdp = await signed!.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const first = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: VIRTUAL_AUTHENTICATOR });
  await page.goto('/app/ajustes?seccion=seguridad');
  await page.getByRole('button', { name: /^Agregar/ }).click();
  await expect(page.getByText('Listo. La próxima vez podrás entrar')).toBeVisible();
  await shoot(page, info, 'passkey-registrada');
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId: first.authenticatorId });
  expect(credentials).toHaveLength(1);
  await signed!.close();

  const { baseURL, ...use } = info.project.use;
  const fresh = await browser.newContext({ ...use, baseURL });
  const login = await fresh.newPage();
  const cdp2 = await fresh.newCDPSession(login);
  await cdp2.send('WebAuthn.enable');
  const second = await cdp2.send('WebAuthn.addVirtualAuthenticator', { options: VIRTUAL_AUTHENTICATOR });
  await cdp2.send('WebAuthn.addCredential', { authenticatorId: second.authenticatorId, credential: credentials[0] });
  await login.goto('/ingresar');
  await login.getByRole('button', { name: /^Entrar con/ }).click();
  await expect(login).toHaveURL(/\/app$/);
  await shoot(login, info, 'passkey-ingreso');

  login.on('dialog', (dialog) => dialog.accept());
  await login.goto('/app/ajustes?seccion=seguridad');
  const remove = login.getByRole('button', { name: /^Quitar / });
  await expect(remove).toHaveCount(1);
  await remove.click();
  await expect(login.getByText('Aún no tienes llaves de acceso')).toBeVisible();
  await fresh.close();
});

test.describe('aprendizaje del estudiante', () => {
  test('Mi espacio: seis métodos con navegación libre', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    await page.goto('/app/aprender');
    const tabs = page.getByRole('tablist', { name: 'Formas de aprender' }).getByRole('tab');
    await expect(tabs).toHaveCount(6);
    await tabs.filter({ hasText: 'Visual' }).click();
    await expect(tabs.filter({ hasText: 'Visual' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/metodo=visual/);
    await expect(page.locator('.manipulative')).toBeVisible({ timeout: 15_000 });
    await shoot(page, info, 'estudiante-mi-espacio-visual');
    expect(errors).toEqual([]);
    await signed!.close();
  });

  test('Arcade: diez juegos, reto del día y respuesta calificada en el servidor', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    await page.goto('/app/jugar');
    await expect(page.locator('article.arcade')).toHaveCount(10, { timeout: 15_000 });
    await expect(page.getByText('Reto del día').first()).toBeVisible();
    await page.locator('article.arcade').filter({ hasText: 'Carrera numérica' }).getByRole('button', { name: 'Jugar' }).click();
    await page.locator('.board-input').fill('0');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.runner-feedback')).toBeVisible();
    await shoot(page, info, 'estudiante-arcade-partida');
    await page.getByRole('button', { name: 'Salir del juego' }).click();
    await expect(page.locator('.arcade-grid')).toBeVisible();
    expect(errors).toEqual([]);
    await signed!.close();
  });

  test('Sala de trofeos: estantes, niveles, secretas y temporada', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    await page.goto('/app/logros');
    await expect(page.locator('.trophy').first()).toBeVisible({ timeout: 15_000 });
    expect(await page.locator('.trophy').count()).toBeGreaterThanOrEqual(40);
    await expect(page.locator('.trophy-section')).toHaveCount(7);
    await expect(page.getByText(/^Temporada /).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Por ganar' }).click();
    await expect(page.locator('.trophy-section .trophy.tier-none').first()).toBeVisible();
    await shoot(page, info, 'estudiante-trofeos');
    expect(errors).toEqual([]);
    await signed!.close();
  });

  test('Pendientes del campus y notificaciones navegables', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    await page.goto('/app');
    const badge = page.locator('.pending-btn').first();
    if (await badge.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await badge.click();
      const pop = page.locator('.pending-pop').first();
      await expect(pop).toBeVisible();
      await expect(pop.getByRole('button', { name: /^Abrir / })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(pop).toBeHidden();
    }
    await page.goto('/app/notificaciones');
    await expect(page.locator('.notes-filters')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /Sin leer/ })).toBeVisible();
    await page.getByRole('tab', { name: /Sin leer/ }).click();
    await expect(page.locator('.notes-item, .empty').first()).toBeVisible();
    await shoot(page, info, 'estudiante-notificaciones');
    expect(errors).toEqual([]);
    await signed!.close();
  });

  test('Voz: panel «Qué puedo decir» y comandos con texto libre', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    const phrase = async (text: string) => {
      await page.getByRole('button', { name: 'Comandos de voz' }).first().click({ button: 'right' });
      await page.getByRole('dialog', { name: 'Qué puedo decir' }).getByRole('button', { name: new RegExp(text) }).click();
    };
    await page.goto('/app');
    await page.getByRole('button', { name: 'Comandos de voz' }).first().click({ button: 'right' });
    await expect(page.getByRole('dialog', { name: 'Qué puedo decir' })).toBeVisible();
    await page.keyboard.press('Escape');
    await phrase('busca en la biblioteca');
    await expect(page).toHaveURL(/\/app\/biblioteca\?q=/);
    await expect(page.locator('.lib-search input')).toHaveValue(/fotos/);
    await phrase('empieza un reto de fracciones');
    await expect(page.getByText(/Ronda 1 de/)).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
    await signed!.close();
  });

  test('Biblioteca por grado: guías del curso y documentos con fuente y licencia', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    await page.goto('/app/biblioteca');
    await page.getByRole('group', { name: 'Grado' }).getByRole('button', { name: 'Sexto' }).click();
    const cards = page.locator('.lib-card');
    await expect(cards.filter({ hasText: '· 6.°' }).first()).toBeVisible({ timeout: 15_000 });
    expect(await cards.filter({ hasText: /· (7|8|9|10|11)\.°/ }).count()).toBe(0);
    await cards.filter({ hasText: 'Derechos Básicos de Aprendizaje de Matemáticas' }).first().click();
    const origin = page.locator('.lib-origin');
    await expect(origin).toContainText('Ministerio de Educación Nacional');
    await expect(origin).toContainText('Licencia');
    await expect(page.locator('.lib-external')).toBeVisible();
    await shoot(page, info, 'estudiante-biblioteca-fuente');
    expect(errors).toEqual([]);
    await signed!.close();
  });

  test('Mi ruta: sendero con paradas, panel y jefe', async ({ browser }, info) => {
    test.skip(info.project.name !== 'android', 'una vez basta');
    const signed = await signedContext(browser, info, 'student');
    test.skip(!signed, 'sin sesión de estudiante');
    const page = await signed!.newPage();
    const errors = watchErrors(page);
    await page.goto('/app/ruta');
    const nodes = page.locator('.trail-node');
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 });
    expect(await nodes.count()).toBeGreaterThanOrEqual(10);
    await nodes.first().click();
    await expect(page).toHaveURL(/tema=/);
    await expect(page.locator('.topic-panel').getByRole('button', { name: /Reto jefe/ })).toBeVisible();
    await shoot(page, info, 'estudiante-sendero');
    expect(errors).toEqual([]);
    await signed!.close();
  });
});

test('Foro: mención, adjunto, reacción, mejor respuesta y resumen de Luka', async ({ browser }, info) => {
  test.skip(info.project.name !== 'android', 'una vez basta');
  test.setTimeout(120_000);
  const teacher = await signedContext(browser, info, 'teacher');
  const student = await signedContext(browser, info, 'student');
  test.skip(!teacher || !student, 'sin sesiones de docente y estudiante');
  const teacherPage = await teacher!.newPage();
  const studentPage = await student!.newPage();
  const errors = watchErrors(studentPage);
  const token = (page: Page) => page.evaluate(() => sessionStorage.getItem('eq_access'));
  await teacherPage.goto('/app');
  await studentPage.goto('/app');
  const auth = async (page: Page) => ({ Authorization: `Bearer ${await token(page)}` });

  const courses = (await (await teacher!.request.get('/api/courses', { headers: await auth(teacherPage) })).json()) as { id: string }[];
  const created = await teacher!.request.post(`/api/courses/${courses[0]!.id}/forum`, {
    headers: await auth(teacherPage),
    data: { title: `Prueba e2e ${Date.now()}`, body: '¿Cómo ordenan los números enteros en la recta?' },
  });
  expect(created.ok()).toBeTruthy();
  const thread = (await created.json()) as { id: string };

  try {
    await studentPage.goto(`/app/novedades?hilo=${thread.id}`);
    const box = studentPage.locator('.forum-composer textarea');
    await box.fill('Gracias @');
    const option = studentPage.getByRole('listbox', { name: 'Personas del curso' }).getByRole('option').first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    const teacherName = (await option.locator('.mention-name').innerText()).trim();
    await option.getByRole('button').click();
    await box.press('End');
    await box.pressSequentially('los negativos van a la izquierda del cero.');
    await studentPage.getByRole('button', { name: 'Adjuntar de la biblioteca' }).click();
    await studentPage.getByLabel('Buscar en la biblioteca').fill('Enteros y racionales');
    await studentPage.locator('.forum-picker button').filter({ hasText: 'Enteros y racionales' }).first().click();
    await expect(studentPage.locator('.forum-attachments .chip')).toHaveCount(1);
    await studentPage.getByRole('button', { name: 'Responder' }).click();
    const post = studentPage.locator('.post').last();
    await expect(post.locator('.mention')).toHaveText(`@${teacherName}`, { timeout: 15_000 });
    await expect(post.locator('.forum-attachments a')).toHaveCount(1);
    await shoot(studentPage, info, 'estudiante-foro-mencion');

    await teacherPage.goto(`/app/novedades?hilo=${thread.id}`);
    const reply = teacherPage.locator('.post').last();
    await reply.getByRole('button', { name: 'Me sirvió' }).click();
    await expect(reply.getByRole('button', { name: 'Me sirvió: 1' })).toHaveAttribute('aria-pressed', 'true');
    await reply.getByRole('button', { name: 'Marcar respuesta' }).click();
    await expect(reply.getByText('Respuesta', { exact: true })).toBeVisible();
    await teacherPage.getByRole('button', { name: /^Pedir resumen a/ }).click();
    await expect(teacherPage.locator('.forum-digest-body, .forum-digest .muted').first()).toBeVisible({ timeout: 60_000 });
    await expect(teacherPage.getByRole('button', { name: 'Actualizar' })).toBeVisible({ timeout: 60_000 });
    await shoot(teacherPage, info, 'docente-foro-resumen');

    const notes = (await (await student!.request.get('/api/notifications', { headers: await auth(studentPage) })).json()) as { items?: { title: string }[] } | { title: string }[];
    const titles = (Array.isArray(notes) ? notes : notes.items ?? []).map((n) => n.title);
    expect(titles).toContain('Tu respuesta fue la mejor');
    expect(errors).toEqual([]);
  } finally {
    await teacher!.request.delete(`/api/forum/threads/${thread.id}`, { headers: await auth(teacherPage) });
    await teacher!.close();
    await student!.close();
  }
});

const CAMPUS_SIZES = [[1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]] as const;
/** Each page and the material its facade must show (null: home, where the pin rests on the plaza). */
const CAMPUS_PAGES = [
  ['/app', null], ['/app/biblioteca', 'papel'], ['/app/cursos', 'pizarra'], ['/app/tutor', 'cuadricula'], ['/app/arena', 'neon'], ['/app/jugar', 'neon'],
  ['/app/novedades', 'corcho'], ['/app/cuaderno', 'rayado'], ['/app/ruta', 'topografia'], ['/app/logros', 'laton'],
] as const;

async function deskContext(browser: Browser, info: TestInfo, width: number, height: number, dark: boolean) {
  const context = await signedContext(browser, info, 'student', {
    viewport: { width, height },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    userAgent: undefined,
    colorScheme: dark ? 'dark' : 'light',
  });
  await context?.addInitScript((theme) => localStorage.setItem('lk_theme', theme), dark ? 'dark' : 'light');
  return context;
}

test.describe('Campus: fachadas y mapa en cada resolución y tema', () => {
  for (const dark of [false, true]) {
    const theme = dark ? 'oscuro' : 'claro';
    test(`tema ${theme}`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'android', 'una vez basta: la prueba fija el tamaño de la ventana');
      test.setTimeout(420_000);
      // One session per theme: logins are rate limited per account.
      const context = await deskContext(browser, info, CAMPUS_SIZES[0][0], CAMPUS_SIZES[0][1], dark);
      test.skip(!context, 'sin sesión de estudiante');
      const page = await context!.newPage();
      const errors = watchErrors(page);
      for (const [width, height] of CAMPUS_SIZES) {
        await page.setViewportSize({ width, height });
        for (const [route, material] of CAMPUS_PAGES) {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          const map = page.getByRole('navigation', { name: 'Mapa del campus' });
          await expect(map, `${width}px ${route}: mini mapa`).toBeVisible({ timeout: 20_000 });
          if (material) {
            await expect(page.locator('.facade').first(), `${width}px ${route}: material`).toHaveClass(new RegExp(`\\bm-${material}\\b`), { timeout: 20_000 });
            await expect(map.locator('.mini-b.here')).toHaveCount(1);
          } else {
            await expect(map.locator('.mini-here')).toContainText('la plaza');
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect.soft(overflow, `${width}px ${route}: desborde horizontal de ${overflow}px`).toBeLessThanOrEqual(1);
          await page.waitForTimeout(700);
          await shoot(page, info, `campus-${width}-${theme}-${slug(route)}`);
        }
        expect(errors, `${width}px: errores de JavaScript`).toEqual([]);
      }
      await context!.close();
    });
  }
});

test('Campus: entrar al edificio desde el mini mapa y el menú', async ({ browser }, info) => {
  test.skip(info.project.name !== 'android', 'una vez basta');
  const context = await deskContext(browser, info, 1440, 900, false);
  test.skip(!context, 'sin sesión de estudiante');
  const page = await context!.newPage();
  const errors = watchErrors(page);
  await page.goto('/app/cursos');
  await expect(page.locator('.page-head.facade.m-pizarra')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-mini="biblioteca"]').click();
  await expect(page).toHaveURL(/\/app\/biblioteca$/);
  await expect(page.locator('.page-head.facade.m-papel')).toBeVisible();
  await expect(page.locator('.mini-here')).toContainText('Biblioteca');
  await page.locator('.nav a[href="/app/arena"]').click();
  await expect(page).toHaveURL(/\/app\/arena$/);
  await expect(page.locator('.page-head.facade.m-neon')).toBeVisible();
  await expect(page.locator('.enter-ghost')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/entering/);
  await shoot(page, info, 'campus-entrar-arena');
  expect(errors).toEqual([]);
  await context!.close();
});

for (const role of ROLES) {
  test.describe(`rol ${role}`, () => {
    test.describe.configure({ mode: 'serial' });
    let context: BrowserContext | null = null;
    let page: Page;
    let errors: string[] = [];

    test.beforeAll(async ({ browser }, info) => {
      context = await signedContext(browser, info, role);
      if (!context) return;
      page = await context.newPage();
      errors = watchErrors(page);
    });

    test.afterAll(async () => {
      await context?.close();
    });

    for (const route of routesByRole[role]) {
      test(`ruta ${route}`, async ({}, info) => {
        test.skip(!context, `sin sesión para ${role} (OTP sin código de desarrollo)`);
        await checkPage(page, info, route, `${role}-${slug(route)}`, errors);
        await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`));
      });
    }

    test('rutas de otros roles', async ({}, info) => {
      test.skip(!context, `sin sesión para ${role}`);
      test.skip(info.project.name !== 'android', 'el permiso no depende del dispositivo');
      for (const route of forbiddenByRole[role]) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Esta sección no es para tu rol'), `${role} no debe abrir ${route}`).toBeVisible({ timeout: 15_000 });
      }
      await shoot(page, info, `${role}-no-permitido`);
    });

    test('menú Más en el teléfono', async ({}, info) => {
      test.skip(!context, `sin sesión para ${role}`);
      test.skip(!info.project.use.isMobile || info.project.name === 'ipad', 'solo teléfonos');
      await page.goto('/app');
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Más' }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('button', { name: 'Salir' })).toBeVisible();
      await page.waitForTimeout(400);
      await shoot(page, info, `${role}-mas`);
    });
  });
}
