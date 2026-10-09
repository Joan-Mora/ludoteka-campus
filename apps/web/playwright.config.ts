import { defineConfig, devices } from '@playwright/test';

export const LOCAL_URL = 'http://localhost:5173';

export function makeConfig(baseURL: string) {
  const local = baseURL === LOCAL_URL;
  return defineConfig({
    testDir: './e2e',
    outputDir: './e2e/.results',
    timeout: 60_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 2,
    retries: local ? 0 : 1,
    reporter: [['list'], ['html', { outputFolder: './e2e/.report', open: 'never' }]],
    metadata: { baseURL },
    use: {
      baseURL,
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      trace: 'retain-on-failure',
    },
    projects: [
      { name: 'setup', testMatch: /auth\.setup\.ts/ },
      { name: 'iphone', use: { ...devices['iPhone 13'] }, dependencies: ['setup'] },
      { name: 'ipad', use: { ...devices['iPad (gen 7)'] }, dependencies: ['setup'] },
      { name: 'safari-mac', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
      { name: 'android', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    ],
    webServer: local
      ? { command: 'npm run dev', cwd: '../..', url: LOCAL_URL, reuseExistingServer: true, timeout: 240_000 }
      : undefined,
  });
}

export default makeConfig(process.env.E2E_BASE_URL ?? LOCAL_URL);
