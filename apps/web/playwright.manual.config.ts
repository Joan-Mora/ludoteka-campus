import { defineConfig, devices } from '@playwright/test';

process.env.E2E_TARGET ??= 'docker';

/** Capturas del manual de usuario contra la pila de Docker con CockroachDB local (ver e2e/manual.capture.ts). */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: process.env.MANUAL_BASE_URL ?? 'http://localhost:3000',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'manual', testMatch: /manual\.capture\.ts/, dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },
  ],
});
