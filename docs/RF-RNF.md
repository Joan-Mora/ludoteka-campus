# Ludoteka Campus — Requisitos funcionales y no funcionales

> Última revisión: 2026-10-09 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest). La carpeta sigue siendo `Proyectos\EduQuest`.
> **Fuente del estado:** repo `ludoteka-campus` en 2Klair (commit `340b047` del 2026-10-09, desplegado en Render a las 14:22) y `GET https://ludoteka-campus.onrender.com/api/health` respondiendo `{"ok":true,"db":"up"}` el 2026-10-09 después del deploy (hora Colombia).
> **Modo de trabajo:** Darwin construye; el Equipo Dev solo revisa. Freeze hasta el 15-oct: solo entra lo que bloquee evidencia del Must.

## Convenciones

- **Prioridad:** Must = rúbrica del parcial o MVP del colegio. Nice = después del 15-oct.
- **Verificación:** **Prueba** (automatizada o un script reproducible), **Demo** (se muestra en vivo), **Inspección** (leer código, SQL o configuración) y **Análisis** (razonar sobre el diseño o los datos).
- **Estado:** **Hecho** (está en el código y es verificable), **Parcial** (falta una parte del criterio), **Pendiente** (no existe) y **Hold** (se frenó por decisión).
- La columna "Evidencia prod" indica si la prueba ya se hizo en la URL pública. Hoy ninguna lo está: la lista oficial de evidencias (`confluence-eq-p08.md` §13) va 0/16 obligatorias, con E14 en ejecución. E0, el correo recibido en producción, es el gate.

## RF — Parcial (EQ-P)

| ID | Requisito | Criterio de aceptación | Verificación | Estado | Evidencia prod | Fuente |
|----|-----------|------------------------|--------------|--------|----------------|--------|
| EQ-P01 | URL pública sin ngrok | `https://ludoteka-campus.onrender.com` responde 200 y `GET /api/health` devuelve `ok:true, db:"up"` desde una red externa. El docente puede entrar durante la sustentación | Demo + Prueba (`curl /api/health`) | Hecho | Pendiente (falta captura) | `render.yaml`, `apps/api/src/modules/health` |
| EQ-P02 | CockroachDB como única base | `DATABASE_URL` apunta a CockroachDB Cloud con SSL. No hay Render Postgres ni otra base. `schema_migrations` lista de 0000 a 0019 | Inspección + Demo (consola de Cockroach) | Hecho | Pendiente | ADR-004, `core/database` |
| EQ-P03 | Modelo ER con tablas, PK/FK, restricciones y relaciones | `docs/er.md` describe cada tabla (Entidad, Atributos, PK/FK y Relaciones) y coincide con `db/migrations`. Hay un diagrama exportado para Confluence | Inspección | Parcial: `er.md` ya cubre 0000 a 0019 (incluidas las 9 tablas de 0018 y 0019); falta el diagrama exportado | — | `docs/er.md`, `db/migrations` |
| EQ-P04 | CRUD, consultas SQL e integridad | Se puede crear, leer, editar y borrar al menos una entidad de negocio (grupo, materia o recurso). Una violación de FK y una de CHECK son rechazadas por la base. Hay consultas con JOIN documentadas | Demo + Prueba (SQL de `er.md`) | Hecho | Pendiente | `institution`, `library`, `er.md` §Consultas |
| EQ-P05 | Registro, login, logout y hash | (a) **Registro de usuarios por el administrador:** `POST /api/admin/users` (o importación por Excel) crea la cuenta y una consulta SQL muestra `password_hash` en argon2id (`$argon2id$…`), nunca la clave en claro. No se exige autoregistro (decisión de Nexus del 9-oct: el enunciado dice "Registro de usuarios"; `/registro` no vuelve por el freeze). (b) Login con contraseña y código de 6 dígitos por correo. (c) Logout revoca el refresh | Demo + Inspección | Hecho (evidencia E1b pendiente) | Pendiente | `accounts.controller.ts`, `identity`, migración 0018 |
| EQ-P06 | Roles y rutas protegidas | Seis roles (`admin`, `coordinator`, `rector`, `teacher`, `student`, `guardian`; `directivo` se separó el 11-oct). Toda ruta de la API sin `@Public` exige JWT y `@Roles`, y solo docente y administración escriben contenido académico. Cada ruta de la web declara sus roles (`ROUTE_ROLES`) y, si no corresponde, muestra «Esta sección no es para tu rol». Un estudiante que abre `/app/calificaciones` no ve datos y recibe 403 en la API. La matriz está en `vision.md` | Demo + Inspección + Prueba (`e2e/smoke.spec.ts`, «rutas de otros roles») | Hecho | Pendiente | `core/auth/guards.ts`, `app/nav.ts`, `app/router.tsx` |
| EQ-P07 | Recuperación por correo | `/recuperar` responde lo mismo exista o no el correo. El enlace llega por Resend, el token es de un solo uso y vence en 1 h (solo se guarda su hash). Tras restablecer se entra con la clave nueva | Demo | Hecho | Pendiente (correo real en prod) | `identity.service.ts` (`forgot`, `reset`) |
| EQ-P08 | Documentación en Confluence | El espacio de Confluence tiene todas las secciones de `docs/confluence-eq-p08.md` y las 11 evidencias | Inspección | Parcial: el contenido en markdown está listo; falta crear el espacio y pegar las evidencias | — | `docs/confluence-eq-p08.md` |
| EQ-P09 | Login facial | Registro con 5 muestras y prueba de vida. Login 1:1 (correo + rostro) y 1:N con respuesta `AMBIGUOUS`. Se rechaza cualquier imagen (`400 IMAGE_NOT_ALLOWED`). Bloqueo tras 5 fallos (`423 FACE_LOCKED`). La contraseña siempre queda disponible. Los umbrales de Prisma están pendientes de Darwin | Demo + Inspección | Hecho | Pendiente (video) | `biometrics`, ADR-002, ADR-007 |
| EQ-P10 | IA de dominio, además del facial | Al menos una función de IA con uso real: tutor con citas (RAG), Mi ruta, resumen del Cuaderno u Observatorio NL→SQL. Durante un examen el tutor responde `403 KIOSK_ACTIVE`. Cada llamada queda en `ai_usage` sin el contenido | Demo | Hecho | Pendiente | `tutor`, `study`, `analytics/observatory`, ADR-006 |
| EQ-P11 | **Captura de voz** (Must desde el 2026-10-09) | En un navegador compatible (Chrome o Edge): (a) dictado por micrófono a texto en los campos con botón de micrófono, (b) comandos de navegación por voz y (c) lectura en voz alta en español. Si el navegador no soporta dictado, la app lo explica y no se rompe | Demo + Inspección | Hecho | Pendiente | `apps/web/src/shared/voice.ts`, `voice-ui.tsx` (`MicButton`, `VoiceNav`, `SpeakButton`), commit `1e8e7ec` |

**Reportes del parcial.** El requisito "≥2 reportes PDF/Excel" se rastrea como **EQ-A09** (más abajo) y se evidencia en EQ-P08.

## RF — Colegio (EQ-C)

| ID | Requisito | Criterio de aceptación | Verificación | Estado | Fuente |
|----|-----------|------------------------|--------------|--------|--------|
| EQ-C01 | PWA | Hay `manifest` con íconos de 192, 512 y maskable, y un service worker (vite-plugin-pwa). La app se instala en Android o iPhone | Demo + Inspección | Hecho | `apps/web/vite.config.ts`, `public/icon-*` |
| EQ-C02 | Evaluación en aula con timer y puntos | El examen tiene cuenta regresiva y calificación automática. El quiz en vivo y la Arena asignan puntos y muestran un podio | Demo | Hecho | `exam.tsx`, `arena`, ADR-008 |
| EQ-C03 | Banco de Matemáticas de sexto | La semilla carga preguntas de sexto por tema, y el docente puede crear y editar preguntas | Inspección + Demo | Hecho | `db/seeds/001_contenido.sql` |
| EQ-C04 | Roles alineados con P06 | Los mismos seis roles de EQ-P06 | Inspección | Hecho | — |
| EQ-C05 | Kiosco anti-fraude | Al iniciar un examen se pide pantalla completa. Salir de pantalla completa, ocultar la pestaña, perder el foco o pulsar Esc registra una fila en `integrity_events` y avisa al docente por socket (`integrity:alert`). Al llegar a `INTEGRITY_SUSPEND_AFTER` (3 por defecto) el intento queda suspendido. La práctica no suspende | Demo + Inspección | Hecho | `exam.tsx`, `integrity.service.ts` |
| EQ-C06 | Certificado PDF, insignia y verificación | No se emite certificado sin examen del curso ≥ 60 %. El docente lo pide y queda en `pending_signature` hasta que rectoría lo firma o lo devuelve con nota. El PDF tiene código, QR y «Firmado por», y `/verificar/:code` responde sin sesión solo para los firmados | Demo | Hecho (firma = aprobación registrada, no certificado digital) | `certification`, `governance/rectoria.service.ts` |

## RF — Aula (EQ-A)

| ID | Requisito | Criterio de aceptación | Verificación | Estado |
|----|-----------|------------------------|--------------|--------|
| EQ-A01 | Estructura institucional | Año, periodo, grado, grupo, materia, matrícula y asignación docente, con CRUD del administrador e importación por Excel | Demo | Hecho |
| EQ-A02 | Curso con unidades, lecciones, recursos y progreso | Completar una lección dos veces no duplica el XP | Prueba + Demo | Hecho |
| EQ-A03 | Tareas con entrega y calificación | El docente califica y el evento `submission.graded` suma XP | Demo | Hecho |
| EQ-A04 | Cartelera, foros y calendario | La cartelera tiene audiencia y confirmación de lectura, y hay foros por curso | Demo | Hecho |
| EQ-A05 | Campus y mapa de avance | Campus isométrico con un edificio por módulo y Luka como guía | Demo | Hecho |
| EQ-A06 | Gamificación | XP solo por `xp_ledger`, nivel, insignias, racha, misiones y liga semanal | Inspección | Hecho |
| EQ-A07 | Minijuegos y Arena | Arcade (como máximo 40 XP por partida) y Arena por equipos con QR | Demo | Hecho |
| EQ-A08 | Tableros | Tablero del docente; mesa de seguimiento de coordinación (alertas con bitácora, asistencia con umbral de 3 faltas o 15 %, citaciones con correo); tablero estratégico de rectoría por periodo con comparación y cola de firmas; Observatorio | Demo | Hecho |
| EQ-A13 | Familia | El acudiente ve por hijo lo que viene en 14 días, notas, asistencia, alertas y citaciones; confirma la citación; escribe al docente del estudiante (y solo a él) y recibe un resumen semanal los viernes, que puede apagar o pedir de inmediato | Demo | Hecho |
| EQ-A09 | Reportes PDF/Excel (Must del parcial) | Al menos 2 tipos. Cada uno tiene título, fecha de generación, datos de la BD, estructura organizada y un consecutivo `LK-AAAA-NNNNNN` registrado en `report_log` y verificable en `/verificar-reporte/<código>` | Demo + Prueba | Hecho: boletín PDF, curso Excel, resultados Excel, integridad PDF y Excel, uso Excel, usuarios Excel y certificado PDF |
| EQ-A10 | Libro de calificaciones | Ponderación por categoría (1.0 a 5.0), asistencia, rúbricas y alertas de riesgo al docente y al acudiente | Demo | Hecho |
| EQ-A11 | Biblioteca | Archivos en Cloudinary con ticket firmado y metadatos en CockroachDB (ADR-005) | Demo | Hecho |
| EQ-A12 | Datos personales (Ley 1581) | Términos, privacidad y cookies versionados. Cada nueva versión exige aceptar otra vez. Hay solicitudes de exportar o borrar datos (habeas data) | Demo + Inspección | Hecho (9-oct). La aceptación pasa por `/aceptar`: el acudiente acepta por el menor. Ajustes › Privacidad descarga los datos en JSON y pide la eliminación, y el administrador la atiende en Usuarios. Los textos son una plantilla pendiente de revisión jurídica |

## RNF

| ID | Criterio de aceptación | Verificación | Estado |
|----|------------------------|--------------|--------|
| RNF-01 | Monolito modular: `apps/api` (NestJS), `apps/web` (React), `packages/contracts` y `db/`. Los módulos se hablan solo por `public-api.ts` o por eventos | Prueba (`npm run deps:check` sin violaciones) | Hecho |
| RNF-02 | Un Web Service en Render y CockroachDB Cloud con SSL | Inspección (`render.yaml`) + Demo | Hecho |
| RNF-03 | Los secretos solo viven en el entorno. `.env` y `.env.*` están ignorados y solo se versiona `.env.example`. Ningún secreto ni clave por defecto aparece en docs, README o Confluence | Inspección | Parcial: el código trae un valor por defecto para `SEED_PASSWORD` y el README lo publica. Ver Seguridad en `confluence-eq-p08.md` |
| RNF-04 | `GET /api/health` hace ping a la BD y responde en menos de 2 s con el servicio despierto | Prueba | Hecho (200, `db:"up"`, 0,3 s el 2026-10-09) |
| RNF-05 | Marca coherente en UI, reportes y docs | Inspección | Parcial: la app y los reportes dicen Ludoteka Campus; las cuentas y el paquete npm siguen como `eduquest`. Falta que Darwin confirme el nombre |
| RNF-06 | El esquema vive en migraciones SQL versionadas y aplicadas al arrancar | Inspección | Hecho (0000 a 0019, con 0018 y 0019 en el commit `340b047`) |
| RNF-07 | Las fronteras entre módulos se verifican con dependency-cruiser | Prueba | Hecho |
| RNF-08 | Límite de intentos de autenticación | Prueba | Hecho (R2 cerrado el 9-oct, ADR-009). Mecanismos activos:<br>• bloqueo progresivo de la cuenta tras 5 fallos (`ACCOUNT_LOCKED`);<br>• 5 intentos por código OTP;<br>• bloqueo del facial;<br>• `@nestjs/throttler` en login, OTP, recuperación (`forgot` y `reset`), cambio de clave, facial y passkeys: 300 peticiones por IP cada 15 min y 10 por IP más cuenta o reto cada 5 min. El intento 11 contra una cuenta responde `429 TOO_MANY_REQUESTS` |
| RNF-12 | Encabezados de seguridad: CSP estricta (`script-src 'self'`, sin `eval`), HSTS en producción, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` (cámara y micrófono solo para el propio origen) y sin `X-Powered-By` | Prueba (Playwright falla si hay violaciones de CSP) + Inspección (`curl -I`) | Hecho (`core/security/headers.ts`, ADR-009) |
| RNF-13 | El navegador no recibe mapas de código y el código propio va con ofuscación ligera (las librerías no). La seguridad real sigue en la API | Inspección (`dist/` sin `.map`) | Hecho (`vite.config.ts`, ADR-009) |
| RNF-11 | El correo transaccional (Resend) entrega el código de ingreso y la recuperación en producción. `LAB_OTP_INBOX` queda vacía o apunta a un buzón que solo controla Darwin | Demo | Hecho para el código de ingreso: el 9-oct (14:42) llegó desde `abacore.co` y se verificó en prod. `LAB_OTP_INBOX` apunta al buzón de laboratorio de Darwin. La recuperación ya llegaba con estado `sent` desde las 11:29. R3 sigue como dependencia declarada |
| RNF-09 | Smoke E2E (Playwright) en verde antes de la demo | Prueba | Hecho en local: la corrida del 9-oct (14:15) dio 181 pasadas, 16 omitidas y 0 fallidas en iPhone, iPad, Safari Mac (WebKit) y Android (Chromium), incluida la passkey con un autenticador virtual. Las omitidas son rutas de otro dispositivo o pruebas solo locales. Contra producción (`npm run e2e:prod -w @eduquest/web`, 9-oct 14:50): 59 pasadas y 0 fallidas en WebKit y Chromium. Cubre las rutas públicas y las del docente, que tiene dispositivo de confianza; los demás roles necesitan su código del correo una vez |
| RNF-10 | Arranque en frío de Render cubierto en la demo | Análisis | Hecho (procedimiento: abrir la URL 2 min antes) |

### RNF-F (facial, Ley 1581; heredan ADR-002 y ADR-007)

| ID | Criterio de aceptación | Verificación | Estado |
|----|------------------------|--------------|--------|
| RNF-F01 | La API nunca recibe fotos: cualquier campo de imagen responde `400 IMAGE_NOT_ALLOWED` | Prueba | Hecho |
| RNF-F02 | Consentimiento versionado (`FACIAL_POLICY_VERSION`). Sin él, `403 CONSENT_REQUIRED`. Si cambia la versión, se pide de nuevo (`needsReconsent`) | Prueba | Hecho |
| RNF-F03 | El usuario borra su plantilla (`DELETE /api/biometrics/enroll`). Si el acudiente revoca, se borra la del menor (evento `guardian.facial_revoked`). Retención configurable (`FACIAL_RETENTION_DAYS`; 0 = sin purga automática) | Demo + Prueba | Hecho (evidencia de revocación: dueño Forge) |
| RNF-F04 | La contraseña siempre está disponible como alternativa | Demo | Hecho |
| RNF-F05 | Comparación por distancia euclidiana con umbral `FACIAL_MAX_DISTANCE` (0,5). Modo 1:1 con correo; en 1:N, si dos cuentas quedan cerca responde `AMBIGUOUS` | Prueba | Hecho |
| RNF-F06 | Ningún vector aparece en logs ni en `face_attempts`. La plantilla se guarda cifrada con AES-256-GCM | Inspección | Hecho |
| RNF-F07 | Texto de tratamiento de datos (Ley 1581 y Decreto 1377) visible antes del registro facial | Inspección | Hecho |
| RNF-F08 | El modelo (face-api, 128 dimensiones) y sus límites (la prueba de vida por gesto no frena un video) están documentados | Inspección | Hecho (ADR-007) |
| RNF-F09 | Un menor sin autorización del acudiente recibe `403 GUARDIAN_CONSENT_REQUIRED` | Prueba | Hecho |

## Nice (después del 15-oct)

- Spike de `VECTOR INDEX` en CockroachDB para `library_chunks` y descriptores (propuesta de Nova).
- Top 3 de mejoras de Forge y de Atlas (registradas en `bitacora.md`).
- Plan B de login sin correo (dispositivo de confianza o passkey preparados para la demo); queda fuera por el freeze.
- Firma criptográfica del rector en certificados.

## Fuera de alcance: el sistema NO debe

- Usar otra base que no sea CockroachDB (ni Render Postgres ni SQLite).
- Recibir, guardar ni enviar fotos o video del rostro. Solo descriptores cifrados.
- Activar el facial de un menor sin autorización del acudiente, ni usar rostros reales de menores del colegio en la demo.
- Ocultar o deshabilitar el login con contraseña.
- Dejar que la IA dé la respuesta durante un examen o sala en vivo, o que ejecute SQL de escritura.
- Enviar datos personales de menores al proveedor de IA.
- Guardar secretos o claves por defecto en el repositorio, en la documentación o en Confluence.
- Hacer proctoring forense, cámara continua, bloqueo del sistema operativo ni huella dactilar.
- Ser una app nativa o atender varios colegios (multi-tenant).
- Depender de ngrok o de un túnel para la URL pública.
