import { makeConfig } from './playwright.config';

process.env.E2E_TARGET ??= 'prod';

export default makeConfig(process.env.E2E_BASE_URL ?? 'https://ludoteka-campus.onrender.com');
