# Ludoteka Campus — Página de Confluence (EQ-P08)

> Última revisión: 2026-10-09 · Responsable: Cronista · Entrega del esqueleto: lunes 12-oct
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest).
> **Uso:** copiar cada sección a una página del espacio de Confluence del equipo y pegar las capturas en "Evidencias". Esta página no lleva secretos ni claves.

- **URL pública:** https://ludoteka-campus.onrender.com (healthcheck `GET /api/health` → `{"ok":true,"db":"up"}` el 2026-10-09, 12:58 hora Colombia)
- **Repositorio:** https://github.com/Joan-Mora/ludoteka-campus (Darwin confirma que el docente tiene acceso)
- **Base de datos:** CockroachDB Cloud, la única base del proyecto
- **Cuentas de demo:** `admin@`, `coordinacion@`, `rectoria@`, `docente@`, `estudiante@`, `estudiante2@` y `acudiente@eduquest.local`. La clave sale de la variable `SEED_PASSWORD` del entorno de Render y no se publica aquí

## 0. Resumen de estado

Estados: **Con contenido** (el texto está listo; se indica el doc fuente), **Parcial** (falta una parte) y **Depende de Darwin** (se indica qué debe aportar).

| # | Sección (enunciado) | Estado | Fuente o qué falta |
|---|---------------------|--------|--------------------|
| 1 | Problema | Con contenido | `docs/vision.md` |
| 2 | Solución | Con contenido | `docs/vision.md`, `docs/RF-RNF.md` |
| 3 | Arquitectura | Con contenido | `docs/arquitectura.md`, `docs/adr/ADR-001…010` |
| 4 | Base de datos CockroachDB (ER, tablas, PK/FK, restricciones, consultas, CRUD, integridad) | Parcial | `docs/er.md` cubre 0000 a 0019 (incluidas las 9 tablas de 0018 y 0019). **Darwin:** diagrama ER exportado (imagen) y capturas de la consola de Cockroach |
| 5 | Reportes PDF/Excel | Con contenido | `apps/api/src/modules/analytics/analytics.controller.ts`, `core/reports`. **Darwin:** descargas reales para las evidencias |
| 6 | IA (tutor y demás) | Con contenido | ADR-006, `docs/arquitectura.md` §IA |
| 7 | Reconocimiento facial | Con contenido | ADR-002, ADR-007 |
| 8 | Captura de voz (EQ-P11) | Con contenido | `apps/web/src/shared/voice.ts` |
| 9 | Seguridad | Parcial | Riesgos conocidos R1, R3, R4, R5 y R7 (R2 y R6 cerrados el 9-oct). `LAB_OTP_INBOX` y el deploy ya están hechos. **Darwin:** (1) confirmar que `JWT_SECRET` y `SEED_PASSWORD` de Render son fuertes; (2) registrar los rostros de la demo (ver §9 y el Anexo B) |
| 10 | Integridad en exámenes: kiosco (EQ-C05) | Con contenido | `exam.tsx`, `integrity.service.ts` |
| 11 | Demo (guion de sustentación) | Con contenido | §11 |
| 12 | Deploy | Parcial | El servicio está en línea con la base arriba y corre el commit `340b047` del 9-oct. **Darwin:** captura del dashboard de Render en verde |
| 13 | Evidencias (capturas y videos) | Depende de Darwin | 0/16 obligatorias, con E14 confirmada como obligatoria y en ejecución, y 0/2 complementarias. **E0 (correo en producción) es un gate.** Dueños en §13 |
| 14 | Entregables (repo, scripts SQL, URL, Confluence) | Parcial | Repo, scripts y URL listos. **Darwin:** crear el espacio de Confluence y confirmar el acceso del docente al repo |
| A | Anexo: revocación facial (E14) | Parcial | QA Lab: ejecuta Speck, coordina Sentinel, comprometida para el lun 12-oct; caso escrito por Forge. En ejecución |
| B | Anexo: checklist Lab Innovación | Depende de Darwin | Guía de 8 puntos, sin tareas de build |

## De EduQuest a Ludoteka Campus

EduQuest nació el 28-sep como un quiz gamificado de Matemáticas de sexto con kiosco. El 5-oct Darwin lo reescribió como **Ludoteka Campus**, el campus virtual del CFA: un monolito modular NestJS + React sobre CockroachDB, con 98 tablas creadas en 20 migraciones (0000 a 0019) y 12 vistas `v_*`.

| Antes (EduQuest, 28-sep) | Ahora (Ludoteka Campus) |
|---|---|
| API Express en `api/`, web en `web/` y SQL en `sql/` | `apps/api` (NestJS 11 + Kysely), `apps/web` (React 19 + Vite), `packages/contracts` y `db/` |
| Quiz suelto con XP | Campus isométrico con Luka o Luna, Arena por equipos, Arcade y Mi ruta |
| Facial geométrico de laboratorio | face-api con 128 dimensiones, prueba de vida, AES-256-GCM y bloqueo (ADR-007) |
| Tutor de práctica | Tutor con citas (RAG), Cuaderno con resumen IA y Observatorio NL→SQL (ADR-006) |
| Registro público y login con contraseña | Registro de usuarios por el administrador (alta e importación por Excel), contraseña con código por correo, passkeys y dispositivo de confianza |
| 3 reportes | 8 tipos de reporte PDF/Excel con consecutivo `LK-AAAA-NNNNNN` verificable |
| Sin voz | Dictado, comandos y lectura en voz alta |

## 1. Problema — *Con contenido* (`docs/vision.md`)

El colegio no tiene un aula propia. Las apps de quiz no conocen los grupos, no guardan el recorrido del estudiante, no avisan a tiempo cuando alguien va mal y no sostienen un examen frente a la copia. Docentes y coordinación dependen de hojas de cálculo para notas, asistencia y reportes.

## 2. Solución — *Con contenido*

- **Estudiante:** recorre el campus: lecciones, tareas, exámenes en kiosco, Mi ruta, Cuaderno, Arcade, Arena y un tutor que cita la biblioteca. Puede usar la voz.
- **Docente:** publica contenido, arma el banco, dirige la Arena, califica con rúbricas, toma asistencia y recibe alertas de riesgo y de integridad.
- **Coordinación y rectoría:** ven indicadores, consultan en lenguaje natural (Observatorio) y descargan reportes.
- **Acudiente:** sigue el avance y las alertas, y autoriza o revoca el facial del menor.
- **Administrador:** gestiona años, grupos, materias, matrículas y usuarios. El registro de usuarios lo hace el administrador (alta individual o importación por Excel).

## 3. Arquitectura — *Con contenido* (`docs/arquitectura.md`, ADR-001 a ADR-010)

Monolito modular en un solo Web Service de Render. NestJS sirve `/api`, `/socket.io` y el build de React. Los módulos se hablan solo por su `public-api.ts`:

> identity, institution, learning, assessment, integrity, gamification, arena, library, study, tutor, biometrics, analytics, certification, notifications, legal y health

Gamificación, analítica y notificaciones reaccionan a eventos de dominio. `npm run deps:check` (dependency-cruiser) hace cumplir las fronteras.

Servicios externos:

- **CockroachDB Cloud:** datos.
- **Cloudinary:** archivos.
- **Gemini** (API compatible con OpenAI): IA.
- **Resend:** correo.

## 4. Base de datos CockroachDB — *Parcial*

| Punto del enunciado | Contenido | Estado |
|---|---|---|
| Modelo ER (Entidad → Atributos → PK/FK → Relaciones) | `docs/er.md`, tabla por tabla y por módulo | Con contenido: cubre 0000 a 0019, incluidas `login_challenges`, `trusted_devices`, `webauthn_credentials`, `webauthn_challenges`, `account_imports`, `user_preferences`, `legal_documents`, `legal_acceptances` y `data_requests` |
| Diagrama ER | — | Depende de Darwin: exportar la imagen (por ejemplo desde `.local/er.mjs` o dbdiagram) y pegarla aquí |
| Tablas, PK y FK | PK `UUID DEFAULT gen_random_uuid()`. FK con `ON DELETE CASCADE` o `SET NULL` según el caso. La única secuencia es `report_seq` | Con contenido (`er.md`, ADR-004) |
| Restricciones | `CHECK`, `UNIQUE` (incluidos parciales) y `NOT NULL`. Ejemplos: `users.failed_logins >= 0`, `legal_acceptances UNIQUE (user_id, document_id)` | Con contenido (`db/migrations`) |
| Consultas SQL | Consultas de evidencia y JOIN en `er.md` §Consultas de evidencia. 12 vistas `v_*` del Observatorio | Con contenido |
| CRUD | Institución (`/app/admin`), usuarios (alta, edición, importación Excel), banco de preguntas, biblioteca y rúbricas | Con contenido |
| Integridad de datos | FK y CHECK que fallan a propósito (`er.md` §Reglas de integridad). `withTx()` reintenta `40001` | Con contenido |
| Implementación real | Clúster en Cockroach Cloud, `SHOW TABLES` y `schema_migrations` | Depende de Darwin: capturas de la consola |

## 5. Reportes PDF/Excel — *Con contenido*

Cada reporte se genera al momento desde la BD y lleva **título**, **fecha de generación**, **datos consultados**, **estructura por secciones o columnas** y el **consecutivo `LK-AAAA-NNNNNN`**, que queda en `report_log` y se verifica en `/verificar-reporte/<código>`.

| Reporte | Formato | Ruta API | Roles |
|---|---|---|---|
| Boletín del estudiante | PDF | `GET /api/reports/bulletin/:userId/pdf` | docente, directivo, admin, estudiante (el suyo), acudiente (el de su hijo) |
| Curso | Excel | `GET /api/reports/courses/:id/excel` | docente, directivo, admin |
| Resultados de evaluación | Excel | `GET /api/reports/assessments/:id/excel` | docente, directivo, admin |
| Integridad | PDF y Excel | `GET /api/reports/integrity/:courseId/pdf` · `/excel` | docente, directivo, admin |
| Uso de biblioteca e IA | Excel | `GET /api/reports/usage/excel` | directivo, admin |
| Usuarios | Excel | `GET /api/reports/roster/excel` | directivo, admin |
| Certificado | PDF con QR | módulo certification · `/verificar/:code` | público para verificar |

## 6. IA — *Con contenido* (ADR-006, `arquitectura.md` §IA)

| Uso | Qué problema resuelve | Control |
|---|---|---|
| Tutor con citas (RAG) | Explica con fragmentos de las guías y cita la página | No da la respuesta final. Durante un examen responde `403 KIOSK_ACTIVE` |
| Mi ruta | Ejercicios al nivel de maestría de cada tema | El servidor recalcula la respuesta; si falla, usa una plantilla |
| Cuaderno | Resume apuntes y propone tarjetas SM-2 | Sin datos personales; resumen local si no hay IA |
| Observatorio | Preguntas en español convertidas a SQL | Vistas `v_*`, validador, `READ ONLY`, rol `ludoteka_reader` y nombres anonimizados |
| Banco de preguntas | Borradores para el docente | Quedan inactivas hasta revisión |

Cada llamada queda en `ai_usage` (funcionalidad y modelo, sin contenido). No salen datos personales de menores al proveedor.

## 7. Reconocimiento facial — *Con contenido* (ADR-002, ADR-007)

| Lo que pide el enunciado | Respuesta |
|---|---|
| Tecnología o librería | `@vladmandic/face-api` (TinyFaceDetector, 68 landmarks y FaceRecognitionNet) en el navegador. Los pesos se sirven desde `/models` |
| Cómo se captura | Cámara del navegador después de aceptar la política (Ley 1581). La API emite un reto de prueba de vida (parpadear o girar) y se toman 5 muestras mientras se hace el gesto. No sale ninguna foto del dispositivo |
| Cómo se compara | La API promedia las 5 muestras (y rechaza si se parecen poco: `QUALITY`). En el login calcula la distancia euclidiana contra la plantilla, con umbral `FACIAL_MAX_DISTANCE` (0,5) |
| Vínculo rostro-usuario | `face_templates.user_id` es PK y FK a `users` (`ON DELETE CASCADE`), con `ciphertext`, `iv`, `tag` (AES-256-GCM) y `model_id`. El login es 1:1 (correo + rostro) o 1:N con `AMBIGUOUS` si dos cuentas quedan cerca |
| Manejo de errores | `IMAGE_NOT_ALLOWED` (400), `CONSENT_REQUIRED` y `GUARDIAN_CONSENT_REQUIRED` (403), `LIVENESS` (400), `QUALITY` (400), `NO_TEMPLATE` y `NO_MATCH` (401), `AMBIGUOUS` (401) y `FACE_LOCKED` (423, 15 min tras 5 fallos). Siempre se ofrece la contraseña |
| Seguridad y privacidad | Sin fotos. Descriptor cifrado. Consentimiento versionado con `needsReconsent`. Un menor requiere al acudiente. El usuario puede borrar su plantilla y el acudiente revocar. Auditoría en `face_attempts` sin vector. Límite declarado: la prueba de vida por gesto no frena un video |

## 8. Captura de voz (EQ-P11) — *Con contenido*

- **Dictado:** Web Speech API (`SpeechRecognition`, `es-CO`) con el botón de micrófono en los campos de texto (`MicButton`).
- **Comandos de navegación por voz:** `VoiceNav`.
- **Lectura en voz alta:** `speechSynthesis` con voces en español y elección de voz (`SpeakButton`).
- Si el navegador no soporta dictado, la app explica por qué y sigue funcionando. Se recomienda Chrome o Edge para la demo.

## 9. Seguridad — *Parcial*

**Controles implementados:**

- Contraseñas con argon2id. Login en dos pasos: contraseña y código de 6 dígitos por correo (10 min, 5 intentos, solo se guarda el hash), o dispositivo de confianza o passkey.
- JWT de acceso de 20 min. Refresh opaco y rotativo en cookie `HttpOnly`: si se reutiliza uno viejo, se revoca toda la familia.
- Cinco roles: `@Roles` en la API, guardia JWT global y menú por rol.
- Recuperación con token de un solo uso (hash, 1 h). La respuesta no revela si el correo existe.
- Bloqueo progresivo por cuenta tras 5 contraseñas fallidas (`ACCOUNT_LOCKED`) y bloqueo facial (`FACE_LOCKED`).
- Límite de intentos por IP y por cuenta (`@nestjs/throttler`) en login, código, recuperación, cambio de clave, facial y passkeys: responde `429 TOO_MANY_REQUESTS` (ADR-009).
- Passkeys y facial solo se registran desde una sesión verificada (código, dispositivo de confianza o passkey). Ajustes › Seguridad lista sesiones y dispositivos y permite cerrarlos todos (ADR-010).
- Encabezados con `helmet` (ADR-009):
  - CSP estricta (`script-src 'self'`, sin `eval`, `frame-ancestors 'none'`);
  - HSTS;
  - `Referrer-Policy`;
  - `Permissions-Policy` (cámara y micrófono solo para el propio origen);
  - sin `X-Powered-By`.
- El navegador no recibe mapas de código y el código propio va con ofuscación ligera (disuasoria; la seguridad real está en la API).
- Ley 1581: documentos legales versionados con aceptación en `/aceptar` (el acudiente acepta por el menor), descarga de datos en JSON y solicitud de eliminación que atiende el administrador. Los textos son una plantilla para revisión jurídica.
- `npm audit`: sin avisos críticos ni altos. Queda uno moderado de `uuid` dentro de `exceljs` que no aplica (ADR-009).
- Secretos solo en el entorno (`.env` ignorado; `render.yaml` con `sync: false`).

**Riesgos conocidos (revisión de Bastión):**

| # | Riesgo | Qué hacer antes del deploy o la demo | Dueño |
|---|--------|--------------------------------------|-------|
| R1 | En cada arranque, la API crea las cuentas demo que falten (por ejemplo `admin@eduquest.local`). Si `SEED_PASSWORD` no está definida, usa una clave por defecto que está en el repositorio (y en el README) | Definir un `SEED_PASSWORD` fuerte en Render. Comprobar que la cuenta `admin@eduquest.local` de producción **no** entra con la clave por defecto; si entra, cambiarla. Quitar la clave del README | Darwin (Bastión revisa) |
| R2 | ~~Sin límite por IP en login y sin límite en `/api/auth/forgot`~~ **Cerrado el 9-oct:** `@nestjs/throttler` con una ventana por IP (300 cada 15 min) y otra por IP más cuenta o reto (10 cada 5 min) en login, código, `forgot`, `reset`, cambio de clave, facial y passkeys (ADR-009) | Mostrar en la sustentación el `429 TOO_MANY_REQUESTS` del intento 11 | Darwin / Bastión |
| R3 | El login con contraseña pide un código por correo: **sin envío real no hay login ni demo**. Además, `LAB_OTP_INBOX` manda los códigos de todas las cuentas `@eduquest.local` (admin incluido) a un mismo buzón. Plan B: un dispositivo de confianza o una passkey ya registrados entran sin código (implementados y probados el 9-oct) | Resend operativo en Render (escalado a Darwin; ya no sale con la salida por defecto del lunes). Con el remitente por defecto `onboarding@resend.dev`, `LAB_OTP_INBOX` **debe ser la dirección dueña de la cuenta de Resend**; si no, hay que verificar un dominio propio en `MAIL_FROM`. `LAB_OTP_INBOX` vacía o con un buzón que solo controle Darwin. `SEED_PASSWORD` fuerte | Darwin |
| R4 | `JWT_SECRET` débil: el código solo exige 8 caracteres | Usar un valor aleatorio de 32 bytes o más (por ejemplo, generado con `openssl rand -base64 48`), sin reutilizarlo en otros servicios. **No se rota antes del 15-oct.** La llave facial propia (`FACIAL_ENC_KEY` y ADR-011, futura) va después del freeze. Advertencia: cambiar `JWT_SECRET` es una rotación: deja ilegibles las plantillas faciales existentes (la llave facial se deriva de él mientras no exista `FACIAL_ENC_KEY` propia) e invalida todas las sesiones. **No rotar entre el registro de rostros y la demo del lunes 12-oct.** | Darwin |
| R5 | El listener de `guardian.facial_revoked` no se reintenta: si falla, la plantilla queda guardada (el login facial del menor se rechaza igual) | Riesgo conocido. Para la demo basta con que E14 muestre `facial.delete` en `audit_log`. El outbox va al backlog de Atlas (después del 15-oct) | Atlas |
| R6 | ~~Producción puede no correr el código del 9-oct~~ **Cerrado:** el commit `340b047` está `live` en Render desde el 9-oct a las 14:22 (hora Colombia), con bloqueo, OTP, passkeys, módulo legal y encabezados de seguridad | — | Darwin |

## 10. Integridad en exámenes: kiosco (EQ-C05) — *Con contenido*

| Paso | Qué pasa | Dónde |
|---|---|---|
| Inicio | Al abrir un examen (no la práctica) la web pide `requestFullscreen()` y muestra "Integridad activa" | `apps/web/src/features/exam.tsx` |
| Detección | `fullscreenchange` (salida), `visibilitychange` (pestaña oculta), `blur` (pérdida de foco) y `keydown` con Escape | `exam.tsx` |
| Registro | `POST /api/attempts/:id/integrity` → fila en `integrity_events` (tipo y hora) y contador en `attempt_flags` | `integrity.service.ts` |
| Aviso al docente | Socket `integrity:alert` en tiempo real y evento `integrity.violation` hacia notificaciones | `integrity.service.ts` |
| Suspensión | Al llegar a `INTEGRITY_SUSPEND_AFTER` (3 por defecto) se emite `integrity.suspend`: el intento queda `suspended` y la pantalla se bloquea | `integrity.service.ts`, assessment |
| Tutor apagado | Con un examen activo el tutor responde `403 KIOSK_ACTIVE` | `tutor.service.ts` |
| Reporte | Reporte de integridad en PDF y Excel con código LK | §5 |

**Evidencia (dueño: Darwin):** video de 30 a 60 s con `estudiante@` en un examen: salir de pantalla completa, cambiar de pestaña y pulsar Esc (los avisos 1 y 2 y luego la suspensión). En paralelo, la alerta en la vista de `docente@`. Después, `SELECT type, at FROM integrity_events WHERE attempt_id = '<id>' ORDER BY at;` y `SELECT * FROM attempt_flags WHERE attempt_id = '<id>';`.

## 11. Demo: guion de sustentación — *Con contenido*

1. **Problema (1 min).** El colegio no tiene aula propia, las notas viven en hojas de cálculo y nadie avisa a tiempo.
2. **Solución (1 min).** Abrir la URL pública, mostrar el campus de `estudiante@` y nombrar los cinco roles.
3. **Arquitectura (2 min).** Monolito modular, eventos para lo lateral y un solo Web Service. Mostrar `npm run deps:check` en verde.
4. **Base de datos (3 min).** En la consola de Cockroach: `SHOW TABLES`, `SHOW CREATE TABLE risk_alerts`, una FK y un CHECK que fallan, y `report_log`. Mostrar el ER.
5. **Seguridad (2 min).** Hash argon2id en la tabla, el estudiante sin acceso a Calificaciones, la recuperación con correo real, el login facial con prueba de vida, el bloqueo y el `429` por exceso de intentos. Mostrar los encabezados (`curl -I` con la CSP) y la aceptación legal del acudiente en nombre del menor. Declarar el riesgo R3.
6. **IA (3 min).** Tutor con cita, Mi ruta, resumen del Cuaderno y Observatorio ("¿Qué temas tienen la maestría más baja?"), y un `DELETE FROM users` rechazado.
7. **Demo funcional (4 min).** Libro de calificaciones con descarga de Excel y PDF y su código LK, Arena con `estudiante@` y `estudiante2@`, kiosco (§10), voz (§8) y `/verificar-reporte/LK-…`.
8. **Deploy (1 min).** Render con `render.yaml`, el healthcheck, variables solo en el entorno, CockroachDB Cloud y deploy automático desde GitHub.

**Plan B si la IA falla:** el Observatorio tiene SQL fijo, el Cuaderno hace resumen local y Mi ruta usa plantillas. **Si el correo falla:** el plan B de login es un dispositivo de confianza (30 días) o una passkey registrados antes de la sustentación en el equipo de la demo, porque entran sin código (R3). Igual hay que verificar Resend antes. **Arranque en frío:** abrir la URL 2 min antes.

## 12. Deploy — *Parcial*

| Lo que el enunciado pide demostrar en producción | Estado |
|---|---|
| Aplicación funcionando | El servicio responde 200 en `/`. Falta la captura (Darwin) |
| Base de datos funcionando | `/api/health` → `db:"up"`. Falta la captura de la consola (Darwin) |
| Autenticación funcionando | Verificado el 9-oct (14:42). Contraseña de `docente@` en prod → código enviado a `jo••••@hotmail.com` (remitente del dominio verificado `abacore.co`) → código recibido → verificación 200 con dispositivo de confianza. Playwright contra prod: 59 pasadas y 0 fallidas en WebKit y Chromium. Falta la captura (Darwin) |
| Recuperación funcionando | Por demostrar (Darwin) |
| Reconocimiento facial funcionando | Por demostrar. HTTPS y cámara; `FACIAL_ENC_KEY` estable (Darwin) |
| IA funcionando | Por demostrar. `AI_API_KEY` en Render (Darwin) |
| PDF funcionando | Por demostrar (Darwin) |

**Configuración:** Web Service `ludoteka-campus` (Render, plan gratuito, Virginia). Build `npm ci --include=dev && npm run build`, inicio `npm start` y healthcheck `/api/health`. Escucha en `0.0.0.0:$PORT` y aplica las migraciones al arrancar. Variables (solo nombres): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `APP_PUBLIC_URL`, `CORS_ORIGIN`, `AI_*`, `CLOUDINARY_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `LAB_OTP_INBOX`, `FACIAL_*`, `INTEGRITY_SUSPEND_AFTER` y `SEED_PASSWORD`. No se usa Render Postgres.

## 13. Evidencias — *Depende de Darwin* (lista oficial)

Esta es la lista oficial de evidencias (decisión de Nexus del 9-oct), alineada con el cruce de QA Lab (Sentinel, `evidencias-domingo-11.md`).

**Avance: 0/16 obligatorias (1 en ejecución) · 0/2 complementarias.**

Se pega una captura o un clip por fila. La evidencia final debe ser de **producción**; las corridas locales y las capturas de Playwright (`apps/web/e2e/shots/`, fuera de Git) solo sirven como ensayo. Toda prueba en producción que pase por login, escriba datos o use la consola de Cockroach o el dashboard de Render necesita autorización de Darwin. Las capturas muestran solo **nombres** de variables, nunca sus valores. Los códigos OTP, los hashes y las cadenas de conexión van tapados o truncados.

**Orden: E0 va primero y es un gate.** Si falla, se para todo lo que requiere login en producción (E1 a E4, E11, E13 y E14 y, en la práctica, E5, E6, E8 y C2).

| # | Evidencia | Cómo obtenerla | Dueño | Estado |
|---|-----------|----------------|-------|--------|
| **E0** | **Gate: correo recibido en producción** (ligado a R3) | (1) Render › Environment: existen `RESEND_API_KEY`, `MAIL_FROM` y `LAB_OTP_INBOX` (solo nombres). (2) En prod, `/ingresar` con `docente@` → "código enviado a <correo enmascarado>". (3) El correo llega a `LAB_OTP_INBOX` en ≤ 60 s (código tapado). (4) `SELECT to_email, subject, status, sent_at FROM email_outbox ORDER BY created_at DESC LIMIT 1;` → `status = 'sent'`. **FAIL** si queda `logged` o no llega. Nota: con el remitente por defecto de Resend (`onboarding@resend.dev`) normalmente solo se entrega a la dirección dueña de la cuenta de Resend, así que `LAB_OTP_INBOX` debe ser esa dirección, o hay que verificar un dominio en `MAIL_FROM` | Darwin (Render, buzón) · QA Lab (Speck el flujo, Probe la BD) | **Pasó el 9-oct (14:42):** el código para `docente@` llegó al buzón de laboratorio desde `abacore.co` y se verificó en prod. Faltan las capturas y la consulta a `email_outbox` |
| E1 | Login con contraseña (P05) | `/ingresar` con `docente@`, código por correo y entrada. Logout, y volver atrás no entra. Un endpoint protegido sin token responde 401 | Darwin | Pendiente (depende de E0) |
| E1b | Registro de usuarios (P05) | Como `admin@`, crear una cuenta en `/app/admin/usuarios` y luego `SELECT email, left(password_hash, 30) FROM users WHERE email = '<nuevo>';` → `$argon2id$…` (truncado). Dos cuentas con la misma clave tienen hashes distintos (sal) | Darwin | Pendiente |
| E2 | Login facial (P09) | `/app/rostro` (registro con consentimiento) y `/ingresar/rostro` (entrada), un error (prueba de vida o `NO_MATCH`) con la opción "usar contraseña", y el bloqueo `423 FACE_LOCKED`. **El código bloquea tras 5 fallos** (`FACIAL_LOCK_ATTEMPTS = 5`, 15 min, distancia 0,5). **Los umbrales de Prisma están pendientes de Darwin**: si difieren de los del código, implican cambiar el código y `render.yaml` | Darwin | Pendiente |
| E3 | Recuperación de contraseña (P07) | `/recuperar` (respuesta neutra), correo recibido, `/restablecer` y login con la clave nueva. Reusar el mismo enlace falla | Darwin | Pendiente (depende de E0) |
| E4 | IA (P10) | Tutor con cita, Mi ruta, resumen del Cuaderno, Observatorio con el SQL generado y el tutor respondiendo `403 KIOSK_ACTIVE` durante un examen | Darwin | Pendiente |
| E5 | CRUD (P04) | `/app/admin`: crear, editar y borrar un grupo o materia; subir y borrar un recurso de la biblioteca | Darwin | Pendiente |
| E6 | PDF y Excel (EQ-A09) | Boletín PDF, calificaciones Excel o PDF e integridad PDF, cada uno con su código LK | Darwin | Pendiente |
| E7 | Aplicación desplegada (P01) | URL pública abierta, `/api/health` → `db:"up"` y dashboard de Render con el último deploy en verde, **con el commit desplegado identificado** (hash y mensaje en Events/Deploys) junto a la captura. Commit desplegado: `340b047` ("Cuentas institucionales, passkeys, Ajustes, legal, seguridad web y compatibilidad Apple"), `live` el 9-oct a las 14:22 | Darwin | Pendiente: health OK y commit identificado; falta la captura del dashboard |
| E8 | Verificación del reporte (C06) | `/verificar-reporte/LK-2026-…` y certificado con QR en `/verificar/…` | Darwin | Pendiente |
| E9 | Base de datos real (P02) | Consola de Cockroach Cloud: clúster y región (sin credenciales), `SELECT version();` (→ `CockroachDB CCL v…`), `SHOW TABLES`, `SHOW CREATE TABLE risk_alerts`, `SHOW CONSTRAINTS FROM users` y `schema_migrations` (0000 a 0019) | Darwin | Pendiente |
| E10 | Integridad referencial (P04) | FK y CHECK rechazados más una consulta con JOIN y COUNT (`er.md`) | Darwin | Pendiente |
| E11 | Roles (P06 y C04) | El menú de cada rol (estudiante, docente, coordinación, acudiente y admin) y un 403 en la API para el estudiante. La falla del smoke del 9-oct (12:42) en `rol admin › ruta /app/ajustes` se resolvió: la página Ajustes existe para todos los roles y el smoke pasa en Chromium y WebKit | Darwin | Pendiente (captura en prod) |
| E12 | Modelo ER (P03) | Imagen del ER con PK y FK; `docs/er.md` con las 9 tablas de 0018 y 0019 y sus constraints; `git log -- db/migrations/0018_accounts.sql db/migrations/0019_preferences_legal.sql` mostrando el commit | Darwin (commit e imagen) · Cronista (`er.md`, vía Nexus) | Pendiente: FAIL hoy según QA (0018 y 0019 sin seguimiento en Git; `er.md` sin esas tablas) |
| E13 | Sesión de evaluación con timer y puntaje (C02) | Video: el docente abre la evaluación; el estudiante la inicia con el timer visible, responde y la entrega (o vence el tiempo); se ve el puntaje y el docente ve el resultado | Darwin | Pendiente |
| E14 | Revocación facial (**obligatoria, confirmada por Nexus**; límite lun 12-oct; con mostrar `facial.delete` basta, ver R5) | Ver el Anexo A | QA Lab (ejecuta Speck, coordina Sentinel; caso de Forge) | En ejecución (Speck, desde el 9-oct) |
| C1 | Captura de voz (EQ-P11) | Dictar en el tutor, un comando de navegación y la lectura en voz alta | Darwin | Pendiente |
| C2 | Kiosco (C05), si alcanza | Ver §10 | Darwin | Pendiente |

**Antes de cualquier prueba local que escriba datos** (QA Lab): confirmar que el `DATABASE_URL` local no apunta al mismo clúster que producción. Si es el mismo, las pruebas "locales" de CRUD, FK o revocación escriben en producción.

## 14. Entregables — *Parcial*

| Entregable | Estado | Valor o qué falta |
|---|---|---|
| 1. Aplicación desplegada | Con contenido | https://ludoteka-campus.onrender.com |
| 2. Repositorio Git | Parcial | https://github.com/Joan-Mora/ludoteka-campus. Los cambios del 9-oct están en el commit `340b047`. Darwin confirma el acceso del docente |
| 3. Scripts SQL (crear y poblar) | Con contenido | `db/migrations/0000…0019`, `db/seeds/001_contenido.sql`, `npm run migrate`, `npm run seed` |
| 4. URL | Con contenido | La de arriba |
| 5. Confluence | Depende de Darwin | Crear el espacio y pegar esta página |
| 6. Evidencias | Depende de Darwin | §13 |
| 7. Presentación | Con contenido | Guion en §11 |

## Anexo A — Evidencia de revocación facial — *Parcial*

**Dueño:** QA Lab. Ejecuta Speck, coordina Sentinel, comprometida para el lunes 12-oct. Forge es el autor del caso.

**Criterio:** después de que el acudiente revoca, quedan **0 embeddings** (plantillas) del menor y hay un registro `facial.delete` en `audit_log`.

1. Como `acudiente@`, revocar la autorización facial de `estudiante2@` (menor) en la vista del acudiente (`POST /api/guardian/authorizations` con `scope=facial` y `granted=false`). Eso escribe `guardian.revoke` y, tras el commit, emite `guardian.facial_revoked`. Para que la prueba demuestre algo, el menor debe tener una plantilla registrada antes de revocar.
2. Comprobar que no queda plantilla:
   `SELECT count(*) FROM face_templates WHERE user_id = (SELECT id FROM users WHERE email = 'estudiante2@eduquest.local');` → `0`
3. Mostrar la auditoría:
   `SELECT action, entity, meta, created_at FROM audit_log WHERE entity = 'face_templates' AND entity_id = '<id del menor>' ORDER BY created_at DESC LIMIT 1;` → `facial.delete` con `{"reason":"guardian_revoked"}`
4. El usuario también puede borrar su propia plantilla (`DELETE /api/biometrics/enroll`, la misma acción `facial.delete`). Si se borra la cuenta, `ON DELETE CASCADE` elimina la plantilla.

**Nota:** el borrado lo hace el listener del evento con un `DELETE` explícito. El `CASCADE` solo actúa cuando se borra el usuario. La fila de auditoría **se verifica a mano**: no hay prueba automatizada.

## Anexo B — Checklist Lab Innovación (guía para Darwin, no es tarea de build)

| # | Punto | Cómo comprobarlo | ✔ |
|---|-------|------------------|---|
| 1 | Variables en Render (**orden obligatorio, paso 1 de 3**) | Fijar `JWT_SECRET` fuerte (R4: 32 bytes o más, aleatorio, no reutilizado), `SEED_PASSWORD` fuerte (R1) y `LAB_OTP_INBOX` (R3: la dirección dueña de la cuenta de Resend si `MAIL_FROM` usa `onboarding@resend.dev`). Además, el resto de variables de §12 y Resend operativo | [ ] |
| 1b | **Paso 2 de 3:** deploy | Deploy en Render con esas variables y el commit identificado (E7) | [ ] |
| 1c | **Paso 3 de 3:** registrar los rostros de la demo | Recién después del deploy. Advertencia: cambiar `JWT_SECRET` es una rotación: deja ilegibles las plantillas faciales existentes (la llave facial se deriva de él mientras no exista `FACIAL_ENC_KEY` propia) e invalida todas las sesiones. **No rotar entre el registro de rostros y la demo del lunes 12-oct.** | [ ] |
| 2 | Migraciones en Cockroach, **sobre una base vacía** | **Verificación, no bloqueo** (incluye las dos `0011`). Crear una base o clúster vacío de prueba (no la base existente), correr `npm run migrate` y comprobar que `schema_migrations` lista las 21 migraciones de 0000 a 0019, incluidas las dos `0011` (ver `arquitectura.md`) | [ ] |
| 3 | URL con `/health` | `https://ludoteka-campus.onrender.com/api/health` → `ok:true, db:"up"` | [ ] |
| 4 | Smoke de auth | Login con contraseña y código, logout, un 403 por rol y la cuenta demo **sin** la clave por defecto | [ ] |
| 5 | Smoke de recuperación | `/recuperar` → correo → `/restablecer` → login | [ ] |
| 6 | Smoke de CRUD con JOIN y FK | Crear, editar y borrar un grupo. Consulta con JOIN y un FK rechazado (`er.md`) | [ ] |
| 7 | Paquete de evidencias de la rúbrica | E0 a E14 (con E1b) y C1 y C2 pegadas en Confluence, con E0 primero | [ ] |
| 8 | Gate de demo con CI en verde | `npm run typecheck`, `npm run deps:check` y el smoke de Playwright en verde (corrida local del 9-oct, 14:15: 181 pasadas, 0 fallidas en WebKit y Chromium) | [ ] |
