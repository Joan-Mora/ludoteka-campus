import { config } from "../../shared/config";
import { query } from "../../shared/db/pool";

/**
 * Purges facial embeddings older than the configured retention window.
 * Returns only the number deleted; biometric vectors are never logged.
 */
export async function purgeExpiredEmbeddings(): Promise<number> {
  if (config.facialRetentionDays <= 0) return 0;

  const result = await query(
    `DELETE FROM facial_embeddings
     WHERE updated_at < now() - ($1::INT * INTERVAL '1 day')`,
    [config.facialRetentionDays],
  );
  return result.rowCount ?? 0;
}
