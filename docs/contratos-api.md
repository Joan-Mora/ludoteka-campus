# Ludoteka Campus — Contratos de la API

> Última revisión: 2026-10-09 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest).
> **Fuente:** el código NestJS de `apps/api/src` en 2Klair, incluidos los cambios sin commit del 9-oct, y los esquemas zod de `packages/contracts/src/index.ts`. Este documento reemplaza al `contratos-api.md` del 28-sep, que describía la API Express ya retirada.
> Lo que no se pudo confirmar en el código está marcado como **no verificado**.

## 1. Convenciones generales

- **Prefijo:** todo cuelga de `/api` (`app.setGlobalPrefix('api')`). Socket.IO va en `/socket.io`.
- **Autenticación:** el guardia `JwtAuthGuard` es global. Cada ruta exige `Authorization: Bearer <accessToken>` (JWT de 20 min) salvo las marcadas `@Public`. `RolesGuard` aplica `@Roles(...)`, a nivel de método o de controlador.
- **Cookies** (`HttpOnly`, `SameSite=Lax`, `Secure` en producción, `path=/api/auth`):
  - `eq_refresh`: refresh opaco, 14 días.
  - `lk_device`: dispositivo de confianza, 30 días.
- **Validación:** los cuerpos pasan por esquemas zod (`ZodPipe`). Si fallan: `400 VALIDATION`.
- **Formato de error:** `{"error":{"code":"<CODIGO>","message":"<texto en español>"}}`. Un error no controlado devuelve `500 INTERNAL` ("Error interno") y solo se registra el mensaje.
- **Contraseña temporal:** con `must_change_password`, cualquier ruta salvo el cambio de clave responde `403 PASSWORD_CHANGE_REQUIRED`. Qué rutas exceptúa el guardia exactamente: **no verificado**.

## 2. Identidad y sesión (`identity`)

### 2.1 Flujo de ingreso

1. `POST /api/auth/login` `{email, password}` (público).
   - Si la cookie `lk_device` es válida para ese usuario: emite la sesión directamente (método `trusted_device`).
   - Si no: responde `{otp:{challengeId, maskedEmail}}` y envía un código de 6 dígitos al correo. Fuera de producción la respuesta incluye además `devCode`.
2. `POST /api/auth/otp/verify` `{challengeId, code, trustDevice?}` (público): emite la sesión (método `otp`). Si `trustDevice` es `true`, crea `lk_device` por 30 días.
3. `POST /api/auth/otp/resend` `{challengeId}` (público): reenvía el código. Hay que esperar 30 s entre envíos (`429 OTP_WAIT`).
4. **Respuesta de sesión:** `accessToken` y `user` en el cuerpo, más la cookie `eq_refresh`. La forma exacta de `user`: **no verificado**.

**Destino del correo:** las cuentas `@eduquest.local` reciben el código en `LAB_OTP_INBOX` si esa variable está definida; si no, en su propia dirección.

| Método | Ruta | Acceso | Notas |
|---|---|---|---|
| POST | `/auth/login` | Público | Ver el flujo de arriba |
| POST | `/auth/otp/verify` | Público | El código vence en 10 min, admite 5 intentos y sirve una sola vez |
| POST | `/auth/otp/resend` | Público | Espera de 30 s |
| POST | `/auth/refresh` | Público (cookie) | Rota el refresh. Reusar uno viejo revoca toda la familia (`SESSION_REUSED`) |
| POST | `/auth/logout` | Público (cookie) | Revoca el refresh y borra la cookie |
| POST | `/auth/logout-all` | Autenticado | Revoca todas las sesiones del usuario |
| POST | `/auth/password` | Autenticado | Cambio de clave. Revoca los otros refresh y emite una sesión nueva |
| POST | `/auth/forgot` | Público | `{email}`. Responde igual exista o no el correo. Crea un token de 1 h (se guarda su hash) y envía el enlace `/restablecer?token=…` |
| POST | `/auth/reset` | Público | `{token, password}`. Exige una clave fuerte, marca el token como usado y desbloquea la cuenta |
| GET | `/auth/me` | Autenticado | Usuario actual |

### 2.2 Passkeys (WebAuthn, `@simplewebauthn/server`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/auth/passkeys` | Autenticado |
| POST | `/auth/passkey/register/options` · `/register/verify` | Autenticado, con sesión verificada (`otp`, `trusted_device` o `passkey`); si no, `403 STEP_UP_REQUIRED` |
| PATCH / DELETE | `/auth/passkeys/:id` | Autenticado |
| POST | `/auth/passkey/login/options` · `/login/verify` | Público |

El origen confiable (relying party) es `APP_PUBLIC_URL` más los orígenes de `CORS_ORIGIN` con el mismo host.

### 2.3 Sesiones, dispositivos y preferencias (`settings`)

| Método | Ruta |
|---|---|
| GET / PUT | `/me/preferences` (compañero `luka` o `luna`; tema `light`, `dark` o `system`) |
| GET / DELETE | `/auth/sessions`, `/auth/sessions/:id` |
| GET / DELETE | `/auth/devices`, `/auth/devices/:id` |

### 2.4 Cuentas: alta por el administrador (`accounts`, todo `@Roles('admin')`)

| Método | Ruta | Uso |
|---|---|---|
| GET / POST | `/admin/users` | Listar y crear cuentas (registro de usuarios, EQ-P05) |
| PATCH | `/admin/users/:id` | Editar o desactivar |
| GET | `/admin/users/template.xlsx` | Plantilla de importación |
| POST | `/admin/users/import/preview` · `/import/commit` | Importación masiva por Excel |
| GET | `/admin/imports` | Historial de importaciones |
| GET | `/admin/users/:id/activity` | Actividad |
| POST | `/admin/users/:id/resend-access` · `/force-password` · `/revoke-sessions` | Reenviar acceso, forzar cambio de clave y cerrar sesiones |
| GET / POST | `/admin/structure/template.xlsx` · `/admin/structure/import` | Importar la estructura institucional |

No hay ruta pública de autoregistro. El cuerpo de `POST /admin/users` y si la clave inicial es temporal y se envía por correo: **no verificado**.

### 2.5 Acudientes (`guardians`)

| Método | Ruta | Acceso | Notas |
|---|---|---|---|
| GET | `/guardian/students` | `guardian` | Hijos vinculados y estado de cada autorización |
| POST | `/guardian/authorizations` | `guardian` | `{studentId, scope, granted}`. Con `scope=facial` y `granted=false`: anota `guardian_authorizations`, pone `users.guardian_consent_at = NULL`, escribe `audit_log` `guardian.revoke` y, después del commit, emite `guardian.facial_revoked` |
| GET / POST / DELETE | `/admin/guardian-links[/:id]` | `admin`, `coordinator` | Vínculos entre acudiente y estudiante |

## 3. Facial (`biometrics`, prefijo `/facial`)

Constantes: modelo `face-api-resnet34-128`, descriptor de 128 valores entre −2 y 2, retos `blink`, `turn_left` y `turn_right`.

| Método | Ruta | Acceso | Cuerpo y respuesta |
|---|---|---|---|
| GET | `/facial/consent` | Autenticado | Estado: consentimiento, versión, si está registrado, etc. Los campos exactos (por ejemplo `needsReconsent`): **no verificado** |
| POST | `/facial/consent` | Autenticado | `{accepted:true}` |
| POST | `/facial/challenge` | Público | Reto de prueba de vida de un solo uso, que vence (en memoria del proceso) |
| POST | `/facial/enroll` | Autenticado, con sesión verificada | `{samples: descriptor[3..10], challengeId, modelId}`. Cualquier clave de imagen responde `400 IMAGE_NOT_ALLOWED` |
| DELETE | `/facial/enroll` | Autenticado | Borra la propia plantilla y deja `audit_log` `facial.delete` |
| GET | `/facial/attempts` | Autenticado | Intentos propios (`face_attempts`) |
| POST | `/facial/login` | Público | `{email?, descriptor, challengeId, modelId}` → `{accessToken, user, distance}` más la cookie `eq_refresh`. Sin OTP |
| POST | `/facial/guardian-consent` | `admin`, `coordinator` | `{userId}`: registra el consentimiento del acudiente para un menor |

**Claves de imagen rechazadas:** `image`, `photo`, `selfie`, `picture`, `blob`, `dataurl`, `data_url`, `frame`, `jpeg`, `png`, `base64`.

## 4. Voz

No hay endpoints de voz. El dictado (`SpeechRecognition`), los comandos de navegación y la lectura en voz alta (`speechSynthesis`) corren solo en el navegador (`apps/web/src/shared/voice.ts`). El texto dictado llega a la API como texto normal, por ejemplo a `/tutor/chat`.

## 5. Reportes (PDF y Excel)

Cada archivo lleva título, fecha, datos de la BD y el código `LK-AAAA-NNNNNN`, registrado en `report_log`.

| Método | Ruta | Roles |
|---|---|---|
| GET | `/reports/bulletin/:userId/pdf` | teacher, admin, coordinator, rector, student, guardian. El PDF muestra la firma de rectoría si el boletín del periodo está firmado |
| GET | `/reports/courses/:id/excel` | teacher, admin, coordinator, rector |
| GET | `/reports/assessments/:id/excel` | teacher, admin, coordinator, rector |
| GET | `/reports/integrity/:courseId/pdf` · `/excel` | teacher, admin, coordinator, rector |
| GET | `/reports/usage/excel` | admin, coordinator, rector |
| GET | `/reports/roster/excel` | admin, coordinator, rector |
| GET | `/gradebook/courses/:id/report/excel` · `/pdf` | Según los roles del controlador `gradebook` |
| GET | `/public/certificates/:code` · `/:code/pdf` | Público |
| GET | `/public/reports/:code` | Pública según el uso de la web (`VerifyReportPage`). La presencia del decorador `@Public` en `core/reports/reports.module.ts`: **no verificado**. Devuelve código, tipo, formato, título, filas, fecha y autor |
| GET | `/reports/log` | Historial de reportes. Los roles: **no verificado** |

El PDF lleva un QR y un pie con el código y la URL `APP_PUBLIC_URL/verificar-reporte/<código>`.

## 6. Legal y habeas data (`legal`, nuevo el 9-oct)

| Método | Ruta | Acceso | Notas |
|---|---|---|---|
| GET | `/legal/documents` | Público | Última versión de términos, privacidad y cookies |
| GET | `/legal/status` | Autenticado | Pendientes propios y de los hijos (para el acudiente) |
| POST | `/legal/accept` | Autenticado | `{wards?, guardianPresent?}`. Un menor con acudiente activo recibe `403 GUARDIAN_MUST_ACCEPT`. Un menor sin acudiente debe declarar `guardianPresent` (si no, `400 GUARDIAN_DECLARATION`) |
| GET / POST | `/me/data-requests` | Autenticado | Pedir exportar o borrar datos |
| GET | `/me/export` | Autenticado | Exportación de los datos propios |
| GET / PATCH | `/admin/data-requests[/:id]` | `admin` | Atender solicitudes |

## 6 bis. Gobierno escolar (`governance`, fase 2 de Ludoteka 2)

| Método | Ruta | Acceso | Notas |
|---|---|---|---|
| GET | `/coordination/alerts[?status=open\|acknowledged\|resolved]` | `coordinator`, `admin` | Alertas de todos los cursos con conteo de notas, última nota, citaciones próximas y acudientes. Sin `status`: abiertas y en seguimiento, más el resumen por estado |
| GET | `/coordination/alerts/:id` | `coordinator`, `admin` | Bitácora, acudientes y citaciones del estudiante |
| POST | `/coordination/alerts/:id/notes` | `coordinator`, `admin` | `{body, status?}`. Una alerta abierta pasa a `acknowledged`; `resolved` la cierra y guarda quién |
| GET | `/coordination/attendance?days=30` | `coordinator`, `admin` | Por grupo, estudiantes sobre el umbral (3 faltas o 15 %) y faltas por día |
| GET / POST | `/coordination/meetings[?scope=upcoming\|past]` | `coordinator`, `admin` | Citaciones. POST `{studentId, scheduledAt, mode, place, reason, alertId?}` crea una por acudiente activo (mínimo 30 minutos a futuro), avisa en el campus y envía correo |
| PATCH | `/coordination/meetings/:id` | `coordinator`, `admin` | `{status: held\|cancelled, outcome?}` |
| GET | `/coordination/students?q=` | `coordinator`, `admin` | Buscador para citar |
| GET | `/rectoria/dashboard[?period=<id>\|year]` | `rector`, `admin` | Promedio (1 a 5), aprobación, asistencia, alertas y uso de IA por grado y grupo, con diferencia frente al periodo anterior |
| GET | `/rectoria/signatures` | `rector`, `admin` | Certificados y boletines en `pending_signature`, y las 15 decisiones más recientes |
| POST | `/rectoria/signatures/certificates/:id` · `/bulletins/:id` | `rector` | `{approve, note?}`. Devolver exige nota. Queda en `audit_log` y avisa al solicitante (y al estudiante si se firma) |
| POST | `/bulletins/requests` | `teacher`, `coordinator`, `admin` | `{studentId}`. El docente solo para sus estudiantes; `409 ALREADY_PENDING` si ya espera firma |
| GET | `/bulletins/status?students=a,b` | Personal | Estado del boletín del periodo por estudiante |
| GET | `/family/children` | `guardian` | Por hijo: lo que viene en 14 días, notas recientes, asistencia de 30 días, docentes, alertas, citaciones, mensajes sin leer y perfil de aprendizaje; más el estado del resumen semanal |
| POST | `/family/meetings/:id/respond` | `guardian` | `{attending, note?}` |
| PUT / POST | `/family/digest` | `guardian` | PUT `{enabled}` activa o apaga el resumen de los viernes; POST lo envía ya |
| GET | `/messages/contacts` · `/messages/threads` · `/messages/unread` | `guardian`, `teacher` | Contactos permitidos, conversaciones y conteo sin leer |
| GET | `/messages/:studentId/:counterpartId` | `guardian`, `teacher` | Mensajes del par acudiente–docente sobre un estudiante; los marca como leídos |
| POST | `/messages` | `guardian`, `teacher` | `{studentId, counterpartId, body}`. Solo si el acudiente está vinculado al estudiante y el docente le dicta clase |

`POST /news` acepta `official: true` solo de `rector` (`403 FORBIDDEN` para los demás); `GET /news/targets` devuelve `canOfficial`. En los foros, `canPost` es falso para coordinación y rectoría: leen y moderan, no publican.

## 7. Resto de módulos (resumen de rutas)

| Módulo | Rutas principales |
|---|---|
| health | `GET /health` (público, ping a la BD) |
| institution | `GET/POST /institution/{years,grades,groups,subjects,enrollments,teaching}` (POST solo admin), `GET /institution/overview` |
| learning | `/courses`, `/courses/:id/{units,assignments,announcements,events}`, `/units/:id/lessons`, `/lessons/:id[/complete]`, `/assignments/:id/submit`, `/submissions/:id/grade`, `/home/feed` |
| community | `/news[...]` (pin, read, ack, receipts), `/courses/:id/forum`, `/forum/threads/:id[/posts]`, `/forum/posts/:id[/answer]` |
| assessment | `/questions[...]`, `/assessments[/:id/start]`, `/attempts/:id[/answers,/submit]`, `/live[...]` |
| integrity | `POST /attempts/:id/integrity` (student; tipo `fullscreen_exit`, `visibility_hidden`, `blur` o `escape`), `GET /courses/:id/integrity` |
| gradebook | `/gradebook/courses/:id/{categories,attendance,rubrics,alerts,report}`, `/gradebook/rubrics/:id[/scores]`, `/gradebook/alerts/:id` |
| arena | `/arena/rooms[/:id/{vote,lock,command,control}]`, `/arena/join` |
| tutor | `POST /tutor/chat` (student, teacher; `403 KIOSK_ACTIVE` con un examen o sala en vivo activos), `/tutor/drafts`, `/courses/:id/recommendations`, `/route[...]`, `/courses/:id/mastery` |
| study | `/study`, `/study/pages[...]` (summary, cards), `/study/cards[...]`, `/study/goals`, `/study/focus[...]` |
| library | `/library/{catalog,items,glossary,ask}`, `/library/uploads/ticket`, `/library/items/:id/{bookmark,reindex}` |
| observatory | `GET /observatory/schema`, `GET /observatory/history`, `POST /observatory/ask` |
| gamification | `/gamification/{me,leaderboard,minigames}` |
| certification | `POST /certificates`, `GET /certificates/mine` |
| notifications | `GET /notifications`, `POST /notifications/:id/read` |
| analytics | `GET /analytics/{courses/:id,institution,students/:id/overview}`, `GET /campus` |

Los roles de cada ruta de `gradebook`, `study`, `observatory` y `library` (más allá de lo que muestra el listado): **no verificado** en detalle.

## 8. Tiempo real (Socket.IO)

- **Conexión:** con `auth.token` (el JWT) el socket se une a la sala `user:<id>` (alertas de integridad y notificaciones).
- **`live:join {code}`:** une el socket a la sala `live:<CODE>`. Si un socket sin token puede unirse a esa sala: **no verificado**.
- **Eventos emitidos:** `integrity:alert` y `arena:state`. La lista completa: **no verificado**.

## 9. Eventos de dominio (internos, `@nestjs/event-emitter`)

`lesson.completed`, `submission.graded`, `attempt.graded`, `integrity.violation`, `integrity.suspend`, `password.reset`, `tutor.message`, `news.published`, `forum.reply`, `guardian.facial_revoked`, `route.solved`, `arena.finished`, `study.progress`, `risk.alert_raised`, `meeting.scheduled`, `meeting.responded`, `guardian.message`, `signature.requested` y `signature.decided`.

## 10. Códigos de error

| HTTP | Código | Dónde |
|---|---|---|
| 400 | `VALIDATION` | Cualquier cuerpo inválido |
| 400 | `WEAK_PASSWORD` | Reset o cambio de clave: mínimo 8 caracteres, con al menos una letra y un número |
| 400 | `INVALID_PASSWORD`, `SAME_PASSWORD` | `/auth/password` |
| 400 | `INVALID_TOKEN` | `/auth/reset` |
| 400 | `OTP_EXPIRED`, `OTP_INVALID` | OTP |
| 400 | `PASSKEY_EXPIRED`, `PASSKEY_INVALID` | Passkeys (en el login de passkey, `PASSKEY_INVALID` es 401) |
| 400 | `IMAGE_NOT_ALLOWED`, `LIVENESS`, `QUALITY` | Facial |
| 400 | `GUARDIAN_DECLARATION`, `NOT_GUARDIAN`, `NOT_STUDENT` | Legal, vínculos |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `SESSION_RACE`, `SESSION_REUSED` | Sesión |
| 401 | `NO_MATCH`, `NO_TEMPLATE`, `AMBIGUOUS` | Login facial |
| 401 | `ACCOUNT_DISABLED` | `/auth/me` |
| 403 | `FORBIDDEN`, `NO_ROLE`, `ACCOUNT_DISABLED`, `PASSWORD_CHANGE_REQUIRED`, `STEP_UP_REQUIRED` | Auth y roles |
| 403 | `CONSENT_REQUIRED`, `GUARDIAN_CONSENT_REQUIRED`, `FACE_UNAVAILABLE` | Facial |
| 403 | `GUARDIAN_MUST_ACCEPT` | Legal |
| 403 | `KIOSK_ACTIVE` | Tutor |
| 404 | `NOT_FOUND` | General |
| 423 | `FACE_LOCKED` | Facial |
| 429 | `ACCOUNT_LOCKED`, `OTP_WAIT`, `OTP_LOCKED` | Login y OTP |
| 500 | `INTERNAL` | Filtro global |
| 503 | `STORAGE_OFF` | Biblioteca sin Cloudinary (según ADR-005; en el código: **no verificado**) |
