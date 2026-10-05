# ADR-004 — CockroachDB con SQL visible y Kysely

**Estado:** aceptada · 2026-09-28

## Decisión

La única base es CockroachDB, por el enunciado del parcial. Render Postgres no se usa.

El esquema vive en `db/migrations/*.sql`, legible para la sustentación. En ejecución, Kysely tipa las consultas sobre el driver `pg` (wire protocol de Postgres). `withTx()` reintenta `40001`.

Las PK son UUID aleatorios para no crear hotspots en el clúster. La única secuencia es `report_seq` (migración 0016): no es una PK, solo numera los reportes con el consecutivo legible `LK-AAAA-NNNNNN` que pide la rúbrica.

## Consecuencias

- Las migraciones se aplican al arrancar y quedan registradas en `schema_migrations`.
- Un cambio de tabla se hace con un SQL nuevo, no con un diff implícito de un ORM.
