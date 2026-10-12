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

El panel «Qué puedo decir» (`voice-ui.tsx`) lista los comandos según el rol y deja tocarlos. Los comandos usan rutas que ya existen:

| Frase | Qué hace |
|---|---|
| «qué tengo pendiente» | Lee `GET /campus` y dice los totales por edificio y los dos primeros pendientes |
| «léeme la lección» | Lee la lección abierta o abre la siguiente pendiente (`pending.aula`) y la lee |
| «busca en la biblioteca …» | Abre `/app/biblioteca?q=…` |
| «empieza un reto de …» | Abre `/app/jugar?buscar=…`, que busca el juego por código, tema o título y empieza la partida |
| «pregúntale a Luka/Luna …» | Abre `/app/tutor?q=…&enviar=1`, que envía la pregunta y lee la respuesta en voz alta |

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

**Foros de curso (fase 5 de Ludoteka 2)**

| Método | Ruta | Roles | Notas |
|---|---|---|---|
| POST | `/courses/:id/forum` | `student`, `teacher`, `admin` | `{title, body, attachments?: uuid[] (máx. 5)}` |
| GET | `/courses/:id/forum` | Lectores del curso | Cada tema trae además `files` (adjuntos) y `mentioned` (te nombraron en alguna respuesta) |
| GET | `/courses/:id/forum/members` | `student`, `teacher`, `admin` | Docente y estudiantes activos del curso, sin incluirte; alimenta el autocompletado de `@` |
| GET | `/forum/threads/:id` | Lectores del curso | Por respuesta: `reactions[{kind, n, mine}]`, `mentions[{id, name}]`, `attachments[{id, title, kind}]`. Del tema: `attachments`, `canSummarize` y, solo para quien modera, `summary`, `summary_at`, `summaryStale` |
| POST | `/forum/threads/:id/posts` | `student`, `teacher`, `admin` | `{body, mentions?: uuid[] (máx. 10), attachments?: uuid[]}`. Solo se guarda y avisa a quien es del curso y aparece como `@Nombre completo` en el texto. El autor del tema no recibe dos avisos si también lo nombran |
| POST | `/forum/posts/:id/reactions` | `student`, `teacher`, `admin` | `{kind: util\|idea\|gracias\|duda}` alterna la reacción. `409 OWN_POST` sobre un mensaje propio |
| POST | `/forum/posts/:id/answer` | `student`, `teacher`, `admin` | Alterna la mejor respuesta. La primera vez que se elige la respuesta de un estudiante (por otra persona) se emite `forum.best_answer`: 20 XP una sola vez por respuesta (`xp_ledger.source_type = 'forum_answer'`) y aviso de logro |
| POST | `/forum/threads/:id/summary[?force=1]` | `teacher`, `admin`, `coordinator` (quien modera) | `{summary, summary_at, source: cache\|llm\|fragmentos}`. El modelo recibe el hilo con seudónimos (`Estudiante N`, `Docente`, `Participante N`); se reemplazan los nombres de todo el curso también dentro del texto y se quitan correos y teléfonos. El servidor devuelve los nombres reales en la respuesta. Sin IA responde un conteo del hilo (`fragmentos`) que no se guarda |
| DELETE | `/forum/threads/:id` | Quien modera | Borra el tema con sus respuestas, reacciones, menciones y adjuntos |

Los adjuntos deben ser documentos publicados de la biblioteca general (`public`, `institution`) o del mismo curso; si no, `400 ATTACHMENT_NOT_VISIBLE`. Así todo el curso puede abrirlos.

## 6 ter. Arcade, logros, notificaciones y campus (fase 4 de Ludoteka 2)

**Arcade** (`arcade`, todo `@Roles('student')`). Las preguntas y respuestas viven en `arcade_sessions`; el cliente solo recibe enunciados y el servidor califica cada respuesta.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/arcade` | `{games[], daily, xpToday, xpCap}`. Cada juego trae su tema (el primero del estudiante para su generador), mejor puntaje y partidas. `daily` es el reto del día (mismo juego para todo el colegio, nivel 4, una partida) |
| GET | `/arcade/ranking?scope=week\|daily` | Ranking del grupo: semana (suma del mejor puntaje por juego) o reto del día |
| POST | `/arcade/sessions` | `{game, topicId?, daily?}` → `{id, game, level, daily, seconds, total, items[]}` sin respuestas. `403 KIOSK_ACTIVE` con un examen activo; `400 NOT_DAILY`, `409 DAILY_DONE`, `400 TOPIC_MISMATCH`, `409 NO_CONTENT` |
| POST | `/arcade/sessions/:id/answer` | `{index, answer}` → `{ok, points, answer?, explanation}`. `409 TIME_UP` (plazo del juego más 3 s de gracia), `409 ALREADY_ANSWERED`, `400 BAD_INDEX`, `400 BAD_ANSWER` |
| POST | `/arcade/sessions/:id/finish` | `{score, correct, total, xp, dailyBonus, capped, perfect, best, newBest}`. XP = hasta 30 por aciertos + 10 si es perfecta (máximo 40), +15 en el reto del día, con tope de 150 XP diarios. Repetir el cierre devuelve el mismo resultado |

**Logros** (`gamification`).

| Método | Ruta | Roles | Notas |
|---|---|---|---|
| GET | `/gamification/me` | Autenticado | XP, nivel, racha (vuelve a 0 si pasó más de un día), misiones, certificados y `achievements[]`: `{code, name, description, category, icon, tier (0 a 3), maxTier, thresholds[], progress, next, hidden, seasonal, isNew, awardedAt}`. Las ocultas no ganadas llegan sin nombre ni descripción. Más `season {id, name, endsAt}`, `pastSeasons[]` y `unseen` |
| POST | `/gamification/seen` | `student` | Marca vistas las insignias nuevas; emite `badges.seen`, que también lee las notificaciones de logros |
| GET | `/gamification/leaderboard` | Autenticado | Liga semanal |

**Notificaciones** (`notifications`). Cada aviso tiene `kind` (`aviso`, `cartelera`, `foro`, `logro`, `integridad`, `seguimiento`, `citacion`, `mensaje`, `firma`, `certificado`), `link` (ruta interna `/app...` o nulo), `building` (edificio del campus) y `entity_id` (lo que lo originó).

| Método | Ruta | Notas |
|---|---|---|
| GET | `/notifications?estado=sin-leer&tipo=<kind>&limite=<1..100>` | `{items[{id, title, body, kind, link, building, read_at, created_at}], unread, kinds[{kind, total, unread}]}` |
| POST | `/notifications/:id/read` | Solo las propias (UUID validado) |
| POST | `/notifications/read-all?tipo=<kind>` | Todas o solo las de un tipo |

Leer un aviso de la cartelera (`news.read`) marca leída su notificación, y ver la sala de trofeos (`badges.seen`) marca leídas las de logros. Las insignias ganadas juntas generan una sola notificación.

**Campus** (`analytics`). `GET /campus` → `{buildings: {aula, biblioteca, lab, arena, trofeos, cartelera, cuaderno, ruta}, pending: {<edificio>: [{title, meta, link}]}, pulse}`. Cada número cuenta lo que el usuario tiene **por hacer** en ese edificio y `pending` trae hasta 5 elementos navegables (solo para edificios con número mayor que 0):

| Edificio | Estudiante | Docente | Acudiente | Coordinación | Rectoría |
|---|---|---|---|---|---|
| aula | Tareas sin entregar que vencen en ±7 días y la siguiente lección de cada curso | Entregas por calificar | Citaciones sin responder y mensajes sin leer | 0 | 0 |
| cartelera | Avisos sin leer (todos los roles) | | | | |
| biblioteca | Recursos visibles publicados desde la última visita (o en 14 días) | | | | |
| arena | Salas de Arena y en vivo abiertas en las últimas 3 h | | | | |
| trofeos | Insignias sin ver | 0 | 0 | 0 | 0 |
| cuaderno | Tarjetas para repasar hoy | 0 | 0 | Alertas abiertas | Certificados y boletines por firmar |
| ruta | Retos pendientes de la ruta | 0 | 0 | 0 | 0 |

Las salas de Arena y en vivo sin cerrar en 3 horas se dan por terminadas al arrancar y cada 10 minutos.

## 6 quater. Contenido de la biblioteca

`GET /library/items?q=&subjectId=&gradeId=&kind=&tag=&saved=1` devuelve, además de los campos de siempre, `grade`, `course`, `source_name`, `source_url` y `license`. Con `gradeId` llegan los recursos de ese grado más los que no tienen grado (los documentos de todos los grados). `subjectId` y `gradeId` que no sean UUID se ignoran. `GET /library/items/:id` incluye también los nombres de `grade` y `course`.

La siembra (`npm run library:seed -w @eduquest/api`, idempotente, `-- --dry` para simular) lee `db/seeds/library/manifest.json`:

| Bloque | Qué crea |
|---|---|
| `subjects` | MAT, LEN, CNA, CSO e ING si faltan |
| grupos y cursos | Un grupo `<grado>A` por grado y un curso por grado y materia. Si ya existe un curso real para ese grupo y materia, se reutiliza; si no, se crea uno de demostración (`is_demo`, publicado) a cargo de un docente demo **deshabilitado**, con una unidad «Guías de la biblioteca» y una lección por guía |
| `guides` (60) | Guía propia por grado (6 a 11) y materia, 2 por curso, con los DBA que trabaja. El texto está en `db/seeds/library/guides/<slug>.json`; el PDF se genera con pdfkit, se sube a Cloudinary, queda con visibilidad `course` y se indexa (fragmentos y embeddings). Su glosario va directo a `glossary_terms` |
| `documents` (9) | DBA de Matemáticas, Lenguaje, Ciencias Naturales y Ciencias Sociales y el esquema curricular de inglés (MEN, en Colombia Aprende): PDF que se indexa **desde su URL oficial**, sin copia en Cloudinary, porque no tienen licencia abierta. Libros de OpenStax en español (CC BY 4.0) como enlaces |

`/api/courses` lista primero los cursos reales y después los de demostración (`demo: true`).

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
| tutor | `POST /tutor/chat` (student, teacher; `403 KIOSK_ACTIVE` con un examen o sala en vivo activos; `method` opcional cambia el estilo y, si falta, se usa el del perfil del estudiante), `/tutor/drafts`, `/courses/:id/recommendations`, `/route[...]` (`POST /route/generate` acepta `method` y `boss`; el jefe exige nivel 4 y uno pendiente a la vez), `GET /route/topics/:id/examples` (student; 3 ejemplos resueltos sin IA), `/courses/:id/mastery` |
| profile | `GET /profile` (student; perfil, `canTake`, estadísticas por método de 60 días y recomendación), `POST /profile` (student; `{version, answers[12]}`, `409 ALREADY_TAKEN` si ya respondió en el periodo), `POST /profile/activity` (student), `GET /profile/courses/:id/distribution` (teacher solo de sus cursos, admin, coordinator, rector) |
| study | `/study`, `/study/pages[...]` (summary, cards), `/study/cards[...]`, `/study/goals`, `/study/focus[...]` |
| library | `/library/{catalog,items,glossary,ask}`, `/library/uploads/ticket`, `/library/items/:id/{bookmark,reindex}` (sección 6 quater) |
| observatory | `GET /observatory/schema`, `GET /observatory/history`, `POST /observatory/ask` |
| gamification | `GET /gamification/{me,leaderboard}`, `POST /gamification/seen` (sección 6 ter) |
| arcade | `GET /arcade`, `GET /arcade/ranking`, `POST /arcade/sessions[/:id/{answer,finish}]` (sección 6 ter) |
| certification | `POST /certificates`, `GET /certificates/mine` |
| notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` (sección 6 ter) |
| analytics | `GET /analytics/{courses/:id,institution,students/:id/overview}`, `GET /campus` |

Los roles de cada ruta de `gradebook`, `study`, `observatory` y `library` (más allá de lo que muestra el listado): **no verificado** en detalle.

## 8. Tiempo real (Socket.IO)

- **Conexión:** con `auth.token` (el JWT) el socket se une a la sala `user:<id>` (alertas de integridad y notificaciones).
- **`live:join {code}`:** une el socket a la sala `live:<CODE>`. Si un socket sin token puede unirse a esa sala: **no verificado**.
- **Eventos emitidos:** `integrity:alert` y `arena:state`. La lista completa: **no verificado**.

## 9. Eventos de dominio (internos, `@nestjs/event-emitter`)

`lesson.completed`, `submission.graded`, `attempt.graded`, `integrity.violation`, `integrity.suspend`, `password.reset`, `tutor.message`, `news.published`, `forum.reply`, `guardian.facial_revoked`, `route.solved`, `arena.finished`, `study.progress`, `risk.alert_raised`, `meeting.scheduled`, `meeting.responded`, `guardian.message`, `signature.requested`, `signature.decided`, `profile.saved`, `arcade.finished`, `badge.earned` (una sola vez por evaluación, con la lista `badges[{code, name, tier, maxTier}]`), `badges.seen` y `news.read`.

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
| 403 | `KIOSK_ACTIVE` | Tutor y Arcade |
| 400 | `NOT_DAILY`, `TOPIC_MISMATCH`, `BAD_INDEX`, `BAD_ANSWER` | Arcade |
| 404 | `NOT_FOUND` | General |
| 409 | `DAILY_DONE`, `NO_CONTENT`, `FINISHED`, `TIME_UP`, `ALREADY_ANSWERED` | Arcade |
| 423 | `FACE_LOCKED` | Facial |
| 429 | `ACCOUNT_LOCKED`, `OTP_WAIT`, `OTP_LOCKED` | Login y OTP |
| 500 | `INTERNAL` | Filtro global |
| 503 | `STORAGE_OFF` | Biblioteca sin Cloudinary (según ADR-005; en el código: **no verificado**) |
