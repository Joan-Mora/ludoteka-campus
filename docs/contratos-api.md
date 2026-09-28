# EduQuest — Contratos API (Must)

**Base:** `https://<api-render>/api` (local `http://localhost:3001/api`)  
**Auth:** Bearer salvo rutas públicas.  
**Errores:** `{ "error": { "code": string, "message": string } }`  
**Rev:** 2026-09-28c — recovery + reportes explícitos (EQ-P07 / EQ-C06)

---

## Health

### GET `/api/health`
**200** `{ "ok": true, "db": "up"|"down" }`

---

## Auth

### POST `/api/auth/register`
Body: `{ "email", "password", "name", "role": "student"|"teacher" }`  
**201** `{ "user": { "id", "email", "name", "role" }, "token": string }`

### POST `/api/auth/login`
Body: `{ "email", "password" }` → **200** mismo shape. Password **siempre** disponible (RNF-F04).

### POST `/api/auth/logout`
Bearer → **204**

### POST `/api/auth/forgot-password` (EQ-P07)
Público. Body: `{ "email": string }`  
**204** siempre (no enumerar usuarios). Si el email existe: crear `password_reset_tokens` (TTL corto), enviar link/código por correo (Resend/SMTP; mock log en lab).  
Env: `SMTP_*` o `RESEND_API_KEY`, `APP_PUBLIC_URL`.

### POST `/api/auth/reset-password` (EQ-P07)
Público. Body: `{ "token": string, "password": string }`  
**204** · **400** `INVALID_TOKEN` | `WEAK_PASSWORD`

---

## Quizzes / attempts / integrity

- CRUD questions (teacher/admin); seed mates sexto.
- Sessions: create/join/start/end (código sala).
- Attempts: start/answer/submit; score automático.
- `POST /api/attempts/:id/integrity-events` Body: `{ "type": "blur"|"visibility"|"escape"|"fullscreen_exit", "at"?: string }`  
  Política v1: ≥2 eventos → `attempt.status = suspended`.

Detalle de shapes quiz: sin cambio; Forge mantiene lo ya tipado en `api/`.

---

## Reportes / certificado (EQ-C06 + parcial reportes)

### GET `/api/attempts/:id/certificate.pdf`
Bearer (student dueño o teacher/admin).  
**200** `application/pdf` (aval rector placeholder + code/QR).  
**404** si attempt no aprobado / sin cert.

### GET `/api/sessions/:id/report.xlsx`
Bearer teacher dueño o admin.  
**200** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`  
Columnas mín.: estudiante, score, status, integrity_count, submitted_at.

### GET `/api/sessions/:id/report.pdf` (opcional mismo Must)
Mismo alcance que xlsx; resumen por sesión. **200** `application/pdf`.

---

## Facial Must (EQ-P09 / RNF-F)

**Reglas globales**
- Body **solo** JSON. Si aparecen `image`, `photo`, `blob`, `file`, `dataUrl` → **400** `IMAGE_NOT_ALLOWED` (RNF-F01).
- Nunca loguear `embedding` ni volcarlo en errores (RNF-F06).
- Rate limit recomendado en `/facial/login` y `/auth/login` (RNF-F05).

### POST `/api/facial/consent`
Body: `{ "policyVersion": string, "accepted": true }`  
`policyVersion` = `FACIAL_POLICY_VERSION`. Persiste `user_id`, `policy_version`, `accepted_at`. **204**

### GET `/api/facial/consent`
→ `{ "accepted", "policyVersion", "acceptedAt", "policyCurrent", "needsReconsent" }`

### POST `/api/facial/enroll`
Autenticado + consent vigente. Body: `{ "embedding": number[], "modelId": string }`  
**201** `{ "enrolled": true }` · **403** `CONSENT_REQUIRED` · **400** `INVALID_EMBEDDING` | `IMAGE_NOT_ALLOWED`

### POST `/api/facial/login`
Público. Body: `{ "email", "embedding", "modelId" }`  
**200** = shape auth/login · **401** `NO_MATCH` | `NOT_ENROLLED`

### DELETE `/api/facial/enroll`
**204** — retención: baja cuenta + opcional `FACIAL_RETENTION_DAYS` / `purge:facial`.

---

## Practice (EQ-P10)

### POST `/api/practice/chat`
Autenticado. `{ "message", "history"? }` → **200** `{ "reply" }` · **403** `KIOSK_ACTIVE`

---

## Env

| Var | Notas |
|-----|-------|
| `DATABASE_URL` | Cockroach SSL |
| `JWT_SECRET` | ≥32 chars aleatorios; production rechaza débil |
| `CORS_ORIGIN` | |
| `APP_PUBLIC_URL` | links reset / QR cert |
| `SMTP_*` / `RESEND_API_KEY` | recovery email; mock si ausente en lab |
| `FACIAL_MATCH_THRESHOLD` | default lab `0.6` |
| `FACIAL_POLICY_VERSION` | p.ej. `2026-09-28` |
| `FACIAL_RETENTION_DAYS` | `0` = solo borrado manual/baja |
| `OPENAI_API_KEY` | practice; mock si ausente |

`.env.example` sin secretos.
