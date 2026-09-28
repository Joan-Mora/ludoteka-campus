# EduQuest — RF / RNF Must (corte Prisma)

**Producto:** EduQuest · Colegio Francisco Arango  
**Carpeta:** `C:\Users\joanm\Documents\Proyectos\EduQuest`  
**Fecha:** 2026-09-28 · **Autor:** Cronista  
**Corte:** Prisma + refinamiento EQ-P09 (Ley 1581) + threat model Bastión  
**Branding:** EduQuest / Colegio Francisco Arango  
**Estructura:** `web/` + `api/` + `sql/`  
**Amenazas facial:** `docs/threat-model-eq-p09-facial.md`

## 0. Dual-track

| Track | IDs | Objetivo |
|-------|-----|----------|
| **B — Parcial BD** | EQ-P01…P10 | Cockroach, auth, reportes, Confluence, facial, IA práctica |
| **A — Colegio** | EQ-C01…C06 | PWA, Kahoot-like sexto, kiosco, certificado |

Plazo ~17 días. Una app sirve ambos.

## 1. DEC-01 — Facial (cerrada)

| Campo | Valor |
|-------|-------|
| Estado | **Cerrada por Darwin** |
| Alcance | Facial para **profesores y estudiantes** (ingreso a cuenta personal) |
| Legal | Consentimiento informado + tratamiento de datos (**Ley 1581 de 2012**, Colombia) |
| Condiciones | Password **siempre** fallback; UX consentimiento en registro/enrolamiento; retención y borrado de embeddings |
| Técnico | On-device → API solo `embedding[]` + `modelId` (**sin foto cruda**) |
| Huella / liveness | **Nice** (fuera Must 17d) |

---

## 2. RF Must — Parcial (EQ-P01…P10)

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| **EQ-P01** | App web funcional en URL pública | Deploy estable (**no** ngrok); app en Render |
| **EQ-P02** | BD **CockroachDB** (única permitida) | Cockroach Cloud + scripts SQL; **prohibido** Render Postgres como BD principal |
| **EQ-P03** | Modelo ER + tablas + PK/FK + restricciones | Diagrama + SQL en `sql/` |
| **EQ-P04** | CRUD + consultas SQL + integridad de datos | Demo + capturas |
| **EQ-P05** | Auth tradicional: registro, login, logout + hash | Nunca texto plano; argon2/equivalente |
| **EQ-P06** | Roles/perfiles + rutas protegidas | `student`, `teacher`, `admin` |
| **EQ-P07** | Recuperación de contraseña por correo | Flujo E2E |
| **EQ-P08** | Confluence pregunta→respuesta del enunciado | Problema, solución, arquitectura, BD, IA, seguridad, demo, deploy + **evidencias** |
| **EQ-P09** | Login facial on-device (teacher + student) | Ver desglose §2.1 |
| **EQ-P10** | IA tutor mates sexto | Solo modo **práctica**; gate `KIOSK_ACTIVE` (prohibido en examen) |

### 2.1 EQ-P09 — Desglose Must (refinamiento Prisma)

| Sub | Requisito | Criterio de aceptación |
|-----|-----------|------------------------|
| P09.1 | Consentimiento informado + tratamiento Ley 1581 | Copy UX explícito (finalidad, dato biométrico/sensible, responsables); aceptación antes de enroll |
| P09.2 | Consentimiento auditable | Persistir `user_id`, `policy_version`, `accepted_at`; enroll exige consent vigente (`FACIAL_POLICY_VERSION`); cambio de versión → re-consent |
| P09.3 | UX consentimiento | Visible en flujo de registro y/o enrolamiento facial (no oculto en Términos genéricos) |
| P09.4 | Minimización: sin foto cruda | Cliente on-device; API/BD solo `embedding[]` + `modelId`; rechazar campos de imagen |
| P09.5 | Login | `email` + vector (no 1:N abierto); umbral `FACIAL_MATCH_THRESHOLD`; fallo → ofrecer password |
| P09.6 | Fallback password | Siempre disponible en UI y API; facial no puede ser único factor |
| P09.7 | Retención y borrado | Política documentada + `DELETE` de embedding (usuario); borrado al baja de cuenta o plazo fijado en política |
| P09.8 | No loguear embeddings | Errores genéricos; sin vector en logs |
| P09.9 | Huella | Fuera Must |

## 3. RF Must — Colegio (EQ-C01…C06)

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| **EQ-C01** | PWA mínima | `manifest` + service worker |
| **EQ-C02** | Evaluaciones Kahoot-like | Sesión, preguntas, timer/puntos, calificación automática |
| **EQ-C03** | Banco preguntas mates **sexto** | Seed sembrable |
| **EQ-C04** | Roles alineados a P06 | Estudiante, docente (+ admin) |
| **EQ-C05** | Anti-fraude kiosco | Fullscreen; blur/visibility/Esc → `integrity_events` + alerta/suspensión |
| **EQ-C06** | Certificado PDF + insignia | Aval rector placeholder + QR/ID |

## 4. RNF Must (generales)

| ID | Requisito | Criterio de aceptación |
|----|-----------|------------------------|
| RNF-01 | Monolito modular PWA + API | `web/` + `api/` + `sql/` (ADR-001) |
| RNF-02 | Deploy Render + Cockroach Cloud (SSL) | `DATABASE_URL` en secrets |
| RNF-03 | Secretos solo en env | JWT, mail, DB, umbral facial; nunca en Git |
| RNF-04 | Healthcheck con ping a BD | `/health` o `/api/health` |
| RNF-05 | Branding EduQuest / CFA | UI y docs |
| RNF-06 | Repo Git + scripts SQL | Enlaces en Confluence (EQ-P08) |

## 5. RNF Must — Facial / Ley 1581 (EQ-P09)

| ID | Requisito | Criterio de aceptación | Origen |
|----|-----------|------------------------|--------|
| **RNF-F01** | Sin foto/blob crudo a API ni BD | Validación body; sin columnas imagen | Bastión T1 |
| **RNF-F02** | Consent + `policyVersion` / re-consent | 403 `CONSENT_REQUIRED` si falta | Bastión T2–T3 |
| **RNF-F03** | Retención + borrado embeddings | Endpoint delete + política de plazo/baja | Bastión T4 / Prisma |
| **RNF-F04** | Password siempre fallback | Login password nunca oculto ni deshabilitado | Bastión T10 / Darwin |
| **RNF-F05** | Login facial acotado | `email` + embedding; rate limit recomendado | Bastión T5 |
| **RNF-F06** | No loguear embeddings | Logs sin vector | Bastión T8 |
| **RNF-F07** | Copy Ley 1581 en UX | Texto de consentimiento alineado a esta sección | Nexus / Bastión T11 |
| **RNF-F08** | Modelo lab documentado | p.ej. `eduquest-lab-luma-v1`; no forense | Bastión residual |

## 6. Nice / fuera de Must (17 días)

| Ítem | Nota |
|------|------|
| Minijuegos / rachas / medallas | Fase 2 rectoría |
| Panel analítica Rectoría | Fase 3 |
| Captura de voz | Alternativo docx |
| Grados 7–9 | MVP = sexto |
| Proctoring ML / liveness anti-spoof | Nice |
| Huella u otros biometrics | Nice |
| Firma criptográfica real del Rector | Placeholder OK |
| Render Postgres como BD principal | **Prohibido** |

## 7. Liberación

RF/RNF **EQ-P09 + RNF-F01…F08** formalizados (Ley 1581, UX consentimiento, retención/borrado, sin foto).  
@Atlas: parchear ADR-002 / contratos si hace falta alineación.  
@Pulse @Forge: alinear copy Ley 1581 / retención cuando Atlas confirme.  
@Bastión: hardening post-parche según threat model.  
Build Cursor: hold hasta parche Atlas.
