# Modelo de datos

La única base es **CockroachDB Cloud** (dialecto PostgreSQL). La API accede con Kysely sobre el driver `pg`; los tipos están en `apps/api/src/core/database/database.types.ts` y el esquema en `db/migrations`.

## Convenciones

| Tema | Regla |
|---|---|
| Claves | `UUID PRIMARY KEY DEFAULT gen_random_uuid()`; evita puntos calientes de escritura en CockroachDB. Tablas de unión y de estado usan clave compuesta. La única secuencia es `report_seq` |
| Fechas | `TIMESTAMPTZ NOT NULL DEFAULT now()`. `updated_at` lo pone la aplicación (no hay triggers). Los días se calculan en `America/Bogota` (`core/time.ts` y `AT TIME ZONE` en SQL) |
| Enumeraciones | `STRING` con `CHECK (col IN (...))`, no tipos `ENUM`. En TypeScript son `string` |
| Borrado | Real, con `ON DELETE CASCADE` o `SET NULL`. Lo «inactivo» se expresa con estado: `users.status = 'disabled'`, `library_items.status = 'archived'`, `enrollments.status = 'withdrawn'`, `revoked_at` |
| JSON | `JSONB` para metadatos, estado de juegos, instantáneas y salidas de IA. Se escribe con `JSON.stringify` y se lee como `unknown` |
| Binarios | `BYTES` para plantillas faciales cifradas y llaves públicas de passkeys |
| Transacciones | Aislamiento serializable (por defecto en CockroachDB). `withTx()` reintenta hasta 3 veces ante `40001` y `CR000` |
| Conexión | Pool de 10 conexiones. TLS según `DATABASE_URL` (`sslmode=verify-full`) |
| Reglas entre filas | Las que abarcan varias filas (pesos que suman 100 %, puntos de rúbrica ≤ máximo, contadores de foro) las valida el servicio |

## Migraciones

- Archivos SQL en `db/migrations`, aplicados en orden alfabético al arrancar la API o con `npm run migrate`.
- Cada archivo corre en su propia transacción junto con su registro en `schema_migrations (id, applied_at)`; si falla, se deshace y la API no arranca.
- **No hay checksum:** editar un archivo ya aplicado no tiene efecto. Todo cambio va en un archivo nuevo con el siguiente número.
- Hoy van de `0000_drop_legacy` a `0031_staff_messages` (36 archivos; `0011`, `0020` y `0028` tienen variantes con sufijo).

**Particularidades de CockroachDB al escribir migraciones:**

- No se puede cambiar el esquema después de escribir datos en la misma transacción. Por eso un cambio que mezcla datos y DDL se parte en varios archivos (`0020_roles_a/b/c`: ampliar el CHECK, migrar datos, cerrar el CHECK).
- Los CHECK sin nombre reciben nombres automáticos como `check_<columna>`. Para borrarlos se usa `DROP CONSTRAINT IF EXISTS`, que no avisa si el nombre es otro; conviene nombrar los CHECK nuevos.
- `string_agg(DISTINCT x, ',' ORDER BY x)` no está soportado: se usa una subconsulta con `SELECT DISTINCT` y luego `string_agg(x, ',' ORDER BY x)`.
- Sintaxis propia que el esquema usa: `STRING`, `BYTES`, `INT8`, `VECTOR(n)`, `CREATE INVERTED INDEX`, `CREATE VECTOR INDEX`, `CREATE ROLE IF NOT EXISTS`.

## Tablas por módulo

El dueño es el módulo que escribe la tabla. Se listan las restricciones que cambian el comportamiento.

### identity

| Tabla | Propósito y restricciones clave |
|---|---|
| `users` | Cuentas. `email` único; `status` active/disabled; `failed_logins`, `locked_until`, `must_change_password`, `is_minor`, `guardian_consent_at` |
| `user_roles` | Un rol por usuario (PK `user_id`); CHECK con los seis roles |
| `refresh_tokens` | Sesiones. `token_hash` único; `family_id`, `auth_method`, `replaced_at`, `revoked_at`, `ip`, `user_agent` |
| `password_reset_tokens` | Recuperación de clave; `token_hash` único |
| `login_challenges` | Códigos por correo (HMAC), `attempts`/`max_attempts` |
| `trusted_devices` | Dispositivos de confianza; `token_hash` único |
| `webauthn_credentials`, `webauthn_challenges` | Passkeys (`credential_id` único, `public_key` BYTES, `counter`) y sus retos |
| `account_imports` | Historial de importaciones de usuarios y estructura, con errores en JSONB |
| `guardian_links` | Acudiente–estudiante; único por par; CHECK `guardian_id <> student_id`; `status` pending/active/revoked |
| `guardian_authorizations` | Autorizaciones `facial`, `ai_tutor`, `data_processing`; solo inserción, la última manda |
| `user_preferences` | Compañero (luka/luna), tema, resumen semanal |
| `audit_log` | Auditoría compartida: actor, acción, entidad, metadatos |

### biometrics

| Tabla | Propósito |
|---|---|
| `facial_consents` | Aceptación de la política facial por versión |
| `face_templates` | Plantilla cifrada (PK `user_id`): `ciphertext`, `iv`, `tag`, número de muestras y dispersión |
| `face_attempts` | Cada intento con modo, motivo, distancia, IP y correo como SHA-256 |

### institution

`academic_years` (nombre único, `is_current`), `periods` (único por año y posición), `grades` (nivel 6–11 único), `groups_class` (único por grado, año y nombre), `subjects` (código único), `enrollments` (una matrícula por usuario y año), `teaching_assignments` (único por docente, materia, grupo y año).

### learning

| Tabla | Propósito y restricciones clave |
|---|---|
| `courses` | Único por materia, grupo y año; `published`, `is_demo` |
| `units`, `lessons` | Orden por `position` único dentro del padre |
| `lesson_resources`, `lesson_progress` | Recursos (link/note/video) y avance (started/completed) |
| `assignments`, `submissions` | Tareas y entregas (una por estudiante y tarea) |
| `announcements`, `calendar_events` | Anuncios y calendario por curso |
| `news`, `news_audience`, `news_reads` | Cartelera: audiencia por todos/rol/grupo/curso, lectura y confirmación |
| `forum_threads`, `forum_posts` | Foros por curso; resumen IA guardado en el hilo |
| `forum_reactions`, `forum_mentions`, `forum_attachments` | Reacciones (útil/idea/gracias/duda), menciones y adjuntos de la biblioteca |

### assessment

| Tabla | Propósito y restricciones clave |
|---|---|
| `competencies`, `questions`, `question_options` | Banco de preguntas por materia, grado y competencia |
| `assessments`, `assessment_questions` | Evaluaciones `practice`, `exam` o `live` |
| `attempts`, `attempt_answers` | Intentos; índice único parcial: un intento activo por usuario y evaluación |
| `live_sessions`, `live_participants` | Sala en vivo con código único |
| `grade_categories` | Categorías ponderadas por curso (`weight` 0–100) |
| `rubrics`, `rubric_criteria`, `rubric_scores` | Rúbricas y puntajes |
| `attendance` | Una marca por curso, estudiante y día |
| `risk_alerts` | Bajo rendimiento, ausencias, integridad o inactividad; una abierta por estudiante, curso y tipo |

### integrity, certification, arena, arcade

| Tabla | Propósito |
|---|---|
| `integrity_policies`, `integrity_events`, `attempt_flags` | Política, eventos por intento y conteo de violaciones |
| `certificate_templates`, `certificates` | Certificados con código único y flujo de firma (pendiente/firmado/rechazado) |
| `arena_rooms` | Sala con código de 6 caracteres, preguntas en `UUID[]` e instantánea JSONB para sobrevivir reinicios |
| `arena_teams`, `arena_members`, `arena_answers`, `arena_results` | Equipos, integrantes, una respuesta por equipo y pregunta, resultado final |
| `arcade_games`, `arcade_sessions` | Catálogo de 10 juegos y sesiones con las respuestas guardadas en el servidor |
| `minigame_runs` | Partidas registradas para XP y reto del día |

### gamification y notifications

| Tabla | Propósito |
|---|---|
| `levels`, `xp_ledger` | Niveles y libro de XP (solo inserción) |
| `badges`, `user_badges`, `user_achievements` | Catálogo (se sincroniza desde `badges.ts` al arrancar), insignias ganadas y niveles por temporada |
| `streaks`, `missions`, `mission_progress`, `leaderboard_snapshots` | Rachas, misiones semanales y clasificaciones |
| `notifications` | Avisos con tipo, enlace (empieza por `/app`), edificio y entidad |
| `email_outbox` | Copia de cada correo (redactada si es sensible) |

### study, library, tutor, profile

| Tabla | Propósito |
|---|---|
| `notebook_pages`, `flashcards`, `flashcard_reviews` | Cuaderno con resumen y tarjetas SM-2 |
| `goals`, `focus_sessions` | Metas (una activa por tipo y periodo) y sesiones de enfoque (una en curso por usuario) |
| `library_items` | Archivo: tipo, visibilidad (pública/institución/curso), estado, fuente y licencia; `cloudinary_public_id` único |
| `library_tags`, `bookmarks`, `library_views`, `library_visits`, `glossary_terms` | Etiquetas, marcadores, vistas, última visita y glosario |
| `library_chunks` | Fragmentos de texto con `tsv` (búsqueda en español) y `embedding VECTOR(768)` |
| `tutor_conversations`, `tutor_messages` | Conversaciones del tutor con citas en JSONB |
| `recommendations` | Recomendaciones del docente a un estudiante |
| `topics`, `question_topics`, `topic_mastery`, `route_items` | Temas, maestría por estudiante y ejercicios de Mi ruta (respuesta calculada en el servidor) |
| `learning_profiles`, `learning_activity` | Perfil de método de aprendizaje y actividad por método |

### governance, legal, analytics y núcleo

| Tabla | Propósito |
|---|---|
| `risk_alert_notes`, `meetings` | Bitácora de alertas y citaciones a acudientes |
| `guardian_messages`, `staff_messages` | Mensajes acudiente–docente por estudiante y mensajes entre el personal |
| `bulletin_signatures` | Boletines por firmar (uno pendiente por estudiante) |
| `legal_documents`, `legal_acceptances`, `data_requests` | Documentos versionados, aceptaciones (con quién aceptó por el menor) y solicitudes de exportación o eliminación |
| `nl_queries` | Historial del Observatorio: pregunta, SQL, estado, filas y duración |
| `report_log` | Reportes generados con código `LK-<año>-<secuencia>` |
| `ai_usage` | Uso de IA: función, modelo y usuario, sin contenido |
| `schema_migrations` | Migraciones aplicadas |

## Vistas del Observatorio

Doce vistas en español, creadas en `0017_observatorio.sql`. Todas exponen `group_id` para limitar al docente a sus grupos.

| Vista | Contenido |
|---|---|
| `v_estudiantes` | Estudiantes matriculados por grupo |
| `v_cursos` | Cursos con materia, grupo y docente |
| `v_evaluaciones` | Evaluaciones por curso con número de preguntas |
| `v_intentos` | Intentos con puntaje, porcentaje e integridad |
| `v_respuestas` | Cada respuesta con tema y dificultad |
| `v_tareas` | Entregas de tareas |
| `v_lecciones` | Avance en lecciones |
| `v_integridad` | Eventos de integridad |
| `v_xp` | XP, racha e insignias del año en curso |
| `v_maestria` | Nivel de maestría por estudiante y tema |
| `v_ruta` | Ejercicios de Mi ruta |
| `v_biblioteca` | Archivos con vistas y marcadores |

El rol `ludoteka_reader` solo tiene `SELECT` sobre estas vistas. La consulta lo adopta con `SET LOCAL ROLE`, lo que exige que el usuario de la aplicación sea administrador del clúster (así viene en CockroachDB Cloud).

## Búsqueda en la biblioteca

1. **Ingesta** (`LibraryService.ingest`):
   - se extrae el texto del PDF por página y se parte en fragmentos de 900 caracteres con 150 de traslape (máximo 400 por archivo);
   - los fragmentos se convierten en vectores de 768 dimensiones con `gemini-embedding-2`.
2. **Si la cuota de IA falla:** el fragmento se guarda con `embedding = NULL` y la búsqueda por texto sigue funcionando. `npm run library:seed` rellena los vectores pendientes.
3. **Búsqueda híbrida:**
   - doce resultados por similitud coseno (`embedding <=> consulta`) y doce por texto completo en español (`ts_rank`);
   - se combinan por fusión de rangos recíprocos y los cinco mejores son las citas de la respuesta.
   - Ambas búsquedas respetan lo que el usuario puede ver.

## Datos de arranque

- **Siembra demo** (`core/database/seed.ts` y `db/seeds/001_contenido.sql`):
  - corre si `users` está vacía y crea las cuentas de laboratorio, los vínculos de acudiente y el curso de Matemáticas 6.° con 12 lecciones, 12 preguntas y 3 evaluaciones;
  - en cada arranque recrea solo las cuentas de laboratorio que falten;
  - `npm run seed` rehace el contenido del curso demo (borra y vuelve a crear ese curso y sus preguntas).
- **Sincronizaciones al arrancar:** temas de Mi ruta, catálogo de insignias y, si la biblioteca está vacía y hay Cloudinary, una guía de ejemplo.
- **Biblioteca completa** (`npm run library:seed -w @eduquest/api`): ver [Operación](operacion.md#biblioteca-y-embeddings).
- **Hueco conocido:** `0022_periods.sql` crea los periodos 2 a 4 solo si el año 2026 ya existe. En una base nueva la migración corre antes de la siembra, así que solo queda el Periodo 1. La API no tiene endpoint de periodos: hoy hay que insertarlos con SQL o mover esa lógica a la siembra.
