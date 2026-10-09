import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { accounts, labPassword, publicRoutes, ROLES, routesByRole, shotsDir, slug, storageFor, type E2ERole } from './accounts';

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

async function signedContext(browser: Browser, info: TestInfo, role: E2ERole): Promise<BrowserContext | null> {
  const storage = storageFor(role);
  if (!existsSync(storage)) return null;
  const { baseURL, ...use } = info.project.use;
  const context = await browser.newContext({ ...use, baseURL, storageState: storage });
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
