# EduQuest — Bitácora de decisiones

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
