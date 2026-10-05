# Ludoteka Campus — Arquitectura

Monolito modular. Un repositorio, un proceso y una base de datos. Los servicios externos solo guardan lo que CockroachDB no debe guardar: archivos, inferencia de IA y envío de correo.

```
Navegador (React 19, face-api, Web Speech)
    │  HTTPS
    ▼
NestJS  ── /api        REST
        ── /socket.io  quiz en vivo, Arena, integridad y notificaciones
        ── /           build estático de React
    │                         │                 │              │
    │ Postgres wire + SSL     │ HTTPS           │ HTTPS        │ HTTPS
    ▼                         ▼                 ▼              ▼
CockroachDB Cloud        Cloudinary        Google Gemini     Resend
(datos, vistas v_*)      (archivos)        (chat y embeddings) (correo)
```

En desarrollo, Vite sirve la web en `:5173` y hace proxy de `/api` y `/socket.io` hacia la API en `:3000`. En producción el mismo proceso de Nest entrega ambos.

## Árbol

```
apps/api/src/core          config, base de datos, auth, errores, eventos, tiempo real, correo,
                           IA (AiService), reportes (renderPdf, renderWorkbook, ReportLog)
apps/api/src/modules       identity, institution, learning, assessment, integrity, gamification,
                           arena, library, study, tutor, biometrics, analytics, certification,
                           notifications, health
apps/web/src/app           router y shell (campus, navegación por rol)
apps/web/src/features      pantallas, alineadas a los módulos
apps/web/src/shared        cliente API, auth, voz, face-api
packages/contracts         esquemas zod compartidos
db/migrations              SQL versionado (0000 a 0017)
db/seeds                   contenido demostrable
```

## Reglas de dependencia

Cada módulo exporta su fachada en `public-api.ts`. Otro módulo solo puede importar esa fachada, nunca un archivo interno. `dependency-cruiser` lo exige (`npm run deps:check`).

Las llamadas síncronas solo bajan por este grafo:

```
identity ──── biometrics
identity ──── tutor
learning ──── assessment ──── certification
learning ──── arena
learning ──── study
learning ──── library ──── tutor
integrity ─── tutor
```

`gamification`, `analytics` y `notifications` no se importan desde otros módulos. Reaccionan a eventos de dominio (`@nestjs/event-emitter`):

| Evento | Quién lo emite | Quién escucha |
|--------|----------------|---------------|
| `lesson.completed` | learning | gamification |
| `submission.graded` | learning | gamification |
| `attempt.graded` | assessment | gamification, tutor (maestría de Mi ruta) |
| `integrity.violation` | integrity | notifications |
| `integrity.suspend` | integrity | assessment (suspende el intento) |
| `password.reset` | identity | notifications (correo) |
| `tutor.message` | tutor | gamification |
| `news.published` | learning (cartelera) | notifications |
| `forum.reply` | learning (foros) | notifications |
| `guardian.facial_revoked` | identity (acudientes) | biometrics (borra la plantilla) |
| `route.solved` | tutor (Mi ruta) | gamification |
| `arena.finished` | arena | gamification |
| `study.progress` | study | gamification |
| `risk.alert_raised` | assessment (calificaciones) | notifications (docente y acudiente) |

Los tableros leen tablas de otros módulos en solo lectura. La escritura de una tabla la hace el módulo dueño (ADR-003).

## CockroachDB

- Claves `UUID DEFAULT gen_random_uuid()`. La única secuencia es `report_seq` para el consecutivo LK.
- `withTx()` reintenta la transacción ante el SQLSTATE `40001`.
- `readOnly()` abre `BEGIN TRANSACTION READ ONLY` con `statement_timeout` y rol restringido; lo usa el Observatorio (ADR-006).
- SSL según la cadena `DATABASE_URL`.
- Las migraciones se aplican al arrancar y quedan en `schema_migrations`. La `0000` eliminó el esquema del prototipo de quizzes y solo corrió una vez.

## Auth

JWT de acceso corto en memoria del cliente. Refresh opaco, con hash en `refresh_tokens`, en cookie `HttpOnly`. Contraseñas con argon2id. La recuperación no revela si el correo existe. Roles: `admin`, `directivo` (coordinación y rectoría), `teacher`, `student`, `guardian`.

## IA

`AiService` habla con cualquier proveedor compatible con la API de chat de OpenAI (por defecto Gemini). Tiene modelos de respaldo si el principal responde 503 y registra cada llamada en `ai_usage` sin el contenido. Antes de enviar un texto se quitan los datos personales. Cada funcionalidad tiene un camino sin IA:

- el tutor responde con la lección;
- el Cuaderno usa un resumen local;
- Mi ruta usa plantillas;
- el Observatorio usa preguntas de ejemplo.

## Facial

face-api calcula en el navegador un descriptor de 128 dimensiones tras una prueba de vida. La API promedia 5 muestras, las cifra con AES-256-GCM y compara por distancia euclidiana. Detalle en ADR-007 y marco legal en ADR-002.

## Despliegue

Un Web Service de Render definido en `render.yaml`. Healthcheck: `GET /api/health` (incluye ping a la base). El servidor escucha en `0.0.0.0:$PORT`. El sistema de archivos de Render es efímero: los PDF y Excel se generan en la respuesta y los archivos de la biblioteca van a Cloudinary (ADR-005). Cada push a `main` en GitHub dispara un deploy.
