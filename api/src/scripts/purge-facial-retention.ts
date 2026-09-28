import { pool } from "../shared/db/pool";
import { purgeExpiredEmbeddings } from "../modules/facial/retention";

async function main() {
  if (!pool) {
    console.error("Define DATABASE_URL en .env");
    process.exitCode = 1;
    return;
  }

  const deleted = await purgeExpiredEmbeddings();
  console.log(`Retención facial OK: ${deleted} embedding(s) eliminado(s).`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Falló la retención facial", err instanceof Error ? err.message : "error desconocido");
  if (pool) await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
