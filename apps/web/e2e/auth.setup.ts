import { existsSync, mkdirSync } from 'node:fs';
import { test as setup, request, type APIRequestContext } from '@playwright/test';
import { accounts, authDir, labPassword, ROLES, storageFor, type E2ERole } from './accounts';

interface LoginResponse {
  accessToken?: string;
  otp?: { challengeId: string; devCode?: string };
}

interface LegalStatus {
  ownPending: boolean;
  needsGuardian: boolean;
  wards: { id: string }[];
}

setup.describe.configure({ mode: 'serial' });

/** Guardians go first: they accept the documents on behalf of their minor wards. */
const LEGAL_ORDER: E2ERole[] = ['guardian', ...ROLES.filter((r) => r !== 'guardian')];

async function acceptLegal(context: APIRequestContext, role: E2ERole, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const status = await context.get('/api/legal/status', { headers });
  if (!status.ok()) return;
  const body = (await status.json()) as LegalStatus;
  if (body.needsGuardian || (!body.ownPending && !body.wards.length)) return;
  const accept = await context.post('/api/legal/accept', { headers, data: { wards: body.wards.map((w) => w.id), guardianPresent: true } });
  if (!accept.ok()) console.warn(`[setup] ${role}: aceptación legal ${accept.status()}`);
}

/** Reuses the trusted-device cookie of the previous run, so the API only emails a code when that cookie expired. */
setup('sesiones de laboratorio', async ({ baseURL }) => {
  mkdirSync(authDir, { recursive: true });
  const password = labPassword();
  const local = (process.env.E2E_TARGET ?? 'local') === 'local';
  for (const role of LEGAL_ORDER) {
    const file = storageFor(role);
    if (!local && !existsSync(file)) {
      console.warn(`[setup] ${role}: sin dispositivo de confianza guardado; no se pide un código que nadie va a leer.`);
      continue;
    }
    const context = await request.newContext({ baseURL, storageState: existsSync(file) ? file : undefined });
    const login = await context.post('/api/auth/login', { data: { email: accounts[role], password } });
    if (!login.ok()) {
      console.warn(`[setup] ${role}: login ${login.status()}`);
      await context.dispose();
      continue;
    }
    const body = (await login.json()) as LoginResponse;
    let token = body.accessToken;
    if (body.otp) {
      if (!body.otp.devCode) {
        console.warn(`[setup] ${role}: el servidor pide el código del correo; se omiten sus rutas privadas.`);
        await context.dispose();
        continue;
      }
      const verify = await context.post('/api/auth/otp/verify', { data: { challengeId: body.otp.challengeId, code: body.otp.devCode, trustDevice: true } });
      if (!verify.ok()) {
        console.warn(`[setup] ${role}: código ${verify.status()}`);
        await context.dispose();
        continue;
      }
      token = ((await verify.json()) as LoginResponse).accessToken;
    }
    if (token) await acceptLegal(context, role, token);
    await context.storageState({ path: file });
    await context.dispose();
  }
});
