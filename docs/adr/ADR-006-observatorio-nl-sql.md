# ADR-006 — Observatorio: lenguaje natural a SQL con tres barreras

**Estado:** aceptada · 2026-10-05

## Contexto

Coordinación y docentes quieren preguntar en español ("¿qué tema tiene la maestría más baja en 6A?") y obtener una tabla o un gráfico. Dejar que un modelo de lenguaje escriba SQL contra la base de producción es riesgoso: puede inventar tablas, modificar datos, leer columnas sensibles o colgar la base con una consulta pesada.

## Decisión

El modelo no ve tablas: ve 12 vistas `v_*` con columnas en español (`v_intentos`, `v_maestria`, `v_integridad`, `v_xp`, `v_biblioteca`…). Cada consulta pasa tres barreras independientes:

1. **Validador estático** (`observatory.sql.ts`):
   - solo una sentencia `SELECT` o `WITH … SELECT`;
   - sin comentarios, punto y coma, `$`, escapes ni nombres calificados;
   - lista negra de palabras (`INSERT`, `UPDATE`, `SET`, `SHOW`, `RECURSIVE`, `LATERAL`…) y de funciones o catálogos (`pg_sleep`, `crdb_internal`, `information_schema`…);
   - cada `FROM` o `JOIN` debe ser una vista `v_*` o un CTE propio, y no se permite redefinir una vista;
   - `LIMIT` forzado a 201 filas como máximo; se muestran 200.
2. **Alcance por grupo:** si quien pregunta es docente, el servidor antepone CTE que reemplazan cada vista por sus filas `WHERE group_id = ANY($1)`. El docente nunca ve otro grupo aunque el SQL lo pida.
3. **La base de datos:** la consulta corre en `BEGIN READ ONLY` con `SET LOCAL ROLE ludoteka_reader` (solo `SELECT` sobre `v_*`) y `statement_timeout` de 5 s. Aunque las dos barreras anteriores fallaran, la base rechaza escribir o leer tablas.

Además:

- Los nombres de estudiantes escritos en la pregunta se reemplazan por `ESTUDIANTE_n` antes de llamar al modelo. Ningún dato personal de un menor sale del servidor; el nombre real vuelve al SQL solo como literal.
- Cada pregunta queda en `nl_queries` con el SQL, el estado (`ok`, `rejected`, `error`, `no_model`), el motivo, las filas y la duración.
- Seis preguntas de ejemplo tienen SQL fijo: la demo funciona aunque el proveedor de IA no responda.

## Consecuencias

- El modelo puede equivocarse en la consulta, pero no puede dañar datos ni salirse del alcance.
- Agregar una pregunta nueva no requiere código: basta con que la respondan las vistas.
- Las vistas son un contrato: cambiar una tabla obliga a revisar la vista, no los prompts.
- En la sustentación se demuestra el rechazo (`DELETE FROM users`, `SELECT * FROM users`) y el `SHOW GRANTS ON TABLE v_intentos`.
