# Bitácora de decisiones — Ludoteka Campus (antes EduQuest)

> Última revisión: 2026-10-09 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest). Las filas del 28-sep usan las rutas de entonces (`web/`, `api/`, `sql/`), que ya no existen.

| Fecha | Decisión | Quién | Notas |
|-------|----------|-------|-------|
| 2026-09-28 | Kickoff EduQuest; carpeta `Proyectos\EduQuest` | Nexus | Branding EduQuest / CFA |
| 2026-09-28 | Dual-track A+B; Render + Cockroach Cloud | Nexus / Mercado | |
| 2026-09-28 | Arquitectura ADR-001; `web/`+`api/`+`sql/` | Atlas | |
| 2026-09-28 | DEC-01 cerrada: facial teacher+student; consentimiento; fallback password | Darwin / Nexus | Huella=Nice |
| 2026-09-28 | RF Must EQ-P01…P10 + EQ-C01…C06 | Cronista | |
| 2026-09-28 | Contratos facial/practice Must; implementación web+api | Atlas / Pulse / Forge | |
| 2026-09-28 | Threat model EQ-P09 | Bastión | `docs/threat-model-eq-p09-facial.md` |
| 2026-09-28 | Refinamiento RF/RNF EQ-P09 + **RNF-F01…F08** (Ley 1581, UX consent, retención/borrado, sin foto) | Cronista / Prisma | Libera parche Atlas; build Cursor hold |
| 2026-09-28 | ADR-002 + contratos alineados a P09.1–P09.9 / RNF-F01…F08 | Atlas | Build Cursor lo libera Nexus; smoke pendiente DATABASE_URL |
| 2026-09-28 | Build Cursor liberado; copy Ley 1581 + needsReconsent/retención en `web/` | Nexus / Pulse | `npm run build` OK |
| 2026-09-28 | API alineada RNF-F: IMAGE_NOT_ALLOWED, reconsent, DELETE enroll, CASCADE, purge:facial | Forge | typecheck OK |
| 2026-09-28 | Hardening residual: rate limit auth/facial, JWT débil rechazado en production, .gitignore .env.* | Bastión | typecheck OK |
| 2026-09-28 | **Gate abierto:** `DATABASE_URL` Cockroach Cloud (Darwin) | Nexus | Bloquea migrate/smoke |
| 2026-09-28 | Migrate + smoke API OK (Cockroach; API `:3001`) | Nexus / Forge | Gate DATABASE_URL cerrado |
| 2026-09-28 | **Gate abierto:** `JWT_SECRET` fuerte (≥32 chars, Darwin) en `api/.env` y luego Render | Bastión / Nexus | Production rechaza secretos débiles; nunca en repo |
| 2026-09-28 | Gate JWT cerrado; local verde API `:3001` + web `:5173` | Nexus | |
| 2026-09-28 | Must UI: PWA, Kahoot sexto, integrity, cert/insignia; proxy `:3001` | Pulse | build OK |
| 2026-09-28 | Must API rev.c: recovery (EQ-P07), reportes PDF/xlsx (EQ-C06), CRUD+auto-completed | Forge | typecheck OK |
| 2026-09-28 | Secrets/email Render: Resend obligatorio en production; env listado | Bastión | |
| 2026-09-28 | Plantilla taller Confluence EQ-P08 en `docs/confluence-eq-p08.md` | Cronista | Pegar a espacio Confluence; evidencias post-deploy |
| 2026-09-28 | **Gate abierto:** Darwin → API key Resend + secretos en Render (`DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `SMTP_FROM`, `CORS_ORIGIN`, `APP_PUBLIC_URL`, …) | Nexus / Bastión | Luego EQ-P07 deploy |
| 2026-09-28 | UI actual = boceto Must (no look final); Darwin rechaza estética plana scaffold. Rediseño gamificado sexto/CFA (energía/progreso/insignias) pendiente elección en Coordinación — solo skin/UX, mismos contratos | Nexus / Darwin | Sin cambio API/ADR; Figma solo si se pide |
| 2026-09-28 | Alcance UI pendiente widget Darwin (Coordinación). Default Nexus: piel gamificada + animaciones = Must; 3D + dashboard métricas rectoría = Nice/Fase 2. Sin 3D hasta elección | Nexus | Mismos contratos; capas UI |
| 2026-09-28 | **DEC UI:** Must primero — piel gamificada sexto/CFA (energía/progreso/insignias, animaciones ligeras, consent Ley 1581). Nice/3D/métricas rectoría **NO** | Darwin / Nexus | Widget Coordinación cerrado; mismos contratos |
| 2026-09-28 | Primera pasada skin Must visible en `http://localhost:5173` (login, tablero, play, insignias, sala docente) | Pulse | `npm run build` OK |
| 2026-09-28 | Must API local cerrado (recovery, reportes, quizzes/integrity, facial, practice); Render hold Resend+secretos | Forge | Smoke conjunto :3001/:5173 disponible |
| 2026-09-28 | Smoke conjunto local **PASS**: API health/forgot/login seed (`:3001`); seguridad facial `IMAGE_NOT_ALLOWED` + `CONSENT_REQUIRED` + policyVersion | Forge / Bastión | Web ConsentCopy/EnrollPage intactos |
| 2026-09-28 | Feedback UI Darwin #1: progress bar fluida (sin jump-reset); paleta energética (no azul admin plano); **cero emojis** (SVG/lucide); calidad visual Must ↑ | Darwin / Nexus | Sin Nice/3D/rectoría |
| 2026-09-28 | Feedback UI Darwin #2 / refs mood: Duolingo · Kahoot · ClassDojo (inspiración, no clone). Logo/mark, assets, mesh/parallax leve, tipografía pro, PWA razonable | Darwin / Nexus | |
| 2026-09-28 | UI Must #2 en `:5173`: tokens violeta/coral/oro, Outfit+Nunito, mesh, `public/brand/eq-mark.svg`, lucide, barra energía continua; PWA ~352 KiB precache | Pulse | build OK; mismos contratos |
| 2026-09-28 | Darwin rechaza UI Must #2 (sigue lejos) → pasada **#3** Must sin Nice. Skin final en hold hasta ancla (refs/moodboards) | Darwin / Nexus | |
| 2026-09-28 | Moodboards Must #3 listos en `http://localhost:5173/moodboards/` — **A · Fuego CFA** (Kahoot coral/oro/índigo); **B · Ruta Verde** (Duolingo/ClassDojo verdes/crema/violeta). Pendiente elección Darwin A/B/mezcla | Pulse | Tokens+hero+login+home; cero emojis; barra fluida |
| 2026-09-28 | **Ancla UI:** moodboard **A · Fuego CFA** (coral/oro/índigo, punch Kahoot) | Darwin / Nexus | B Ruta Verde descartada como ancla |
| 2026-09-28 | Skin final A aplicada en toda `web/` (`:5173`); PWA ~373 KiB; cero emojis; barra fluida; sin Nice/3D | Pulse | Hard refresh; contratos intactos; smokes API/facial previos válidos |
| 2026-09-28 | Darwin rechaza Skin A (iteración previa): tipografía, paleta/contraste, componentes scaffold, barra/feel gamificado, assets/logo/fondos, energía Duo/Kahoot/ClassDojo | Darwin / Nexus | 6 puntos concurrentes; deploy hold |
| 2026-09-28 | Skin A Must rehecha vs 6 puntos; `:5173`; PWA precache **351 KiB**; facial/consent/API intactos; moodboards fuera de `public/` | Pulse | Diff tipografía Outfit+Nunito, tokens saturados, tiles Kahoot, XpStreak, brand/* |
| 2026-09-28 | Export handoff PDF: `docs/export-handoff.md` (visión, Must/Nice, ADRs, inventario, modo Darwin construye / bots review) | Cronista → Marquitos | Sin secretos |
| 2026-09-28 | **STOP build** Equipo Dev: Darwin construye; bots review-only. Export handoff ampliado §1–11 en `docs/export-handoff.md` | Nexus / Cronista | Deploy hold |
| 2026-10-05 | Reescritura a **Ludoteka Campus**: NestJS + React (`apps/`, `packages/`, `db/`), face-api (ADR-007), Cloudinary (ADR-005), Observatorio NL→SQL (ADR-006), Arena con snapshot (ADR-008), reportes con código LK | Darwin | Commits `fad3ebe` a `5c6f4ac` |
| 2026-10-09 | Cambios sin commit: cuentas creadas por el administrador (se quita `/registro`), login con código por correo, passkeys, bloqueo progresivo, módulo legal (Ley 1581), PWA y smoke Playwright | Darwin | Migraciones 0018 y 0019. Duda de alcance D1 (registro) |
| 2026-10-09 | **Documentación viva activada.** Rutina los martes a las 8:52 (hora Colombia): revisa el desfase entre la doc y las decisiones, corrige y publica `CHANGELOG-docs.md` | Cronista | Pedido de Darwin vía Marquitos |
| 2026-10-09 | Primera pasada de doc viva: `RF-RNF.md` con criterios, verificación y estado; `vision.md`, `glosario.md`, `investigacion.md` (nuevo) y `CHANGELOG-docs.md` (nuevo) | Cronista | Ver `CHANGELOG-docs.md` |
| 2026-10-09 | **Taller Confluence EQ-P08 actualizado** (`confluence-eq-p08.md`): todo el enunciado, estado por sección, evidencias con dueño, kiosco C05, revocación facial y checklist Lab Innovación | Cronista / Nexus | Entrega el lunes 12-oct |
| 2026-10-09 | **Captura de voz pasa a Must** como EQ-P11 (la pide el enunciado; commit `1e8e7ec`) | Nexus | Estado: Hecho |
| 2026-10-09 | Seguridad: R1 (clave demo por defecto si falta `SEED_PASSWORD`) y R2 (sin throttler por IP y sin límite en `/auth/forgot`) se declaran como riesgos conocidos | Bastión / Nexus | Antes de la demo: `SEED_PASSWORD` fuerte en Render |
| 2026-10-09 | **Freeze hasta el 15-oct:** solo entra lo que bloquee evidencia del Must | Nexus | |
| 2026-10-09 | **Backlog posterior al 15-oct** (no es Must). **Forge:** healthz con BD, logs JSON y smoke de producción en Ludoteka Campus. **Atlas:** (1) CI con checks antes del deploy; (2) outbox para la revocación facial, con `FACIAL_ENC_KEY` propia y ADR-009; (3) paquete de arquitectura del marketplace de uñas. **Nova:** spike de `VECTOR INDEX` en CockroachDB (Nice) | Nexus / Forge / Atlas / Nova | El marketplace es de otro proyecto; aquí solo se registra |
| 2026-10-09 | **EQ-P05:** el registro de usuarios lo hace el administrador (alta individual o importación por Excel). Cumple si la evidencia muestra el alta y el hash argon2id. `/registro` no vuelve (freeze) | Nexus | Evidencia E1b |
| 2026-10-09 | **R3 (nuevo):** el login exige un código por correo; sin Resend no hay login ni demo. `LAB_OTP_INBOX` reúne los códigos de todas las cuentas `@eduquest.local` (admin incluido). Plan B (dispositivo de confianza o passkey) fuera por el freeze. Resend escalado a Darwin | Nexus / Bastión | En Render: `LAB_OTP_INBOX` vacía o propia de Darwin y `SEED_PASSWORD` fuerte |
| 2026-10-09 | **R2 redefinido:** el login bloquea la cuenta tras 5 fallos. Sigue abierto: no hay límite por IP y `/auth/forgot` no tiene ningún límite | Nexus / Bastión | |
| 2026-10-09 | **Estética oficial:** el campus isométrico construido (temas claro y oscuro). **Fuego CFA queda como iteración pausada** | Nexus / Darwin | Visión y glosario corregidos |
| 2026-10-09 | Revocación facial: la evidencia queda a cargo de QA Lab (ejecuta Speck, coordina Sentinel, lun 12-oct; caso de Forge). Criterio: 0 embeddings y un `facial.delete` en `audit_log` | Nexus | Anexo A de EQ-P08 |
| 2026-10-09 | `contratos-api.md` y `threat-model-eq-p09-facial.md` regenerados desde el código NestJS actual; `arquitectura.md` anota las dos migraciones `0011` | Cronista | Ver `CHANGELOG-docs.md` |
| 2026-10-09 | §13 de `confluence-eq-p08.md` pasa a ser la **lista oficial de evidencias**: E0 (gate de correo en prod) primero, más E12 (ER), E13 (C02) y E14 (revocación, obligatoria). Total: 16 obligatorias + 2 complementarias | Nexus / Sentinel / Cronista | Umbrales faciales de Prisma pendientes de Darwin (el código bloquea tras 5 fallos) |
| 2026-10-09 | **E14 (revocación facial) confirmada como obligatoria:** 16 evidencias obligatorias en total. Para la demo basta con mostrar `facial.delete` | Nexus | |
| 2026-10-09 | **R4:** `JWT_SECRET` aleatorio de 32 bytes o más, no reutilizado. No se rota antes del 15-oct. `FACIAL_ENC_KEY` propia (ADR-009) después del freeze | Nexus / Bastión | Rotar el JWT deja ilegibles las plantillas e invalida las sesiones |
| 2026-10-09 | **Orden obligatorio en Render:** (1) `JWT_SECRET` fuerte, `SEED_PASSWORD` y `LAB_OTP_INBOX`; (2) deploy; (3) registrar los rostros de la demo. No rotar entre el registro y la demo del lunes 12 | Nexus | Anexo B de EQ-P08 |
| 2026-10-09 | **R3:** con `onboarding@resend.dev`, `LAB_OTP_INBOX` debe ser la dirección dueña de la cuenta de Resend, o hay que verificar un dominio en `MAIL_FROM` | Nexus | |
| 2026-10-09 | Riesgos conocidos: abuso de `/auth/forgot` (dentro de R2) y listener de revocación sin reintento (R5). Numeración R1 a R7 unificada entre Confluence y el threat model | Nexus / Cronista | |
| 2026-10-09 | Las dos migraciones `0011` bajan de bloqueo a **verificación** (migrate sobre una base vacía) | Nexus | |
| 2026-10-09 | **R2 cerrado:** `@nestjs/throttler` por IP (300 cada 15 min) y por IP más cuenta o reto (10 cada 5 min) en login, código, `forgot`, `reset`, cambio de clave, facial y passkeys. `helmet` con CSP estricta, HSTS y `Permissions-Policy`. Build sin mapas de código y con ofuscación ligera del código propio. Queda en ADR-009 | Darwin | **Renumeración:** ADR-009 queda para seguridad web; la llave facial propia y el outbox pasan a ADR-011 (futura) |
| 2026-10-09 | ADR-010: cuentas creadas por el administrador, contraseña con código por correo, dispositivos de confianza de 30 días y passkeys. Passkey y facial solo se registran desde una sesión verificada | Darwin | |
| 2026-10-09 | Módulo legal en la web: `/legal/*`, `/aceptar` (el acudiente acepta por el menor; un menor sin acudiente declara que lo acompaña un adulto), descarga de datos y solicitud de eliminación que atiende el administrador. Textos como plantilla para revisión jurídica | Darwin | EQ-A12 |
| 2026-10-09 | Smoke de Playwright en verde en Chromium (Android) y WebKit (iPhone, iPad y Safari Mac), incluida la passkey con un autenticador virtual y sin violaciones de CSP. La falla de `/app/ajustes` del admin quedó resuelta | Darwin | RNF-09 |
| 2026-10-09 | **Deploy del commit `340b047`** (14:22). `LAB_OTP_INBOX` definida en Render. **E0 pasó:** el código de `docente@` llegó desde `abacore.co` y se verificó en prod. Playwright contra prod: 59 pasadas y 0 fallidas en WebKit y Chromium. R6 cerrado | Darwin | En prod, el setup de Playwright solo usa los roles con dispositivo de confianza guardado: así no pide códigos que nadie lee |
