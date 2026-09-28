# EduQuest — Export handoff (PDF / otra IA)

**Producto:** EduQuest · Colegio Francisco Arango (CFA)  
**Carpeta raíz:** `C:\Users\joanm\Documents\Proyectos\EduQuest`  
**Fecha:** 2026-09-28 · **Contenido:** Cronista · **PDF:** Marquitos  
**Sin secretos:** no hay valores de `JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY` ni otras claves.

---

## 1. Portada / propósito del handoff

Documento canónico para entregar a **otra IA** (o humano) el estado de EduQuest: qué es, qué debe construirse (Must), qué queda fuera (Nice), decisiones ya tomadas, docs fuente, y el **nuevo modo de equipo**.

| Campo | Valor |
|-------|-------|
| Cliente institucional | Colegio Francisco Arango |
| Dual-track | A colegio MVP sexto · B parcial Gestión BD |
| Plazo ref. | ~17 días Must |
| Branding UI ancla | Skin **A · Fuego CFA** (coral/oro/índigo) |
| Modo vigente | Darwin construye · bots solo review |

---

## 2. Idea / visión / para qué

### Problema
CFA necesita evaluaciones de mates **sexto** gamificadas en aula (tipo Kahoot), con integridad anti-fraude en kiosco y certificado con aval rector (placeholder). En paralelo, el parcial universitario exige app web + **CockroachDB** + auth (hash, roles, recovery email) + reportes PDF/Excel + deploy estable (**no** ngrok) + Confluence + (rúbrica) facial e IA de dominio.

### Para qué existe EduQuest
Una sola app que cumple **producto colegio** y **rúbrica del parcial**, con BD propia (Cockroach Cloud), PWA instalable y controles de integridad sin depender solo de apps genéricas.

### Solución (dual-track)
| Track | Entrega |
|-------|---------|
| **A — Colegio** | PWA, Kahoot-like sexto, banco sembrable, kiosco (fullscreen/foco/Esc → `integrity_events`), certificado PDF + insignia |
| **B — Parcial** | Cockroach, ER/CRUD, auth+roles+hash, recovery, PDF+Excel, Render, Confluence, facial on-device, tutor IA **solo práctica** |

---

## 3. Must (EQ-P / EQ-C) vs Nice

### Track B — EQ-P01…P10
| ID | Must |
|----|------|
| EQ-P01 | URL pública (Render; no ngrok) |
| EQ-P02 | BD **CockroachDB** única |
| EQ-P03 | ER + SQL en `sql/` |
| EQ-P04 | CRUD + integridad |
| EQ-P05 | Registro / login / logout + hash |
| EQ-P06 | Roles `student` \| `teacher` \| `admin` |
| EQ-P07 | Recovery password por correo |
| EQ-P08 | Confluence Q→A + evidencias |
| EQ-P09 | Facial on-device teacher+student (Ley 1581) |
| EQ-P10 | IA tutor mates sexto; gate `KIOSK_ACTIVE` |

### Track A — EQ-C01…C06
| ID | Must |
|----|------|
| EQ-C01 | PWA (manifest + SW) |
| EQ-C02 | Kahoot-like (sesión, timer, puntos) |
| EQ-C03 | Banco mates sexto |
| EQ-C04 | Roles alineados |
| EQ-C05 | Anti-fraude kiosco |
| EQ-C06 | Certificado PDF + insignia |

### RNF Must (resumen)
Monolito modular `web/`+`api/`+`sql/`; Render + Cockroach; secretos en env; `/api/health`; branding EduQuest/CFA; **RNF-F01…F08** (sin foto cruda, consent auditable, retención/borrado, password fallback, no logs embeddings, copy Ley 1581).

### Nice / fuera Must
Minijuegos/rachas avanzadas, panel métricas rectoría, voz, grados 7–9, proctoring ML/liveness, **huella**, firma criptográfica real del rector, **3D**, Render Postgres como BD principal.

---

## 4. Decisiones clave

| Decisión | Valor |
|----------|-------|
| **ADR-001** | Monolito modular: `web/` + `api/` + `sql/` |
| **BD** | Cockroach Cloud (wire Postgres + SSL); **no** Render Postgres |
| **DEC-01** | Facial teacher+student; consent Ley 1581; password siempre fallback; huella=Nice |
| **ADR-002** | On-device → API solo `embedding[]`+`modelId`; `policyVersion`/re-consent; practice + `KIOSK_ACTIVE` |
| **Mail prod** | Resend (stub/mock solo lab) |
| **UI** | Ancla **A · Fuego CFA**; piel gamificada Must; 3D/rectoría = Nice |
| **Ops 2026-09-28** | STOP implementación bots; Darwin construye; bots review-only |

Detalle ADR-002 / RNF-F: `docs/ADR-002.md`, `docs/RF-RNF.md`, `docs/threat-model-eq-p09-facial.md`.

---

## 5. Arquitectura y stack

**Forma:** dos procesos + BD cloud.

| Capa | Elección |
|------|----------|
| Web | Vite + React + TS + PWA (`vite-plugin-pwa`) |
| API | Node + Express + TS + `pg` → Cockroach |
| Auth | Hash argon2/bcrypt; JWT; recovery token + mail |
| PDF / Excel | pdfkit (o similar) / exceljs |
| Deploy | Render Web Service + Static; health → `/api/health` |

**Módulos API:** health, auth, users, quizzes, integrity, reports, practice, facial.  
**Módulos web:** auth, shell, student, teacher, kiosk, certificates, facial, pwa.  
Fuente: `docs/arquitectura.md`.

**Tablas mínimas:** `users`, `password_reset_tokens`, `questions`, `quiz_sessions`, `quiz_attempts`, `attempt_answers`, `integrity_events`, `certificates`, `facial_embeddings` (+ consent auditable).

---

## 6. Contratos API / auth / facial (resumen)

Base: `/api` · Bearer salvo públicas · errores `{ error: { code, message } }`.  
Fuente: `docs/contratos-api.md` (rev facial + recovery/reportes rev.c).

| Área | Endpoints / reglas |
|------|-------------------|
| Health | `GET /api/health` |
| Auth | register / login / logout / forgot (**204**) / reset (`WEAK_PASSWORD`) |
| Quizzes | questions, sessions, attempts, integrity-events; auto-`completed` |
| Reportes | `certificate.pdf` (attempt completed); `report.xlsx` / `report.pdf` |
| Facial | Body solo JSON; `image`/`photo`/… → **400** `IMAGE_NOT_ALLOWED` |
| Consent | `POST/GET /api/facial/consent` · `policyVersion` · `needsReconsent` |
| Enroll | `POST/DELETE /api/facial/enroll` · exige consent · embedding+modelId |
| Login facial | `email` + embedding · UI ofrece password si falla |
| Practice | `POST /api/practice/chat` · **403** `KIOSK_ACTIVE` |

Nombres de env (valores → Darwin / `.env`, nunca repo): ver `api/.env.example` — `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `APP_PUBLIC_URL`, `FACIAL_*`, `RESEND_API_KEY`, `SMTP_*`, `OPENAI_API_KEY`, …

---

## 7. Estado hecho (2026-09-28)

| Área | Estado |
|------|--------|
| Estudio RF/RNF + DEC-01 + RNF-F | Hecho |
| Arquitectura + ADR-002 + contratos | Hecho |
| Must API local | Cerrado (recovery, reportes, quizzes/integrity, facial, practice) |
| Must UI funcional | PWA, Kahoot, kiosco, cert + skin Fuego CFA (iteración visual) |
| Smoke local | **PASS** API `:3001` + facial (`IMAGE_NOT_ALLOWED`, `CONSENT_REQUIRED`) |
| EQ-P08 | Plantilla `docs/confluence-eq-p08.md`; falta espacio Confluence + evidencias post-deploy |
| Skin visual | Rework 6 puntos en `:5173` (PWA ~351 KiB); **OK Darwin pendiente** |
| Deploy Render | **Hold** (OK visual + Resend + secretos) |
| Implementación bots | **STOP** — modo review-only |

---

## 8. Inventario docs canónicos

| Path | Contenido |
|------|-----------|
| `docs/01-vision.md` | Visión |
| `docs/RF-RNF.md` | Must + RNF-F |
| `docs/glosario.md` | IDs |
| `docs/arquitectura.md` | Monolito / stack / datos |
| `docs/ADR-002.md` | Facial + practice |
| `docs/contratos-api.md` | Contratos Must |
| `docs/threat-model-eq-p09-facial.md` | Amenazas facial |
| `docs/confluence-eq-p08.md` | Plantilla taller Confluence |
| `docs/bitacora.md` | Decisiones |
| `docs/export-handoff.md` | Este export |
| `api/.env.example` | Nombres de variables (sin secretos) |
| `sql/` | Schema + seeds |
| `web/` · `api/` | Código Must |

Briefs/enunciado: parcial BD (docx), propuesta rectoría, discovery Lab Innovación (copias en briefs/ o Lab).

---

## 9. Seeds demo (lab)

Emails públicos de seed (Forge, smoke local). **Passwords:** ver seed SQL / notas de lab en repo o `api/.env.example` — **no** copiar contraseñas a este PDF ni a chats.

| Email típico | Rol |
|--------------|-----|
| `alumno@eduquest.local` | student |
| (también docente/admin en el mismo seed) | teacher / admin |

Solo entorno local. Producción: cuentas reales + secretos en Render.

---

## 10. Nuevo modo de equipo (obligatorio)

**Darwin construye. Bots solo revisión / feedback.**

- STOP de implementación (código, skins, APIs, patches) por parte de Pulse / Forge / Bastión / Atlas / Cronista-build.
- Nexus coordina alcance; pedidos de review por área (buenas prácticas, comparación profesional, hallazgos).
- Cronista: docs canónicos y exports; Marquitos: PDF/build packaging cuando Darwin pida.
- No reabrir Nice (3D, rectoría, huella) sin orden Darwin.
- Deploy Resend/Render: hold hasta nuevo orden.

---

## 11. Gates abiertos (hold)

1. **OK visual** Skin A (rework 6 puntos) — Darwin.  
2. **Resend** API key + dominio `SMTP_FROM` verificado.  
3. **Secretos Render** (nombres en §4/§6; valores solo Darwin).  
4. Luego: deploy EQ-P01/P07 + evidencias Confluence EQ-P08.

Hasta nuevo orden Nexus/Darwin: **no** ejecutar deploy ni más build de bots.

---

## Checklist IA receptora

1. Leer RF-RNF + arquitectura + ADR-002 + contratos + threat-model.  
2. Respetar Must vs Nice.  
3. Cero secretos en repo.  
4. Facial = embedding + consent Ley 1581 + password fallback.  
5. Confirmar modo “Darwin construye / bots review” antes de tocar código.

---

*Fin export handoff · Cronista · 2026-09-28 rev. Nexus PDF*
