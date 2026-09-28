# ADR-001 — Monolito modular PWA + API + Cockroach + Render

**Estado:** Aceptado  
**Fecha:** 2026-09-28  
**Decisores:** Atlas; mandato Nexus/Mercado

## Contexto

Dual-track (colegio + parcial BD) en ~17 días. Cockroach obligatorio; Render no hospeda Cockroach.

## Decisión

- `web/` PWA + `api/` Express modular en la misma raíz.
- BD: **Cockroach Cloud** vía `DATABASE_URL` (Postgres wire + SSL).
- App: **Render** (web service API ± static web).
- Prohibido Render Postgres como BD principal del parcial.

## Consecuencias

Forge implementa módulos y SQL; Pulse PWA/kiosco; Bastión secretos/CORS/hash; facial fuera del Must hasta ADR-002.
