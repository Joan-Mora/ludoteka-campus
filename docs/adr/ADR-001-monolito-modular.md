# ADR-001 — Monolito modular en un solo servicio

**Estado:** aceptada · 2026-09-28

## Contexto

EduQuest tiene que desplegarse en Render (un proceso, filesystem efímero) y hablar con CockroachDB Cloud. El equipo es pequeño y el producto necesita varios dominios (aula, evaluación, juego, analítica) sin convertirlos en servicios independientes.

## Decisión

Un solo repositorio npm workspaces. NestJS es el proceso único: API, WebSockets y estáticos de la PWA. React se construye con Vite y se sirve desde el mismo host. Los módulos de negocio no se referencian entre sí salvo por `public-api.ts` o por eventos.

## Consecuencias

- Un `render.yaml`, un healthcheck, un `DATABASE_URL`.
- El acoplamiento ilegal se detecta con dependency-cruiser, no con revisión manual.
- Escalar a varios servicios, si algún día hace falta, parte de los mismos límites de módulo.
