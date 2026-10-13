# API

API REST bajo `/api`, servida por el mismo proceso que la web. Los esquemas de entrada son los de `packages/contracts` (zod) y los usan tanto la API como la web.

## Convenciones

**Autenticación.** Toda ruta exige `Authorization: Bearer <token de acceso>` salvo las públicas. El token se obtiene en `/api/auth/login` (o tras `/api/auth/otp/verify`), dura 20 minutos y se renueva con `POST /api/auth/refresh`, que lee la cookie `eq_refresh`. El cliente debe enviar `credentials: 'include'` en las rutas de `/api/auth`. Detalle en [Seguridad](manuales/Security.md#sesiones).

**Errores.** Siempre con la misma forma:

```json
{ "error": { "code": "SESSION_ACTIVE", "message": "Este navegador ya tiene abierta la sesión de …", "details": {} } }
```

`message` está en español y se puede mostrar al usuario. `details` es opcional.

| HTTP | Códigos frecuentes |
|---|---|
| 400 | `VALIDATION` (primer error de zod), `OTP_INVALID`, `OTP_EXPIRED`, `WEAK_PASSWORD` |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `SESSION_RACE` (reintentar el refresh), `SESSION_REUSED` |
| 403 | `FORBIDDEN` (rol), `READ_ONLY` (supervisión intentando escribir), `PASSWORD_CHANGE_REQUIRED`, `STEP_UP_REQUIRED`, `ACCOUNT_DISABLED`, `GUARDIAN_MUST_ACCEPT` |
| 404 | `NOT_FOUND` |
| 409 | `SESSION_ACTIVE` (otra cuenta abierta en el navegador), `REQUEST_OPEN` |
| 423 | `FACE_LOCKED` |
| 429 | `TOO_MANY_REQUESTS` (con `retryAfter`), `ACCOUNT_LOCKED`, `OTP_LOCKED`, `OTP_WAIT` |
| 500 | `INTERNAL` (sin detalles; el error queda en el registro del servidor) |

**Límite de intentos.** Las rutas marcadas «límite» aceptan 10 peticiones por IP y sujeto cada 5 minutos y 300 por IP cada 15 minutos.

**Archivos.** Los reportes PDF y Excel se generan en la respuesta (`Content-Disposition: attachment`). Los archivos de la biblioteca no pasan por la API: el navegador pide un ticket firmado (`POST /api/library/uploads/ticket`), sube directo a Cloudinary y luego registra el archivo (`POST /api/library/items`). Cada recurso de `GET /api/library/items` trae `thumbnail`. Es la portada generada por la API (`cover_url`, ver [Operación](operacion.md#biblioteca-y-embeddings)); si no la hay, la vista que dibuja Cloudinary (primera página del PDF, la imagen o un fotograma del video); si tampoco, `null`.

**Tiempo real.** Socket.IO en `/socket.io` con el token de acceso en `auth.token`. Eventos en [Arquitectura](manuales/Architecture.md#tiempo-real).

**Salud.** `GET /api/health` responde `{ ok, service, db }` con un ping a la base; lo usa Render como healthcheck.

## Endpoints

Generado a partir de los decoradores de los controladores (`@Get`, `@Post`, `@Roles`, `@Public`, `AuthThrottleGuard`). «Con sesión» significa cualquier rol autenticado; el servicio puede filtrar más por relación (por ejemplo, un docente solo ve sus cursos).

### Ingreso y sesión

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/auth/login` | Pública · límite |
| `POST` | `/api/auth/otp/verify` | Pública · límite |
| `POST` | `/api/auth/otp/resend` | Pública · límite |
| `POST` | `/api/auth/refresh` | Pública |
| `POST` | `/api/auth/logout` | Pública |
| `POST` | `/api/auth/logout-all` | Con sesión |
| `POST` | `/api/auth/password` | Con sesión · límite |
| `POST` | `/api/auth/forgot` | Pública · límite |
| `POST` | `/api/auth/reset` | Pública · límite |
| `GET` | `/api/auth/me` | Con sesión |

### Passkeys

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/auth/passkeys` | Con sesión |
| `POST` | `/api/auth/passkey/register/options` | Con sesión · límite |
| `POST` | `/api/auth/passkey/register/verify` | Con sesión · límite |
| `PATCH` | `/api/auth/passkeys/:id` | Con sesión |
| `DELETE` | `/api/auth/passkeys/:id` | Con sesión |
| `POST` | `/api/auth/passkey/login/options` | Pública · límite |
| `POST` | `/api/auth/passkey/login/verify` | Pública · límite |

### Ajustes, sesiones y dispositivos

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/me/preferences` | Con sesión |
| `PUT` | `/api/me/preferences` | Con sesión |
| `GET` | `/api/auth/sessions` | Con sesión |
| `DELETE` | `/api/auth/sessions/:id` | Con sesión |
| `GET` | `/api/auth/devices` | Con sesión |
| `DELETE` | `/api/auth/devices/:id` | Con sesión |

### Cuentas (administración)

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/users` | Admin |
| `POST` | `/api/admin/users` | Admin |
| `GET` | `/api/admin/users/template.xlsx` | Admin |
| `POST` | `/api/admin/users/import/preview` | Admin |
| `POST` | `/api/admin/users/import/commit` | Admin |
| `GET` | `/api/admin/imports` | Admin |
| `GET` | `/api/admin/users/:id/activity` | Admin |
| `PATCH` | `/api/admin/users/:id` | Admin |
| `POST` | `/api/admin/users/:id/resend-access` | Admin |
| `POST` | `/api/admin/users/:id/force-password` | Admin |
| `POST` | `/api/admin/users/:id/revoke-sessions` | Admin |
| `GET` | `/api/admin/structure/template.xlsx` | Admin |
| `POST` | `/api/admin/structure/import` | Admin |

### Acudientes

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/guardian/students` | Acud. |
| `POST` | `/api/guardian/authorizations` | Acud. |
| `GET` | `/api/admin/guardian-links` | Admin, Coord. |
| `POST` | `/api/admin/guardian-links` | Admin, Coord. |
| `DELETE` | `/api/admin/guardian-links/:id` | Admin, Coord. |

### Acceso facial

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/facial/consent` | Con sesión |
| `POST` | `/api/facial/consent` | Con sesión |
| `POST` | `/api/facial/challenge` | Pública · límite |
| `POST` | `/api/facial/enroll` | Con sesión · límite |
| `DELETE` | `/api/facial/enroll` | Con sesión |
| `GET` | `/api/facial/attempts` | Con sesión |
| `POST` | `/api/facial/login` | Pública · límite |
| `POST` | `/api/facial/guardian-consent` | Admin, Coord. |

### Legal y datos personales

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/legal/documents` | Pública |
| `GET` | `/api/legal/status` | Con sesión |
| `POST` | `/api/legal/accept` | Con sesión |
| `GET` | `/api/me/data-requests` | Con sesión |
| `POST` | `/api/me/data-requests` | Con sesión |
| `GET` | `/api/me/export` | Con sesión |
| `GET` | `/api/admin/data-requests` | Admin |
| `PATCH` | `/api/admin/data-requests/:id` | Admin |

### Institución

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/institution/years` | Admin, Coord., Rect., Docente |
| `POST` | `/api/institution/years` | Admin |
| `GET` | `/api/institution/grades` | Admin, Coord., Rect., Docente |
| `POST` | `/api/institution/grades` | Admin |
| `GET` | `/api/institution/groups` | Admin, Coord., Rect., Docente |
| `POST` | `/api/institution/groups` | Admin |
| `GET` | `/api/institution/subjects` | Admin, Coord., Rect., Docente |
| `POST` | `/api/institution/subjects` | Admin |
| `GET` | `/api/institution/enrollments` | Admin, Coord., Rect., Docente |
| `POST` | `/api/institution/enrollments` | Admin |
| `GET` | `/api/institution/teaching` | Admin, Coord., Rect., Docente |
| `POST` | `/api/institution/teaching` | Admin |
| `GET` | `/api/institution/overview` | Admin, Coord., Rect. |

### Cursos y lecciones

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/courses` | Con sesión |
| `GET` | `/api/home/feed` | Con sesión |
| `GET` | `/api/courses/:id` | Con sesión |
| `POST` | `/api/courses` | Docente, Admin |
| `POST` | `/api/courses/:id/units` | Docente, Admin |
| `POST` | `/api/units/:id/lessons` | Docente, Admin |
| `GET` | `/api/lessons/:id` | Con sesión |
| `POST` | `/api/lessons/:id/complete` | Estud. |
| `GET` | `/api/courses/:id/assignments` | Con sesión |
| `POST` | `/api/courses/:id/assignments` | Docente, Admin |
| `POST` | `/api/assignments/:id/submit` | Estud. |
| `POST` | `/api/submissions/:id/grade` | Docente, Admin |
| `GET` | `/api/courses/:id/announcements` | Con sesión |
| `POST` | `/api/courses/:id/announcements` | Docente, Admin |
| `GET` | `/api/courses/:id/events` | Con sesión |
| `POST` | `/api/courses/:id/events` | Docente, Admin |

### Cartelera y foros

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/news` | Con sesión |
| `GET` | `/api/news/targets` | Docente, Admin, Coord., Rect. |
| `POST` | `/api/news` | Docente, Admin, Coord., Rect. |
| `PATCH` | `/api/news/:id/pin` | Docente, Admin, Coord., Rect. |
| `DELETE` | `/api/news/:id` | Docente, Admin, Coord., Rect. |
| `POST` | `/api/news/:id/read` | Con sesión |
| `POST` | `/api/news/:id/ack` | Con sesión |
| `GET` | `/api/news/:id/receipts` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/courses/:id/forum` | Docente, Admin, Coord., Rect., Estud. |
| `POST` | `/api/courses/:id/forum` | Docente, Admin, Estud. |
| `GET` | `/api/courses/:id/forum/members` | Docente, Admin, Estud. |
| `GET` | `/api/forum/threads/:id` | Docente, Admin, Coord., Rect., Estud. |
| `POST` | `/api/forum/threads/:id/posts` | Docente, Admin, Estud. |
| `POST` | `/api/forum/threads/:id/summary` | Docente, Admin, Coord. |
| `POST` | `/api/forum/posts/:id/reactions` | Docente, Admin, Estud. |
| `PATCH` | `/api/forum/threads/:id` | Docente, Admin, Coord. |
| `DELETE` | `/api/forum/threads/:id` | Docente, Admin, Coord. |
| `POST` | `/api/forum/posts/:id/answer` | Docente, Admin, Estud. |
| `DELETE` | `/api/forum/posts/:id` | Docente, Admin, Coord., Estud. |

### Evaluaciones y sala en vivo

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/questions` | Docente, Admin |
| `POST` | `/api/questions` | Docente, Admin |
| `POST` | `/api/questions/:id/active` | Docente, Admin |
| `POST` | `/api/assessments` | Docente, Admin |
| `GET` | `/api/courses/:id/assessments` | Con sesión |
| `POST` | `/api/assessments/:id/start` | Estud. |
| `GET` | `/api/attempts/:id` | Con sesión |
| `POST` | `/api/attempts/:id/answers` | Estud. |
| `POST` | `/api/attempts/:id/submit` | Estud. |
| `GET` | `/api/live/hostable` | Docente, Admin |
| `POST` | `/api/live` | Docente, Admin |
| `POST` | `/api/live/join` | Estud. |
| `GET` | `/api/live/:id/state` | Docente, Admin |
| `GET` | `/api/live/:code` | Estud., Docente, Admin |
| `POST` | `/api/live/:id/next` | Docente, Admin |
| `POST` | `/api/live/:id/end` | Docente, Admin |
| `POST` | `/api/live/:id/answer` | Estud. |

### Planilla de notas

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/gradebook/courses/:id` | Docente, Admin, Coord., Rect. |
| `PUT` | `/api/gradebook/courses/:id/categories` | Docente, Admin |
| `GET` | `/api/gradebook/courses/:id/attendance` | Docente, Admin, Coord., Rect. |
| `PUT` | `/api/gradebook/courses/:id/attendance` | Docente, Admin |
| `GET` | `/api/gradebook/courses/:id/rubrics` | Docente, Admin, Coord., Rect. |
| `POST` | `/api/gradebook/courses/:id/rubrics` | Docente, Admin |
| `DELETE` | `/api/gradebook/rubrics/:id` | Docente, Admin |
| `PUT` | `/api/gradebook/rubrics/:id/scores` | Docente, Admin |
| `GET` | `/api/gradebook/courses/:id/alerts` | Docente, Admin, Coord., Rect. |
| `PATCH` | `/api/gradebook/alerts/:id` | Docente, Admin, Coord. |
| `GET` | `/api/gradebook/courses/:id/report/excel` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/gradebook/courses/:id/report/pdf` | Docente, Admin, Coord., Rect. |

### Integridad

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/attempts/:id/integrity` | Estud. |
| `GET` | `/api/courses/:id/integrity` | Docente, Admin, Coord., Rect. |

### Certificados

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/certificates` | Docente, Admin |
| `GET` | `/api/certificates/mine` | Con sesión |
| `GET` | `/api/public/certificates/:code` | Pública |
| `GET` | `/api/public/certificates/:code/pdf` | Pública |

### Arena

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/arena/rooms` | Estud., Docente, Admin, Coord., Rect. |
| `POST` | `/api/arena/rooms` | Docente, Admin |
| `POST` | `/api/arena/join` | Estud. |
| `GET` | `/api/arena/rooms/:id` | Estud., Docente, Admin, Coord., Rect. |
| `POST` | `/api/arena/rooms/:id/vote` | Estud. |
| `POST` | `/api/arena/rooms/:id/lock` | Estud. |
| `POST` | `/api/arena/rooms/:id/command` | Estud. |
| `POST` | `/api/arena/rooms/:id/control` | Docente, Admin |

### Arcade

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/arcade` | Estud. |
| `GET` | `/api/arcade/ranking` | Estud. |
| `POST` | `/api/arcade/sessions` | Estud. |
| `POST` | `/api/arcade/sessions/:id/answer` | Estud. |
| `POST` | `/api/arcade/sessions/:id/finish` | Estud. |

### Gamificación

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/gamification/me` | Con sesión |
| `POST` | `/api/gamification/seen` | Estud. |
| `GET` | `/api/gamification/leaderboard` | Con sesión |

### Cuaderno y estudio

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/study` | Estud. |
| `GET` | `/api/study/pages/:id` | Estud. |
| `POST` | `/api/study/pages` | Estud. |
| `PUT` | `/api/study/pages/:id` | Estud. |
| `DELETE` | `/api/study/pages/:id` | Estud. |
| `POST` | `/api/study/pages/:id/summary` | Estud. |
| `POST` | `/api/study/pages/:id/cards` | Estud. |
| `GET` | `/api/study/cards` | Estud. |
| `POST` | `/api/study/cards` | Estud. |
| `DELETE` | `/api/study/cards/:id` | Estud. |
| `POST` | `/api/study/cards/:id/review` | Estud. |
| `POST` | `/api/study/goals` | Estud. |
| `DELETE` | `/api/study/goals/:id` | Estud. |
| `POST` | `/api/study/focus` | Estud. |
| `POST` | `/api/study/focus/:id/finish` | Estud. |
| `POST` | `/api/study/focus/:id/cancel` | Estud. |

### Biblioteca

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/library/catalog` | Con sesión |
| `GET` | `/api/library/items` | Con sesión |
| `GET` | `/api/library/items/:id` | Con sesión |
| `POST` | `/api/library/uploads/ticket` | Docente, Admin |
| `POST` | `/api/library/items` | Docente, Admin |
| `PATCH` | `/api/library/items/:id` | Docente, Admin |
| `POST` | `/api/library/items/:id/reindex` | Docente, Admin |
| `DELETE` | `/api/library/items/:id` | Docente, Admin |
| `POST` | `/api/library/items/:id/bookmark` | Con sesión |
| `DELETE` | `/api/library/items/:id/bookmark` | Con sesión |
| `GET` | `/api/library/glossary` | Con sesión |
| `POST` | `/api/library/glossary` | Docente, Admin |
| `DELETE` | `/api/library/glossary/:id` | Docente, Admin |
| `POST` | `/api/library/ask` | Con sesión |

### Tutor IA

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/tutor/chat` | Estud., Docente |
| `POST` | `/api/tutor/drafts` | Docente, Admin |
| `POST` | `/api/courses/:id/recommendations` | Docente, Admin |
| `GET` | `/api/courses/:id/recommendations` | Docente, Admin, Coord., Rect. |

### Mi ruta

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/route` | Estud. |
| `POST` | `/api/route/generate` | Estud. |
| `GET` | `/api/route/topics/:id/examples` | Estud. |
| `POST` | `/api/route/items/:id/answer` | Estud. |
| `POST` | `/api/route/items/:id/skip` | Estud. |
| `GET` | `/api/courses/:id/mastery` | Docente, Admin, Coord., Rect. |

### Perfil de aprendizaje

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/profile` | Estud. |
| `POST` | `/api/profile` | Estud. |
| `POST` | `/api/profile/activity` | Estud. |
| `GET` | `/api/profile/courses/:id/distribution` | Docente, Admin, Coord., Rect. |

### Notificaciones

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/notifications` | Con sesión |
| `POST` | `/api/notifications/read-all` | Con sesión |
| `POST` | `/api/notifications/:id/read` | Con sesión |

### Coordinación, rectoría, familia y mensajes

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/coordination/alerts` | Coord., Admin |
| `GET` | `/api/coordination/alerts/:id` | Coord., Admin |
| `POST` | `/api/coordination/alerts/:id/notes` | Coord., Admin |
| `GET` | `/api/coordination/attendance` | Coord., Admin |
| `GET` | `/api/coordination/meetings` | Coord., Admin |
| `POST` | `/api/coordination/meetings` | Coord., Admin |
| `PATCH` | `/api/coordination/meetings/:id` | Coord., Admin |
| `GET` | `/api/coordination/students` | Coord., Admin |
| `GET` | `/api/rectoria/dashboard` | Rect., Admin |
| `GET` | `/api/rectoria/signatures` | Rect., Admin |
| `POST` | `/api/rectoria/signatures/certificates/:id` | Rect. |
| `POST` | `/api/rectoria/signatures/bulletins/:id` | Rect. |
| `POST` | `/api/bulletins/requests` | Docente, Coord., Admin |
| `GET` | `/api/bulletins/status` | Docente, Coord., Rect., Admin |
| `GET` | `/api/family/children` | Acud. |
| `POST` | `/api/family/meetings/:id/respond` | Acud. |
| `POST` | `/api/family/digest` | Acud. |
| `PUT` | `/api/family/digest` | Acud. |
| `GET` | `/api/messages/contacts` | Acud., Docente |
| `GET` | `/api/messages/threads` | Acud., Docente |
| `GET` | `/api/messages/unread` | Acud., Docente |
| `GET` | `/api/messages/:studentId/:counterpartId` | Acud., Docente |
| `POST` | `/api/messages` | Acud., Docente |
| `GET` | `/api/staff-messages/contacts` | Docente, Coord., Rect., Admin |
| `GET` | `/api/staff-messages/threads` | Docente, Coord., Rect., Admin |
| `GET` | `/api/staff-messages/unread` | Docente, Coord., Rect., Admin |
| `GET` | `/api/staff-messages/:userId` | Docente, Coord., Rect., Admin |
| `POST` | `/api/staff-messages` | Docente, Coord., Rect., Admin |

### Tableros y reportes

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/analytics/courses/:id` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/campus` | Con sesión |
| `GET` | `/api/analytics/institution` | Admin, Coord., Rect. |
| `GET` | `/api/analytics/students/:id/overview` | Docente, Admin, Coord., Rect., Estud., Acud. |
| `GET` | `/api/reports/bulletin/:userId/pdf` | Docente, Admin, Coord., Rect., Estud., Acud. |
| `GET` | `/api/reports/courses/:id/excel` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/reports/assessments/:id/excel` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/reports/integrity/:courseId/pdf` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/reports/integrity/:courseId/excel` | Docente, Admin, Coord., Rect. |
| `GET` | `/api/reports/usage/excel` | Admin, Coord., Rect. |
| `GET` | `/api/reports/roster/excel` | Admin, Coord., Rect. |

### Observatorio

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/observatory/schema` | Docente, Admin, Coord., Rect.¹ |
| `GET` | `/api/observatory/history` | Docente, Admin, Coord., Rect.¹ |
| `POST` | `/api/observatory/ask` | Docente, Admin, Coord., Rect.¹ |

### Verificación y archivo de reportes

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/public/reports/:code` | Pública |
| `GET` | `/api/reports/log` | Docente, Admin, Coord., Rect. |

### Salud

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/health` | Pública |

¹ El controlador no declara `@Roles`; el servicio rechaza a estudiantes y acudientes y limita al docente a sus grupos.
