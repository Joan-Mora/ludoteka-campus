# Ludoteka Campus — página Confluence (EQ-P08)

Copiar cada bloque a una página del espacio del equipo y pegar las capturas en la sección de evidencias.

- **URL pública:** https://ludoteka-campus.onrender.com
- **Repositorio:** https://github.com/Joan-Mora/ludoteka-campus
- **Base de datos:** CockroachDB Cloud (única base del proyecto)
- **Cuentas de demo:** `estudiante@`, `estudiante2@`, `docente@`, `coordinacion@`, `acudiente@` y `admin@eduquest.local`, todas con la clave de laboratorio `EduQuest2026!`

## De EduQuest a Ludoteka Campus

EduQuest nació como un quiz gamificado de Matemáticas para sexto: preguntas, XP y un examen en kiosco. Al crecer el alcance se convirtió en **Ludoteka Campus**, el campus virtual del Colegio Francisco Arango. El código se reescribió como un monolito modular y el modelo de datos creció a 88 tablas de negocio.

| Antes (EduQuest) | Ahora (Ludoteka Campus) |
|---|---|
| Quiz suelto con XP | Campus isométrico: cada edificio es un módulo y Luka, el compañero, sugiere qué hacer |
| Login facial geométrico de laboratorio | face-api con descriptor de 128 dimensiones, prueba de vida, 5 muestras, AES-256-GCM y bloqueo por intentos (ADR-007) |
| Tutor de práctica | Tutor con citas a la biblioteca (RAG), Mi ruta con ejercicios verificados en el servidor y Cuaderno con resumen IA |
| Sin consultas libres | Observatorio: preguntas en español convertidas a SQL de solo lectura (ADR-006) |
| Quiz en vivo individual | Arena por equipos con QR, capitán rotativo y recuperación desde snapshot (ADR-008) |
| Notas por intento | Libro de calificaciones ponderado (1.0 a 5.0), rúbricas, asistencia y alertas de riesgo |
| 3 reportes | 8 tipos de reporte PDF/Excel con consecutivo `LK-AAAA-NNNNNN` verificable |
| Estudiante, docente, rectoría | Estudiante, docente, coordinación, acudiente y administrador |
| Sin archivos | Biblioteca con archivos en Cloudinary y metadatos en CockroachDB (ADR-005) |
| Sin voz | Dictado, comandos de navegación por voz y lectura en voz alta |

## 1. Problema

El colegio no tiene un aula propia. Las apps de quiz no conocen los grupos, no guardan el recorrido del estudiante, no avisan a tiempo cuando alguien va mal y no sostienen un examen frente a la copia. Docentes y coordinación dependen de hojas de cálculo para notas, asistencia y reportes.

## 2. Solución

Ludoteka Campus es el campus virtual del colegio:

- El **estudiante** recorre un campus con lecciones, tareas, exámenes en kiosco, Mi ruta adaptativa, Cuaderno de estudio, Arcade, Arena y un tutor que cita la biblioteca.
- El **docente** publica contenido, arma el banco de preguntas, dirige la Arena, califica con rúbricas, toma asistencia y recibe alertas de riesgo.
- **Coordinación** ve indicadores del colegio, consulta datos en lenguaje natural y descarga reportes.
- El **acudiente** sigue el avance y las alertas de su hijo y autoriza el registro facial de un menor.
- El **administrador** gestiona años, grupos, materias, matrículas y usuarios.

## 3. Arquitectura

Monolito modular en un solo Web Service de Render. NestJS sirve `/api`, `/socket.io` y el build de React. Los módulos (identity, institution, learning, assessment, integrity, gamification, arena, library, study, tutor, biometrics, analytics, certification, notifications) solo se comunican por su `public-api.ts`. Gamificación, analítica y notificaciones reaccionan a eventos y no reciben llamadas directas. `dependency-cruiser` hace cumplir esas fronteras en cada build.

Servicios externos:

- **CockroachDB Cloud:** datos.
- **Cloudinary:** archivos de la biblioteca.
- **Google Gemini** (API compatible con OpenAI): IA.
- **Resend:** correo.

Ver `docs/arquitectura.md` y ADR-001 a ADR-008.

## 4. Base de datos

- Modelo completo en `docs/er.md`, tabla por tabla, en formato Entidad, Atributos, PK/FK y Relaciones.
- 89 tablas, 148 llaves foráneas, 131 `CHECK`, 48 `UNIQUE` (4 parciales), 12 vistas y el rol `ludoteka_reader`.
- SQL en `db/migrations` (0000 a 0017) y semilla en `db/seeds`.

## 5. IA

| Uso | Qué resuelve | Control |
|---|---|---|
| Tutor con citas | Explica con fragmentos de las guías de la biblioteca y cita la página | No da la respuesta final; responde `403 KIOSK_ACTIVE` durante un examen |
| Mi ruta | Genera ejercicios del nivel de maestría de cada tema | El servidor recalcula la respuesta; si la IA se equivoca, se corrige o se usa una plantilla |
| Cuaderno | Resume apuntes y propone tarjetas de repaso SM-2 | El texto se redacta sin datos personales; sin IA hay resumen local |
| Observatorio | Convierte preguntas en español a SQL | Vistas `v_*`, validador, `READ ONLY`, rol de solo lectura y nombres anonimizados |
| Banco de preguntas | Borradores de preguntas para el docente | Quedan inactivas hasta revisión |

Cada llamada queda en `ai_usage` (funcionalidad y modelo, sin el contenido). No se envían datos personales de menores al proveedor.

## 6. Seguridad

- Contraseñas con argon2id. JWT de acceso corto y refresh opaco rotado en cookie `HttpOnly`.
- Cinco roles con rutas protegidas en la API (`@Roles`) y en la web.
- Recuperación de contraseña con token de un solo uso (se guarda solo su hash en `password_reset_tokens` y vence en 1 hora). La respuesta no revela si el correo existe.
- Facial bajo Ley 1581:
  - consentimiento versionado y autorización del acudiente para menores;
  - nunca se reciben fotos;
  - plantilla cifrada con AES-256-GCM;
  - bloqueo tras 5 fallos;
  - la contraseña siempre está disponible (ADR-002 y ADR-007).
- Integridad en exámenes: pantalla completa, eventos de salida y suspensión automática.

## 7. Matriz de la rúbrica

| # | Requisito del parcial | Dónde se cumple | Evidencia |
|---|---|---|---|
| 1 | App web funcional | https://ludoteka-campus.onrender.com | Navegación en vivo |
| 2 | BD distribuida CockroachDB | Clúster en CockroachDB Cloud, `DATABASE_URL` con SSL | Captura de la consola de Cockroach y `SHOW TABLES` |
| 3 | Modelo ER, PK/FK, restricciones, relaciones | `docs/er.md`, `db/migrations` | `SHOW CREATE TABLE risk_alerts`, `SHOW CONSTRAINTS FROM goals` |
| 4 | CRUD, consultas SQL, integridad | Institución (`/app/admin`), cursos, banco, biblioteca, rúbricas; Observatorio | Crear, editar y borrar un grupo; FK y CHECK que fallan a propósito (ver `docs/er.md`) |
| 5 | Registro, login, logout | `/registro`, `/ingresar`, menú de usuario | Demo |
| 6 | Roles y rutas protegidas | `@Roles` en la API y menú por rol | Entrar como estudiante y abrir `/app/calificaciones` (sin acceso); entrar como docente |
| 7 | Contraseñas con hash | argon2id en identity | `SELECT email, left(password_hash, 30) FROM users LIMIT 3` |
| 8 | Recuperación por correo | `/recuperar` y `/restablecer`, Resend | Correo recibido y clave cambiada en producción |
| 9 | Dos o más reportes PDF/Excel | Boletín PDF, curso Excel, integridad PDF, uso Excel, calificaciones PDF/Excel, usuarios Excel, certificado PDF con QR | Descarga en vivo y `/verificar-reporte/LK-…` |
| 10 | Deploy sin ngrok | Render, `render.yaml`, healthcheck `/api/health` | URL pública |
| 11 | Confluence | Esta página | Espacio del equipo |
| 12 | Repositorio y scripts SQL | GitHub, `db/migrations`, `db/seeds`, `npm run migrate` | Enlace |
| 13 | Sustentación | Guion de 8 puntos (abajo) | Oral |
| Alt. | Facial, IA y voz | `/ingresar/rostro`, tutor, Observatorio, botón de micrófono | Video o demo |

## 8. Guion de sustentación (8 puntos)

1. **Problema (1 min).** El colegio no tiene aula propia, las notas viven en hojas de cálculo y nadie avisa a tiempo cuando un estudiante va mal.
2. **Solución (1 min).** Abrir la URL pública, mostrar el campus de `estudiante@` y nombrar los cinco roles.
3. **Arquitectura (2 min).** Monolito modular, eventos para lo lateral y un solo Web Service. Mostrar `npm run deps:check` sin violaciones y el diagrama de `docs/arquitectura.md`.
4. **Base de datos (3 min).** En la consola de CockroachDB: `SHOW TABLES`, `SHOW CREATE TABLE risk_alerts`, el FK y el CHECK que fallan, y el consecutivo en `report_log`. Mostrar `docs/er.md`.
5. **Seguridad (2 min).** Hash argon2id en la tabla. Probar que el estudiante no entra a Calificaciones. Recuperar la contraseña con el correo real. Login facial con prueba de vida y el bloqueo tras fallos.
6. **IA (3 min).**
   - Tutor con cita a la guía.
   - Mi ruta con un ejercicio verificado.
   - Resumen del Cuaderno.
   - Observatorio: "¿Qué temas tienen la maestría más baja?" y luego un `DELETE FROM users` rechazado.
7. **Demo funcional (4 min).**
   - Como `docente@`: Libro de calificaciones (ponderación, asistencia, rúbrica, alerta) y descarga del Excel y del PDF con código LK.
   - Arena: crear sala, unir a `estudiante@` y `estudiante2@` por QR o código, responder y ver el podio.
   - Verificar el reporte en `/verificar-reporte/LK-…`.
8. **Deploy (1 min).** Render con `render.yaml`, healthcheck, variables solo en el entorno (sin secretos en Git), CockroachDB Cloud como única base y despliegue automático desde GitHub.

Plan B si el proveedor de IA falla: las preguntas de ejemplo del Observatorio tienen SQL fijo, el Cuaderno usa el resumen local y Mi ruta usa plantillas verificadas.

Antes de sustentar: abrir la URL 2 minutos antes (el plan gratuito de Render se duerme tras 15 minutos sin uso).

## 9. Deploy

- Web Service `ludoteka-campus` en Render (plan gratuito, Virginia). Lo define `render.yaml`: build `npm ci --include=dev && npm run build`, inicio `npm start` y healthcheck `GET /api/health`.
- El servidor escucha en `0.0.0.0:$PORT`. Las migraciones se aplican al arrancar.
- Variables solo en el entorno de Render:
  - `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`;
  - `AI_API_KEY`, `CLOUDINARY_URL`, `RESEND_API_KEY`, `MAIL_FROM`;
  - `FACIAL_ENC_KEY`, `APP_PUBLIC_URL`, `CORS_ORIGIN`, `SEED_PASSWORD`.
- No se usa Render Postgres. El disco del contenedor es efímero: archivos en Cloudinary y datos en CockroachDB.

## Evidencias

Pegar una captura (o un clip corto) por fila.

| Evidencia | Cómo obtenerla |
|---|---|
| [ ] Login con contraseña | `/ingresar` con `docente@eduquest.local` |
| [ ] Login facial | `/app/rostro` para registrar el rostro y `/ingresar/rostro` para entrar; también el error de prueba de vida o el bloqueo |
| [ ] Recuperación de contraseña | `/recuperar`, el correo recibido, `/restablecer` y el login con la clave nueva |
| [ ] IA | Tutor con cita, Mi ruta, resumen del Cuaderno y Observatorio con SQL generado |
| [ ] CRUD | `/app/admin`: crear, editar y borrar un grupo o materia; biblioteca: subir y borrar un recurso |
| [ ] PDF y Excel | Boletín PDF, calificaciones Excel/PDF, integridad PDF, uso Excel, cada uno con su código LK |
| [ ] Verificación del reporte | `/verificar-reporte/LK-2026-…` y certificado con QR en `/verificar/…` |
| [ ] Base de datos | Consola de CockroachDB Cloud: clúster, `SHOW TABLES`, `SHOW CREATE TABLE`, `SHOW CONSTRAINTS`, `schema_migrations` |
| [ ] Integridad referencial | FK y CHECK rechazados (consultas en `docs/er.md`) |
| [ ] Roles | El mismo menú visto como estudiante, docente, coordinación y acudiente |
| [ ] Despliegue | Dashboard de Render con el último deploy en verde y `GET /api/health` respondiendo |
