# Guía de auditoría para los bots de revisión

EduQuest se construye en Cursor. Esta guía es para revisar, no para reescribir el producto. Cada hallazgo debe citar archivo y decir qué se rompe si no se corrige.

## Fronteras

`npm run deps:check` tiene que seguir en verde. Un módulo solo entra a otro por `public-api.ts`. Gamificación, analítica y notificaciones no se importan: escuchan eventos (`lesson.completed`, `attempt.graded`, `submission.graded`, `integrity.violation`, `integrity.suspend`, `password.reset`, `tutor.message`).

## Por módulo

| Módulo | Qué mirar |
|--------|-----------|
| identity | Hash argon2id, refresh rotativo, forgot siempre 204, `WEAK_PASSWORD` |
| institution | Un estudiante, un grupo por año. El grupo no puede matricularse en un año distinto |
| learning | El estudiante solo ve cursos publicados de su matrícula. Completar una lección dos veces no duplica XP |
| assessment | El examen no revela `is_correct` mientras el intento está activo. Un examen completado no se repite |
| integrity | La práctica no suspende. El umbral emite `integrity.suspend`. El docente recibe el evento por socket |
| gamification | El XP solo crece por el libro `xp_ledger`. El minijuego no acepta más de 40 XP |
| tutor | `403 KIOSK_ACTIVE` con examen o sala en vivo activos. Sin clave de IA la pista cita la lección |
| biometrics | `IMAGE_NOT_ALLOWED` si llega una foto. Consentimiento de la política vigente. Menor sin acudiente: `GUARDIAN_CONSENT_REQUIRED`. El vector no aparece en logs |
| analytics | Cada PDF/Excel tiene título, fecha, identificador y filas salidas de la BD |
| certification | No se emite sin examen del curso ≥ 60%. `/verificar/:code` es público y no exige sesión |

## Datos

CockroachDB es la única base. `withTx` reintenta `40001`. La migración `0000` ya corrió en el clúster de desarrollo: no volver a borrarla del historial ni a ejecutar drops a mano.

## Fuera de alcance

No proponer huella, liveness forense, firma criptográfica del rector, ni cambiar la base a Postgres de Render.
