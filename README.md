# Ludoteka Campus

Campus virtual gamificado del Colegio Francisco Arango (antes EduQuest). Un solo proceso, API NestJS más la web React, sobre CockroachDB.

- **Producción:** https://ludoteka-campus.onrender.com
- **Healthcheck:** `GET /api/health`

## Qué incluye

- **Aula:** cursos, unidades, lecciones, tareas, cartelera con confirmación de lectura y foros.
- **Evaluación:** banco de preguntas, prácticas, exámenes en kiosco con control de integridad y quiz en vivo.
- **Libro de calificaciones:** ponderación por categorías (escala 1.0 a 5.0), asistencia, rúbricas y alertas de riesgo al docente y al acudiente.
- **Juego:** campus isométrico, XP, rachas, misiones, insignias, Arcade y **Arena** por equipos con QR.
- **Estudio:**
  - Mi ruta adaptativa por maestría de temas;
  - Cuaderno con resumen IA y tarjetas SM-2;
  - metas y sesiones de enfoque.
- **Biblioteca:** archivos en Cloudinary, etiquetas, marcadores, glosario y tutor IA con citas a las guías.
- **Observatorio:** preguntas en español convertidas a SQL de solo lectura sobre vistas `v_*`.
- **Acceso facial:** face-api en el navegador, prueba de vida y plantilla cifrada con AES-256-GCM.
- **Voz:** dictado, comandos de navegación y lectura en voz alta.
- **Reportes PDF/Excel** con consecutivo `LK-AAAA-NNNNNN` verificable en `/verificar-reporte/<código>`.

## Estructura

```
apps/api            NestJS 11 + Kysely sobre CockroachDB (módulos con public-api.ts)
apps/web            React 19 + Vite + TanStack Query
packages/contracts  Esquemas zod compartidos
db/migrations       SQL del esquema (0000 a 0017)
db/seeds            Contenido demo de Matemáticas de sexto
docs/               Visión, arquitectura, ER, ADRs, requisitos y Confluence
render.yaml         Blueprint del Web Service en Render
```

## Arranque local

```bash
npm install
npm run dev
```

La API queda en `http://localhost:3000` y la web en `http://localhost:5173`. Al arrancar, la API aplica las migraciones pendientes. Si `users` está vacía, siembra el colegio de demo.

Cuentas de laboratorio (clave `SEED_PASSWORD`, por defecto `EduQuest2026!`):

| Correo | Rol |
|--------|-----|
| admin@eduquest.local | Administrador |
| coordinacion@eduquest.local | Coordinación (directivo) |
| rectoria@eduquest.local | Rectoría (directivo) |
| docente@eduquest.local | Docente |
| estudiante@eduquest.local | Estudiante |
| estudiante2@eduquest.local | Estudiante |
| acudiente@eduquest.local | Acudiente |

## Variables de entorno

Los secretos viven en `apps/api/.env` (ignorado por Git) y, en producción, en el entorno de Render. La plantilla está en `apps/api/.env.example`.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | CockroachDB Cloud (única base permitida) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Firma de sesiones |
| `APP_PUBLIC_URL`, `CORS_ORIGIN` | Enlaces de correo y origen permitido |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_MODEL_SMART`, `AI_FALLBACK_MODELS`, `AI_EMBED_MODEL`, `AI_EMBED_DIM` | Proveedor de IA compatible con OpenAI (por defecto Gemini) |
| `CLOUDINARY_URL` | Archivos de la biblioteca |
| `RESEND_API_KEY`, `MAIL_FROM` | Correo de recuperación; sin clave, el correo queda en `email_outbox` y en el log |
| `FACIAL_*` | Umbral, bloqueo, versión de política y llave AES del acceso facial |
| `SEED_PASSWORD` | Clave de las cuentas demo |

## Scripts

- `npm run dev`: API y web en modo desarrollo.
- `npm run migrate`: aplica `db/migrations`.
- `npm run seed`: rehace el contenido demo del curso de sexto (no borra usuarios).
- `npm run typecheck`: tipos de contratos, API y web.
- `npm run deps:check`: exige las fronteras entre módulos.
- `npm run build && npm start`: lo que corre Render.

## Documentación

| Documento | Contenido |
|---|---|
| `docs/vision.md` | Visión del producto |
| `docs/arquitectura.md` | Módulos, eventos y despliegue |
| `docs/er.md` | Modelo entidad-relación tabla por tabla, vistas y consultas de evidencia |
| `docs/RF-RNF.md` | Requisitos funcionales y no funcionales |
| `docs/confluence-eq-p08.md` | Página Confluence: matriz de la rúbrica, guion de sustentación y evidencias |
| `docs/adr/` | ADR-001 monolito modular · 002 facial y Ley 1581 · 003 eventos · 004 CockroachDB y Kysely · 005 Cloudinary · 006 Observatorio NL→SQL · 007 face-api · 008 Arena con snapshot |
| `docs/glosario.md` | Términos del dominio |
