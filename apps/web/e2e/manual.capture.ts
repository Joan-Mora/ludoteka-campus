import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { accounts, labPassword, storageFor, type E2ERole } from './accounts';

/**
 * Capturas del manual de usuario (docs/manuales/img/<sección>/). Corre contra la pila de Docker con CockroachDB local para
 * que solo aparezcan datos de demostración, nunca datos reales de estudiantes:
 *   docker compose -f docker-compose.yml -f docker-compose.cockroach.yml up -d --build
 *   npm run manual:shots -w @eduquest/web
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', '..', '..', 'docs', 'manuales', 'img');
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
/** The campus greeting and sky follow the clock; a school-day morning reads better than whenever the capture runs. */
const MORNING = new Date('2026-10-13T10:20:00-05:00');

/** Shifts only Date: Playwright's clock also fakes the animation frame clock, which leaves Framer Motion cards invisible. */
async function morning(context: BrowserContext) {
  await context.addInitScript((offset) => {
    const Real = Date;
    class Shifted extends Real {
      constructor(...args: [string | number | Date] | []) {
        if (args.length) super(args[0]);
        else super(Real.now() + offset);
      }
      static override now() { return Real.now() + offset; }
    }
    window.Date = Shifted as DateConstructor;
  }, MORNING.getTime() - Date.now());
}
const missing: string[] = [];

test.setTimeout(300_000);

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.getByText('Abriendo Ludoteka Campus').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(900);
}

/** One folder per section of the manual; the role prefix becomes the folder (estudiante-inicio → estudiante/inicio.png). */
const FOLDERS: [RegExp, string][] = [
  [/^(publico-inicio|ingresar.*|recuperar|cambiar-clave|aceptar-documentos)$/, 'acceso'],
  [/^(guia-recorrido|notificaciones|movil-.+)$/, 'campus'],
  [/^(ajustes-.+|acceso-facial)$/, 'cuenta'],
  [/^estudiante-/, 'estudiante'],
  [/^docente-/, 'docente'],
  [/^(coordinacion-|cartelera-publicar$)/, 'coordinacion'],
  [/^rectoria-/, 'rectoria'],
  [/^acudiente-/, 'acudiente'],
  [/^admin-/, 'administracion'],
];

function fileFor(name: string) {
  const folder = FOLDERS.find(([pattern]) => pattern.test(name))?.[1];
  if (!folder) throw new Error(`captura sin sección: ${name}`);
  return path.join(outDir, folder, `${name.replace(/^(estudiante|docente|coordinacion|rectoria|acudiente|admin)-/, '')}.png`);
}

async function shot(page: Page, name: string, fullPage = false) {
  const file = fileFor(name);
  mkdirSync(path.dirname(file), { recursive: true });
  await settle(page);
  await page.screenshot({ path: file, fullPage });
}

/** Comma-separated step names; when set, every other step is skipped (retake a single image without redoing the rest). */
const only = process.env.MANUAL_ONLY?.split(',').map((name) => name.trim()).filter(Boolean);

/** Una captura que falla no detiene las demás; al final se listan las que faltaron. */
async function step(name: string, run: () => Promise<void>) {
  if (only && !only.includes(name)) return;
  try {
    await run();
  } catch (error) {
    missing.push(name);
    console.warn(`[manual] ${name}: ${(error as Error).message.split('\n')[0]}`);
  }
}

async function signed(browser: Browser, role: E2ERole, viewport = DESKTOP): Promise<{ context: BrowserContext; page: Page; token: string }> {
  const storage = storageFor(role);
  if (!existsSync(storage)) throw new Error(`sin sesión guardada de ${role}; corre primero el proyecto setup`);
  const context = await browser.newContext({ viewport, storageState: storage, locale: 'es-CO', timezoneId: 'America/Bogota', colorScheme: 'light' });
  const login = await context.request.post('/api/auth/login', { data: { email: accounts[role], password: labPassword() } });
  const body = login.ok() ? ((await login.json()) as { accessToken?: string }) : {};
  if (!body.accessToken) throw new Error(`${role}: el ingreso no devolvió sesión (${login.status()})`);
  const me = (await (await context.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${body.accessToken}` } })).json()) as { id: string };
  await context.addInitScript(([token, userId]) => {
    sessionStorage.setItem('eq_access', token);
    localStorage.setItem(`eq.passkey.offer.${userId}`, 'later');
  }, [body.accessToken, me.id] as const);
  await morning(context);
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  return { context, page, token: body.accessToken };
}

/** Correct option text per question prompt, from the teacher's bank, so the demo student scores like a good student. */
async function answerKey(browser: Browser) {
  const teacher = await signed(browser, 'teacher');
  try {
    const bank = (await (await teacher.context.request.get('/api/questions', { headers: { Authorization: `Bearer ${teacher.token}` } })).json()) as { prompt: string; options: { text: string; is_correct: boolean }[] }[];
    return new Map(bank.map((q) => [q.prompt.trim(), q.options.find((o) => o.is_correct)?.text ?? '']));
  } finally {
    await teacher.context.close();
  }
}

async function pickCorrect(options: Locator, prompt: Locator, key: Map<string, string>) {
  const answer = key.get((await prompt.innerText()).trim());
  const right = answer ? options.filter({ hasText: answer }) : options;
  await ((await right.count()) ? right : options).first().click();
}

async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await settle(page);
}

async function skipTour(page: Page) {
  const skip = page.getByRole('button', { name: 'Saltar', exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

const bearer = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => sessionStorage.getItem('eq_access'))}` });

test('páginas públicas e ingreso', async ({ browser }) => {
  const context = await browser.newContext({ viewport: DESKTOP, locale: 'es-CO', colorScheme: 'light' });
  await morning(context);
  const page = await context.newPage();
  await step('publico-inicio', async () => { await open(page, '/'); await shot(page, 'publico-inicio'); });
  await step('ingresar', async () => { await open(page, '/ingresar'); await shot(page, 'ingresar'); });
  await step('ingresar-codigo', async () => {
    await page.getByLabel('Correo institucional').fill(accounts.coordinator);
    await page.getByLabel('Contraseña').fill(labPassword());
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('heading', { name: 'Revisa tu correo' }).waitFor();
    await page.getByRole('button', { name: /Código de desarrollo/ }).evaluate((el) => el.remove());
    await shot(page, 'ingresar-codigo');
  });
  await context.clearCookies();
  await step('recuperar', async () => { await open(page, '/recuperar'); await shot(page, 'recuperar'); });
  await step('ingresar-rostro', async () => { await open(page, '/ingresar/rostro'); await shot(page, 'ingresar-rostro'); });
  await context.close();
});

test('primer ingreso de una cuenta nueva', async ({ browser }) => {
  const admin = await signed(browser, 'admin');
  await open(admin.page, '/app');
  const email = `valentina.gomez.${Date.now().toString(36)}@eduquest.local`;
  const created = await admin.context.request.post('/api/admin/users/import/commit', {
    headers: await bearer(admin.page),
    data: { fileName: 'manual.xlsx', sendEmails: false, rows: [{ fullName: 'Valentina Gómez', email, role: 'student', group: '6A', isMinor: false }] },
  });
  const password = ((await created.json()) as { credentials?: { password: string }[] }).credentials?.[0]?.password;
  await admin.context.close();
  test.skip(!password, 'no se pudo crear la cuenta de ejemplo');

  const context = await browser.newContext({ viewport: DESKTOP, locale: 'es-CO', colorScheme: 'light' });
  await morning(context);
  const page = await context.newPage();
  await open(page, '/ingresar');
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(password!);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Código de desarrollo/ }).click();
  await step('cambiar-clave', async () => {
    await page.getByRole('heading', { name: 'Crea tu contraseña' }).waitFor();
    await shot(page, 'cambiar-clave');
    const fresh = `Ludoteka${Date.now().toString(36)}1`;
    await page.getByLabel('Clave temporal (la del correo)').fill(password!);
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(fresh);
    await page.getByLabel('Repite la nueva contraseña').fill(fresh);
    await page.getByRole('button', { name: /Guardar y entrar/ }).click();
  });
  await step('aceptar-documentos', async () => {
    await page.getByRole('heading', { name: 'Antes de entrar' }).waitFor();
    await shot(page, 'aceptar-documentos');
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Aceptar y entrar/ }).click();
  });
  await step('guia-recorrido', async () => {
    // The tour does not open by itself under automation (navigator.webdriver), so it is opened the way the menu does.
    await page.waitForURL('**/app', { timeout: 20_000 });
    await settle(page);
    const later = page.getByRole('button', { name: 'Ahora no' });
    if (await later.isVisible()) await later.click();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('eq:guide', { detail: 'tour' })));
    await page.getByText(/Paso 1 de/).waitFor({ timeout: 10_000 });
    await shot(page, 'guia-recorrido');
    await skipTour(page);
  });
  await context.close();
});

test('estudiante', async ({ browser }) => {
  const { context, page } = await signed(browser, 'student');
  await open(page, '/app');
  await skipTour(page);
  await step('estudiante-inicio', async () => { await shot(page, 'estudiante-inicio'); });
  await step('estudiante-voz', async () => {
    await page.getByRole('button', { name: 'Comandos de voz' }).first().click({ button: 'right' });
    await page.getByRole('dialog', { name: 'Qué puedo decir' }).waitFor();
    await shot(page, 'estudiante-voz');
    await page.keyboard.press('Escape');
  });
  await step('estudiante-guia', async () => {
    await page.locator('.guide-fab').click();
    await page.getByText('¿En qué te ayudo?').waitFor();
    await shot(page, 'estudiante-guia');
    await page.getByRole('button', { name: /Qué tengo pendiente/ }).click();
    await page.getByText('Por edificio').waitFor({ timeout: 10_000 }).catch(() => undefined);
    await shot(page, 'estudiante-guia-pendientes');
    await page.keyboard.press('Escape');
  });
  await step('estudiante-cursos', async () => { await open(page, '/app/cursos'); await shot(page, 'estudiante-cursos'); });
  await step('estudiante-curso-mapa', async () => {
    await page.locator('a[href^="/app/cursos/"]').first().click();
    await shot(page, 'estudiante-curso-mapa');
  });
  await step('estudiante-leccion', async () => {
    await page.locator('a[href^="/app/lecciones/"]').first().click();
    await shot(page, 'estudiante-leccion');
    const done = page.getByRole('button', { name: 'Marcar estación completa' });
    if (await done.isVisible().catch(() => false)) {
      await done.click();
      await page.getByText('¡Estación completada!').waitFor();
      await shot(page, 'estudiante-leccion-completa');
    }
  });
  await step('estudiante-aula', async () => {
    const courses = (await (await context.request.get('/api/courses', { headers: await bearer(page) })).json()) as { id: string }[];
    await open(page, `/app/cursos/${courses[0]!.id}/aula`);
    await shot(page, 'estudiante-aula');
  });
  await step('estudiante-practica', async () => {
    const headers = await bearer(page);
    const courses = (await (await context.request.get('/api/courses', { headers })).json()) as { id: string }[];
    let attemptId: string | undefined;
    for (const course of courses) {
      const items = (await (await context.request.get(`/api/courses/${course.id}/assessments`, { headers })).json()) as { id: string; kind: string }[];
      for (const item of items.filter((i) => i.kind === 'practice')) {
        const started = await context.request.post(`/api/assessments/${item.id}/start`, { headers });
        if (started.ok()) { attemptId = ((await started.json()) as { id: string }).id; break; }
      }
      if (attemptId) break;
    }
    if (!attemptId) throw new Error('no hay prácticas disponibles para el estudiante de laboratorio');
    await open(page, `/examen/${attemptId}`);
    await page.getByText(/Pregunta 1 de/).waitFor({ timeout: 20_000 });
    const key = await answerKey(browser);
    const prompt = page.locator('article h2');
    await pickCorrect(page.locator('button.option'), prompt, key);
    await shot(page, 'estudiante-practica');
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(350);
      await pickCorrect(page.locator('button.option'), prompt, key);
      const submit = page.getByRole('button', { name: 'Entregar evaluación' });
      if (await submit.isVisible()) { await submit.click(); break; }
      await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    }
    await page.getByText(/Tu resultado quedó registrado/).waitFor({ timeout: 20_000 });
    await shot(page, 'estudiante-practica-resultado');
  });
  const routes: [string, string][] = [
    ['estudiante-ruta', '/app/ruta'],
    ['estudiante-cuaderno', '/app/cuaderno'],
    ['estudiante-mi-espacio', '/app/aprender'],
    ['estudiante-arena', '/app/arena'],
    ['estudiante-arcade', '/app/jugar'],
    ['estudiante-trofeos', '/app/logros'],
    ['estudiante-cartelera', '/app/novedades'],
    ['notificaciones', '/app/notificaciones'],
    ['ajustes-perfil', '/app/ajustes'],
    ['ajustes-seguridad', '/app/ajustes?seccion=seguridad'],
    ['ajustes-companero', '/app/ajustes?seccion=companero'],
    ['ajustes-privacidad', '/app/ajustes?seccion=privacidad'],
    ['acceso-facial', '/app/rostro'],
  ];
  for (const [name, route] of routes) await step(name, async () => { await open(page, route); await shot(page, name); });
  await step('estudiante-biblioteca', async () => {
    await open(page, '/app/biblioteca');
    await page.locator('.lib-card').first().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 220);
    await page.waitForTimeout(800);
    await shot(page, 'estudiante-biblioteca');
  });
  await step('estudiante-ruta-tema', async () => {
    await open(page, '/app/ruta');
    await page.locator('.trail-node').first().click();
    await shot(page, 'estudiante-ruta-tema');
  });
  await step('estudiante-tutor', async () => {
    await open(page, '/app/tutor');
    await page.getByRole('textbox').last().fill('¿Cómo sé si dos fracciones son equivalentes?');
    await page.getByRole('button', { name: 'Pedir pista' }).click();
    await page.waitForTimeout(12_000);
    await shot(page, 'estudiante-tutor');
  });
  await step('estudiante-arcade-juego', async () => {
    await open(page, '/app/jugar');
    await page.getByRole('button', { name: 'Jugar', exact: true }).first().click();
    await page.getByText(/Ronda 1 de/).waitFor({ timeout: 15_000 });
    await shot(page, 'estudiante-arcade-juego');
  });
  await context.close();
});

test('teléfono', async ({ browser }) => {
  const { context, page } = await signed(browser, 'student', PHONE);
  await open(page, '/app');
  await skipTour(page);
  await step('movil-inicio', async () => { await shot(page, 'movil-inicio'); });
  await step('movil-mas', async () => {
    await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
    await shot(page, 'movil-mas');
  });
  await context.close();
});

test('docente', async ({ browser }) => {
  const teacher = await signed(browser, 'teacher');
  const { page } = teacher;
  await open(page, '/app');
  await skipTour(page);
  await step('docente-inicio', async () => { await shot(page, 'docente-inicio'); });
  const courses = (await (await teacher.context.request.get('/api/courses', { headers: await bearer(page) })).json()) as { id: string }[];
  const course = courses[0]!.id;
  const routes: [string, string][] = [
    ['docente-curso-mapa', `/app/cursos/${course}`],
    ['docente-aula', `/app/cursos/${course}/aula`],
    ['docente-banco', '/app/banco'],
    ['docente-planilla', '/app/calificaciones'],
    ['docente-integridad', `/app/integridad/${course}`],
    ['docente-reportes', `/app/reportes/${course}`],
    ['docente-arena', '/app/arena'],
    ['docente-mensajes', '/app/mensajes'],
    ['docente-cartelera', '/app/novedades'],
    ['docente-biblioteca', '/app/biblioteca'],
  ];
  for (const [name, route] of routes) await step(name, async () => { await open(page, route); await shot(page, name); });
  await step('docente-curso-nueva-unidad', async () => {
    await open(page, `/app/cursos/${course}`);
    const form = page.getByText('Nueva unidad').first();
    await form.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, 'docente-curso-nueva-unidad');
  });
  for (const [tab, name] of [['Ponderación', 'docente-planilla-ponderacion'], ['Asistencia', 'docente-planilla-asistencia'], ['Rúbricas', 'docente-planilla-rubricas'], ['Alertas', 'docente-planilla-alertas']] as const) {
    await step(name, async () => {
      await open(page, '/app/calificaciones');
      await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click();
      await shot(page, name);
    });
  }
  await step('docente-mensaje-nuevo', async () => {
    await open(page, '/app/mensajes');
    await page.getByRole('button', { name: 'Nuevo mensaje' }).click();
    await shot(page, 'docente-mensaje-nuevo');
    await page.keyboard.press('Escape');
  });
  await step('docente-observatorio', async () => {
    await open(page, '/app/consultas');
    await page.getByRole('button', { name: /promedio de cada estudiante/ }).first().click();
    await page.getByText(/Validado · solo lectura/).waitFor({ timeout: 30_000 });
    await page.getByText(/Validado · solo lectura/).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 260);
    await shot(page, 'docente-observatorio');
  });

  await step('sala-en-vivo', async () => {
    const student = await signed(browser, 'student');
    try {
      await open(teacher.page, '/app/en-vivo');
      await shot(teacher.page, 'docente-sala-elegir');
      const hostable = (await (await teacher.context.request.get('/api/live/hostable', { headers: await bearer(page) })).json()) as { id: string; questions: number; open: { id: string } | null }[];
      const pick = hostable.find((h) => h.questions > 0)!;
      if (pick.open) await teacher.context.request.post(`/api/live/${pick.open.id}/end`, { headers: await bearer(page) });
      const session = (await (await teacher.context.request.post('/api/live', { headers: await bearer(page), data: { assessmentId: pick.id } })).json()) as { id: string; code: string };
      await open(page, `/app/en-vivo?sala=${session.id}`);
      await open(student.page, `/app/en-vivo?codigo=${session.code}`);
      await skipTour(student.page);
      await shot(student.page, 'estudiante-sala-codigo');
      await student.page.getByRole('button', { name: 'Entrar' }).click();
      await student.page.getByText('¡Estás dentro!').waitFor({ timeout: 15_000 });
      await page.getByText('1 en la sala').waitFor({ timeout: 15_000 });
      await shot(page, 'docente-sala-codigo');
      await page.getByRole('button', { name: 'Empezar' }).click();
      const options = student.page.locator('.kahoot button');
      await options.first().waitFor({ timeout: 15_000 });
      await shot(student.page, 'estudiante-sala-pregunta');
      await pickCorrect(options, page.locator('.live-stage h2').first(), await answerKey(browser));
      await page.getByText('1 de 1 respondieron').waitFor({ timeout: 15_000 });
      await shot(page, 'docente-sala-pregunta');
      await page.getByRole('button', { name: 'Cerrar sala' }).click();
      await page.getByText(/Resultados ·/).waitFor({ timeout: 15_000 });
      await shot(page, 'docente-sala-resultados');
    } finally {
      await student.context.close();
    }
  });
  await teacher.context.close();
});

const staffRoutes: Record<'coordinator' | 'rector' | 'guardian' | 'admin', [string, string][]> = {
  coordinator: [
    ['coordinacion-alertas', '/app/coordinacion'],
    ['coordinacion-asistencia', '/app/coordinacion/asistencia'],
    ['coordinacion-citaciones', '/app/coordinacion/citaciones'],
    ['coordinacion-consolidado', '/app/calificaciones'],
  ],
  rector: [
    ['rectoria-tablero', '/app/rectoria'],
    ['rectoria-firmas', '/app/rectoria/firmas'],
    ['rectoria-comunicados', '/app/rectoria/comunicados'],
    ['rectoria-reportes', '/app/rectoria/reportes'],
  ],
  guardian: [
    ['acudiente-hijos', '/app/acudiente'],
    ['acudiente-mensajes', '/app/mensajes'],
  ],
  admin: [
    ['admin-usuarios', '/app/admin/usuarios'],
    ['admin-institucion', '/app/admin'],
  ],
};

for (const role of ['coordinator', 'rector', 'guardian', 'admin'] as const) {
  test(`rol ${role}`, async ({ browser }) => {
    const { context, page } = await signed(browser, role);
    await open(page, '/app');
    await skipTour(page);
    await step(`${role}-inicio`, async () => { await shot(page, `${{ coordinator: 'coordinacion', rector: 'rectoria', guardian: 'acudiente', admin: 'admin' }[role]}-inicio`); });
    for (const [name, route] of staffRoutes[role]) await step(name, async () => { await open(page, route); await shot(page, name); });

    if (role === 'coordinator') {
      await step('coordinacion-nueva-citacion', async () => {
        await open(page, '/app/coordinacion');
        await page.getByRole('button', { name: 'Nueva citación' }).click();
        await shot(page, 'coordinacion-nueva-citacion');
        await page.keyboard.press('Escape');
      });
      await step('cartelera-publicar', async () => { await open(page, '/app/novedades'); await shot(page, 'cartelera-publicar'); });
    }
    if (role === 'guardian') {
      await step('acudiente-autorizaciones', async () => {
        await open(page, '/app/acudiente');
        await page.getByText('Autorizaciones').first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await shot(page, 'acudiente-autorizaciones');
      });
    }
    if (role === 'admin') {
      await step('admin-nueva-cuenta', async () => {
        await open(page, '/app/admin/usuarios');
        await page.getByRole('button', { name: 'Nueva cuenta' }).click();
        await shot(page, 'admin-nueva-cuenta');
        await page.keyboard.press('Escape');
      });
      await step('admin-importar', async () => {
        await open(page, '/app/admin/usuarios');
        await page.getByRole('button', { name: 'Importar' }).click();
        await shot(page, 'admin-importar');
        await page.keyboard.press('Escape');
      });
      await step('admin-gestionar', async () => {
        await open(page, '/app/admin/usuarios');
        await page.getByRole('button', { name: 'Gestionar' }).first().click();
        await shot(page, 'admin-gestionar');
        await page.keyboard.press('Escape');
      });
      for (const [tab, name] of [['Acudientes', 'admin-acudientes'], ['Cursos', 'admin-cursos']] as const) {
        await step(name, async () => {
          await open(page, '/app/admin');
          await page.getByRole('button', { name: tab, exact: true }).first().click();
          await shot(page, name);
        });
      }
    }
    await context.close();
  });
}

test.afterAll(() => {
  if (missing.length) console.warn(`[manual] capturas que faltaron: ${missing.join(', ')}`);
});
