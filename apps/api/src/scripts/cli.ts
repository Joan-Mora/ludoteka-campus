import { loadEnv } from '../core/config/env';
import { runMigrations } from '../core/database/migrate';
import { seed } from '../core/database/seed';

async function main() {
  loadEnv();
  const command = process.argv[2];
  if (command === 'migrate') await runMigrations();
  else if (command === 'seed') await seed();
  else {
    console.error('Usa migrate o seed');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
