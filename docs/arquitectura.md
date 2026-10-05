# EduQuest — Arquitectura

Monolito modular. Un repositorio, un proceso, una base de datos.

```
Navegador (PWA)
    │  HTTPS
    ▼
NestJS  ── /api      REST
        ── /socket.io  sesiones en vivo e integridad
        ── /          build estático de React
    │  Postgres wire + SSL
    ▼
CockroachDB Cloud
```

En desarrollo, Vite sirve la web en `:5173` y hace proxy de `/api` y `/socket.io` hacia la API en `:3000`. En producción el mismo proceso de Nest entrega ambos.

## Árbol

```
apps/api/src/core          config, db, auth, errores, eventos, tiempo real, correo
apps/api/src/modules       identity, institution, learning, assessment, integrity,
                           gamification, tutor, biometrics, analytics, certification, notifications
apps/web/src/ui            sistema visual
apps/web/src/features      pantallas, alineadas a los módulos
packages/contracts         esquemas zod compartidos
db/migrations              SQL versionado
db/seeds                   contenido demostrable
```

## Reglas de dependencia

Cada módulo exporta su fachada en `public-api.ts`. Otro módulo solo puede importar esa fachada, nunca un archivo interno. `dependency-cruiser` lo exige (`npm run deps:check`).

Las llamadas síncronas solo bajan por este grafo:

```
identity
  └── institution
        └── learning
              └── assessment
                    └── integrity
                    └── certification
learning ── tutor
integrity ── tutor
```

`gamification`, `analytics` y `notifications` no se importan desde otros módulos. Reaccionan a eventos de dominio:

| Evento | Quién lo emite | Quién escucha |
|--------|----------------|---------------|
| `lesson.completed` | learning | gamification |
| `submission.graded` | learning | gamification |
| `attempt.graded` | assessment | gamification, notifications |
| `integrity.violation` | integrity | gamification (no otorga XP), notifications |
| `integrity.suspend` | integrity | assessment (suspende el intento) |
| `password.reset` | identity | notifications (correo) |
| `tutor.message` | tutor | gamification |

Los tableros leen tablas de otros módulos en solo lectura. La escritura de una tabla la hace el módulo dueño.

## CockroachDB

- Claves `UUID DEFAULT gen_random_uuid()`.
- `withTx()` reintenta la transacción ante el SQLSTATE `40001`.
- SSL según la cadena `DATABASE_URL` (la consola de Cockroach Cloud la trae lista).
- La migración `0000` elimina el esquema anterior del prototipo de quizzes. Es destructiva y solo corre una vez.

## Auth

JWT de acceso corto en memoria del cliente. Refresh opaco, con hash en `refresh_tokens`, en cookie `HttpOnly`. Contraseñas con argon2id. La recuperación no revela si el correo existe.

## IA

Un adaptador compatible con la API de chat de OpenAI (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Sirve para OpenAI, xAI u otro proveedor con el mismo contrato. Si no hay clave, el tutor responde con pistas sacadas de la lección y lo declara. Durante un examen activo el tutor responde `403 KIOSK_ACTIVE`.

## Facial

El navegador calcula un vector con MediaPipe Face Landmarker y envía solo `embedding` + `modelId`. La API rechaza cualquier campo de imagen. El detalle legal está en ADR-002.

## Despliegue

Un Web Service de Render. `render.yaml` en la raíz. Healthcheck: `GET /api/health` (incluye ping a la base). El sistema de archivos de Render es efímero: no se guardan PDFs en disco; se generan en la respuesta.
