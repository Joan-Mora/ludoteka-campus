# EduQuest — Arquitectura (monolito modular)

**Fecha:** 2026-09-28 · **Autor:** Atlas · **Fase:** arquitectura (liberada)  
**Carpeta:** `C:\Users\joanm\Documents\Proyectos\EduQuest`  
**Branding:** EduQuest / Colegio Francisco Arango

## 1. Forma

**Monolito modular en dos procesos** (misma raíz):

| Proceso | Rol | Deploy |
|---------|-----|--------|
| `web/` | PWA (Vite + React + TS) | Render Static Site (o servir estáticos desde API en Free) |
| `api/` | API HTTP + jobs ligeros | Render Web Service |
| Cockroach Cloud | BD única (wire Postgres + SSL) | **No** Render Postgres |

Una app sirve Track A (colegio) y Track B (parcial). Facial/IA: módulo reservado; **no** en Must hasta DEC-01.

```
EduQuest/
  docs/
  briefs/
  web/                 # PWA
  api/                 # Express + TS
  sql/                 # scripts crear/poblar (RF-B03/B11)
```

## 2. Módulos y límites

### `api/src/`

```
modules/
  health/          # GET /api/health (ping BD)
  auth/            # registro, login, logout, recovery email, roles
  users/           # perfiles CRUD admin/docente
  quizzes/         # banco preguntas, sesiones Kahoot-like, intentos, puntuación
  integrity/       # integrity_events (foco/pestaña/Esc)
  reports/         # PDF certificado + Excel/PDF reportes (≥2)
  practice/         # EQ-P10 tutor IA (solo práctica)
  facial/          # EQ-P09 enroll/login embedding (Must)
shared/
  config/          # env
  db/              # pool pg → Cockroach
  errors/
  types/
```

**Reglas:** `facial` no se monta en el router hasta DEC-01 = demo. Chatbot IA (si DEC-01) vive fuera de rutas de examen kiosco. Solo `auth` y `shared/config` tocan secretos.

### `web/src/`

```
modules/
  auth/
  shell/           # layout branding colegio
  student/         # unirse a sesión, jugar
  teacher/         # crear sesión, banco, ver integridad
  kiosk/           # fullscreen + listeners foco/visibilidad/Esc
  certificates/    # descarga PDF/insignia
  facial/          # EQ-P09 UI on-device + consentimiento
shared/
  api/             # cliente HTTP → Render API
  types/           # DTOs alineados a contratos
  pwa/             # manifest + SW (vite-plugin-pwa)
```

## 3. Stack recomendado (17 días)

| Capa | Elección |
|------|----------|
| Web | Vite 8, React 19, TypeScript, CSS modules o Tailwind; `vite-plugin-pwa` |
| API | Node 20+, Express 5, TypeScript, `pg` (o Drizzle) → Cockroach |
| Auth | argon2/bcrypt hash; sesión JWT httpOnly **o** cookie session; recovery token + correo (Resend/SMTP) |
| PDF | `pdfkit` / `puppeteer` ligero para certificado |
| Excel | `exceljs` |
| Deploy | API Render + `DATABASE_URL` secret; Web Static en Render; healthcheck Render → `/api/health` |

## 4. Modelo de datos (mínimo)

Tablas (SQL en `sql/`):

- `users` (id, email, password_hash, role: student\|teacher\|admin, name, …)
- `password_reset_tokens`
- `questions` (banco mates sexto)
- `quiz_sessions` (código sala, teacher_id, status, …)
- `quiz_attempts` (session_id, user_id, score, status)
- `attempt_answers`
- `integrity_events` (attempt_id, type, at)
- `certificates` (attempt_id, code, issued_at, pdf_meta)
- `facial_embeddings` — **solo si DEC-01**; no crear en Must inicial

ER + seeds: Forge/sql; diagrama lo formaliza Cronista/Forge en Confluence.

## 5. Anti-fraude kiosco (RF-A05)

- Front `kiosk`: `requestFullscreen`; listeners `visibilitychange`, `blur`, `keydown` Esc.
- Cada evento → `POST /api/attempts/:id/integrity-events`.
- Política v1: N eventos (default 2) → `attempt.status = suspended` + flag visible a docente.

## 6. Certificado / reportes

- Certificado PDF = reporte 1 (aval rector **placeholder** + QR/ID).
- Reporte 2: Excel o PDF de resultados por sesión (desde BD).

## 7. Facial + practice (Must)

- web/modules/facial: cámara, embedding on-device, consentimiento UI, enroll/login; password siempre visible.
- pi/modules/facial: consent, enroll, login por vector; sin imágenes.
- pi/modules/practice: chat tutor; gate KIOSK_ACTIVE.
- Detalle: ADR-002 + contratos-api § Facial / Practice.
## 8. Liberación Fase arquitectura

Docs: este archivo + `contratos-api.md` + ADR-001 + ADR-002.  
@Forge @Pulse pueden arrancar Must A+B **sin** facial. @Bastión: threat model auth/secretos/Render; facial en cola.
