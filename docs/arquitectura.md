# Ludoteka Campus — Arquitectura

> Última revisión: 2026-10-12 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest).

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
                           IA (AiService), reportes (renderPdf, renderWorkbook, ReportLog),
                           seguridad (helmet + CSP, throttler)
apps/api/src/modules       identity, institution, learning, assessment, integrity, gamification,
                           arena, library, study, tutor, biometrics, analytics, certification,
                           notifications, legal, health
apps/web/src/app           router y shell (campus, navegación por rol)
apps/web/src/features      pantallas, alineadas a los módulos
apps/web/src/shared        cliente API, auth, voz, face-api
packages/contracts         esquemas zod compartidos
db/migrations              SQL versionado (documentado: 0000 a 0027)
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
| `forum.mention` | learning (foros) | notifications |
| `forum.best_answer` | learning (foros) | gamification (20 XP una vez), notifications |
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
- Las migraciones se aplican al arrancar y quedan en `schema_migrations`. La `0000` eliminó el esquema del prototipo de quizzes y solo corrió una vez (en una base vacía no encuentra tablas).
- La documentación cubre las migraciones **0000 a 0027** (31 archivos: dos `0011` y tres `0020`). El rango definitivo es el que liste `schema_migrations` en producción (Sentinel, E7/E9); si la última no es la 0027, se ajusta a lo que se lea ahí.
- **Post-15-oct:** en el repo hay además 0028 (`0028_library_sources_a` y `_b`), 0029 (`demo_courses`) y 0030 (`forum_social`), sin commit al 2026-10-12. Quedan fuera del ER, de E9 y de E12; su detalle está en `er-post-15oct.md`.
- **Hay dos migraciones `0011`:** `0011_library.sql` y `0011_library_citations.sql`.
  - Según Forge, esto puede saltarse una migración o romper el migrate en un deploy limpio.
  - Por inspección de `core/database/migrate.ts`, el id es el nombre completo del archivo sin `.sql`, así que no chocan. El orden es el de `readdirSync().sort()`, y `0011_library.sql` va antes que `0011_library_citations.sql` porque `.` ordena antes que `_`.
  - **Decisión de Nexus (9-oct): baja de bloqueo a verificación.** Se confirma corriendo el migrate sobre una base vacía (checklist Lab Innovación, punto 2).
  - Recomendación para después del freeze: renumerar o documentar la regla de nombres.

## Auth

JWT de acceso corto en memoria del cliente. Refresh opaco, con hash en `refresh_tokens`, en cookie `HttpOnly`. Contraseñas con argon2id. La recuperación no revela si el correo existe. Roles: `admin`, `coordinator`, `rector`, `teacher`, `student`, `guardian` (`directivo` se separó en coordinación y rectoría el 11-oct). Solo `teacher` y `admin` escriben contenido académico; la web declara los roles de cada ruta en `ROUTE_ROLES` y la API con `@Roles`.

Flujo de ingreso (ADR-010). Las cuentas las crea el administrador, una a una o por Excel.

1. El usuario entra con contraseña, y la API envía un código de 6 dígitos al correo.
2. Si el navegador ya es de confianza (cookie `lk_device`, 30 días), salta el código.
3. Una vez dentro, puede registrar una passkey (Face ID, Touch ID, huella o Windows Hello) o su rostro, para entrar después sin contraseña. Solo se registran desde una sesión verificada: el claim `amr` del JWT dice si se entró con código, dispositivo de confianza o passkey.
4. Si hay documentos legales pendientes, la web lleva a `/aceptar` antes del campus. Un menor con acudiente espera a que el acudiente acepte por él.

Seguridad web (ADR-009, `core/security`):

- `helmet` con CSP estricta, HSTS y `Permissions-Policy`.
- `@nestjs/throttler` en las rutas de autenticación: por IP y por IP más cuenta.
- `trust proxy` para leer la IP real detrás de Render.
- El build web sale sin mapas de código, y el código propio va con ofuscación ligera.

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

## Cambios del 2026-10-09 (commit `340b047`)

- **identity:** cuentas creadas solo por el administrador (`accounts.*`, importación Excel), login con contraseña + código por correo (`login_challenges`), dispositivos de confianza, passkeys WebAuthn, bloqueo progresivo por cuenta y familias de refresh (migración 0018).
- **legal (nuevo módulo):** términos, privacidad y cookies versionados, aceptación (por el acudiente si es menor) y solicitudes de habeas data (migración 0019).
- **settings:** preferencias de compañero (Luka o Luna) y tema.
- **web:** PWA con íconos, tema claro y oscuro, navegación por rol (`app/nav.ts`) y smoke E2E con Playwright (`apps/web/e2e`).
- **core/security:** encabezados (`helmet` + CSP) y límite de intentos (`@nestjs/throttler`), ADR-009.
- **web/legal:** páginas `/legal/terminos`, `/legal/privacidad` y `/legal/cookies`, `/aceptar` y la sección Privacidad de Ajustes (descarga de datos y solicitud de eliminación).
- **Compatibilidad:** build con objetivo Safari 14, `MobileShell` para teléfono y pruebas de Playwright en WebKit (iPhone, iPad y Safari Mac) y Chromium (Android).
