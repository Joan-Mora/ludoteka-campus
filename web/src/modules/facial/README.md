# facial (EQ-P09 Must)

On-device: `embedder.ts` produce `embedding[]` + `modelId`; la API nunca recibe foto.
Lab modelId: `eduquest-lab-luma-v1` (luminancia). Sustituible por FaceMesh sin cambiar contratos.

Retención API: `purgeExpiredEmbeddings()` es un hook invocable; elimina embeddings vencidos solo cuando `FACIAL_RETENTION_DAYS > 0` (sin cron requerido).
