# EduQuest — Plantilla taller Confluence (EQ-P08)

**Producto:** EduQuest · Colegio Francisco Arango  
**Parcial:** Gestión y operación de BD (Cockroach) + deploy  
**Carpeta:** `C:\Users\joanm\Documents\Proyectos\EduQuest`  
**Fecha plantilla:** 2026-09-28 · **Autor:** Cronista  
**Uso:** copiar cada sección a páginas del espacio Confluence del equipo; completar `[PENDIENTE]` antes de la sustentación.

---

## 0. Portada / metadatos (página índice)

| Campo | Valor |
|-------|-------|
| Equipo | `[PENDIENTE: nombres]` |
| Producto | EduQuest |
| Dominio | Evaluación gamificada mates **sexto** + integridad en aula (kiosco) |
| Repo Git | `[PENDIENTE: URL]` |
| URL app (web) | `[PENDIENTE: https://…onrender.com]` |
| URL API | `[PENDIENTE: https://…onrender.com]` · health: `/api/health` |
| BD | Cockroach Cloud (wire Postgres + SSL) — **no** Render Postgres |
| Scripts SQL | `sql/` en el repo |
| Docs canónicos | `docs/` (visión, RF/RNF, arquitectura, contratos, threat model) |

**Checklist entregables del enunciado**

- [ ] App web desplegada (URL pública, no ngrok)
- [ ] Repo Git + scripts SQL crear/poblar
- [ ] Espacio Confluence (esta documentación)
- [ ] Evidencias (sección 9)
- [ ] Sustentación oral (secciones 1–8)

---

## 1. Problema

**Pregunta del enunciado:** ¿Qué problema solucionaron?

**Respuesta (borrador Confluence):**

El Colegio Francisco Arango necesita evaluar matemáticas de **sexto** en aula con formato tipo Kahoot, sin depender solo de apps genéricas que no dejan BD propia ni control de integridad. En paralelo, el parcial exige demostrar app web + **CockroachDB** + auth con hash y recovery por correo + reportes PDF/Excel + deploy estable + documentación.

EduQuest cierra ambos: PWA de evaluaciones con anti-fraude de kiosco (fullscreen / pérdida de foco) y certificado con aval rector (placeholder), sobre Cockroach Cloud y API en Render.

**Evidencia sugerida:** 1 slide o captura del flujo estudiante en kiosco + enlace a `docs/01-vision.md`.

---

## 2. Solución

**Pregunta:** ¿Cómo lo solucionaron?

**Respuesta (borrador):**

Una sola aplicación **dual-track**:

| Track | Qué entrega |
|-------|-------------|
| **A — Colegio** | PWA, sesión Kahoot-like sexto, banco sembrable, integridad kiosco, certificado PDF + insignia |
| **B — Parcial** | Cockroach, ER/CRUD, auth+roles+hash, recovery email, PDF+Excel, facial on-device, tutor IA solo en **práctica**, deploy Render |

Stack: `web/` (Vite + React + TS + PWA) · `api/` (Node + Express + TS) · `sql/` · Cockroach Cloud · secretos solo en env.

**Evidencia sugerida:** diagrama de carpetas `EduQuest/` y captura de build local (`web :5173`, `api :3001`).

---

## 3. Arquitectura

**Pregunta:** ¿Cómo están integrados los componentes?

**Respuesta (borrador):**

Monolito modular en **dos procesos** (ADR-001):

```
Navegador (PWA)  →  API Render  →  Cockroach Cloud
     ↑                  ↑
  manifest+SW     JWT, mail (Resend), facial embeddings, reports
```

Módulos API: `health`, `auth`, `users`, `quizzes`, `integrity`, `reports`, `practice`, `facial`.  
Módulos web: `auth`, `student`, `teacher`, `kiosk`, `certificates`, `facial`, `pwa`.

Detalle: `docs/arquitectura.md` · contratos: `docs/contratos-api.md` (rev.c: recovery + reportes).

**Evidencia sugerida:** diagrama C4/contexto en Confluence + link a contratos.

---

## 4. Base de datos

**Pregunta:** ¿Cómo diseñaron el modelo?

**Respuesta (borrador):**

BD relacional distribuida **solo CockroachDB**. Modelo mínimo Must:

- `users` (roles `student` \| `teacher` \| `admin`, `password_hash`)
- `password_reset_tokens`
- `questions` (banco mates sexto)
- `quiz_sessions` / `quiz_attempts` / `attempt_answers`
- `integrity_events`
- `certificates`
- `facial_embeddings` + consentimiento auditable (`policy_version`, `accepted_at`) — **sin foto cruda**

Scripts en `sql/` (schema + seed). Migrate/smoke verificado en lab (API `:3001`).

**Evidencia sugerida:** diagrama ER en Confluence · captura Cockroach Console · `psql`/SQL mostrando FK · archivo `sql/001_schema.sql` en repo.

---

## 5. IA

**Pregunta:** ¿Qué problema resuelve la IA?

**Respuesta (borrador):**

Dos usos distintos (rúbrica / parcial alternativo):

1. **Login facial (EQ-P09):** embedding on-device → API solo `embedding[]` + `modelId`; match por umbral; **password siempre fallback**; consentimiento Ley 1581.
2. **Tutor de práctica (EQ-P10):** chatbot mates sexto **solo fuera de examen**; gate `KIOSK_ACTIVE` → 403 si hay evaluación activa (no ayuda a copiar).

**Evidencia sugerida:** video corto facial login · captura chat práctica · SQL `user_id`↔embedding (sin volcar el vector en la página) · threat model `docs/threat-model-eq-p09-facial.md`.

---

## 6. Seguridad

**Pregunta:** ¿Cómo protegieron las cuentas de usuario?

**Respuesta (borrador):**

| Control | Cómo |
|---------|------|
| Contraseñas | Hash (argon2/bcrypt); nunca texto plano |
| Sesión | JWT; en `production` se rechazan secretos débiles / vacíos |
| Recovery | Token por correo (Resend en prod); `forgot` siempre 204 (no enumeration) |
| Roles | Rutas protegidas `student` / `teacher` / `admin` |
| Facial | Sin foto/blob en API/BD; consent auditable; rate limit; no logs de embeddings |
| Secretos | Solo env Render: `DATABASE_URL`, `JWT_SECRET` (≥32), `RESEND_API_KEY`, `SMTP_FROM`, `CORS_ORIGIN`, `APP_PUBLIC_URL`, … — **nunca en repo** |
| Integridad aula | Eventos kiosco → posible suspensión del intento |

**Evidencia sugerida:** captura `.env.example` sin secretos · snippet hash · captura rate-limit / rechazo JWT débil · link threat model.

---

## 7. Demo (guion vivo)

Orden sugerido para el docente (ajustar tiempos):

1. Health / app en URL pública  
2. Registro + login password + roles  
3. Docente crea sesión · estudiante responde Kahoot sexto (timer/score)  
4. Integridad: salir de fullscreen / cambiar pestaña → evento visible  
5. Recovery email (o stub documentado si lab)  
6. Login facial + fallback password  
7. Tutor IA en práctica (y mostrar bloqueo en kiosco)  
8. Descargar `certificate.pdf` + `report.xlsx` / `report.pdf`  
9. Mostrar SQL / Cockroach y un CRUD

**Evidencia sugerida:** checklist marcado en vivo + 1 video de respaldo por ítem crítico.

---

## 8. Deploy

**Pregunta:** Demostrar que el sistema funciona en producción.

**Respuesta (borrador):**

| Pieza | Destino |
|-------|---------|
| API | Render Web Service · `NODE_ENV=production` |
| Web | Render Static (o servir estáticos) |
| BD | Cockroach Cloud · `DATABASE_URL` SSL |
| Mail | **Resend** (`RESEND_API_KEY` + `SMTP_FROM` dominio verificado) |

Gate pre-deploy (Bastión): secretos en dashboard Render; SMTP stub/mock **solo lab**.

**Evidencia sugerida:** URL pública · captura Render + Cockroach · `GET /api/health` 200 · login en prod.

`[PENDIENTE: pegar URLs y capturas tras EQ-P07 deploy]`

---

## 9. Evidencias (rúbrica enunciado)

Marcar y enlazar captura/video en Confluence:

| # | Evidencia | Estado | Link / archivo |
|---|-----------|--------|----------------|
| 1 | Login tradicional | `[ ]` | |
| 2 | Login facial | `[ ]` | |
| 3 | Recuperación de contraseña | `[ ]` | |
| 4 | Funcionalidad de IA (práctica) | `[ ]` | |
| 5 | CRUD | `[ ]` | |
| 6 | PDF (certificado / reporte) | `[ ]` | |
| 7 | Excel dinámico | `[ ]` | |
| 8 | App desplegada (URL) | `[ ]` | |
| 9 | BD Cockroach real + scripts | `[ ]` | |
| 10 | Integridad kiosco (extra colegio) | `[ ]` | |

---

## 10. Enlaces rápidos a docs del repo

| Doc | Ruta |
|-----|------|
| Visión | `docs/01-vision.md` |
| RF/RNF | `docs/RF-RNF.md` |
| Arquitectura | `docs/arquitectura.md` |
| Contratos API | `docs/contratos-api.md` |
| Threat model facial | `docs/threat-model-eq-p09-facial.md` |
| Bitácora | `docs/bitacora.md` |
| Esta plantilla | `docs/confluence-eq-p08.md` |

---

## 11. Pendientes Cronista / equipo

- [ ] Crear páginas en el espacio Confluence y pegar §1–§8  
- [ ] Completar URLs, repo y capturas post-Render  
- [ ] Diagrama ER exportado (Forge/Cronista)  
- [ ] Videos cortos evidencias 1–8  
- [ ] Revisar copy Ley 1581 en página de privacidad/facial del espacio
