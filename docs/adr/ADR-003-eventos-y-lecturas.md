# ADR-003 — Eventos para lo lateral, SQL de lectura para los tableros

**Estado:** aceptada · 2026-09-28

## Decisión

Gamificación, analítica y notificaciones no ofrecen servicios que el resto llame. Se enteran por el bus interno (`@nestjs/event-emitter`).

Cuando un tablero necesita cruzar notas, XP y eventos de integridad, lee esas tablas con Kysely sin pasar por el servicio dueño. No las actualiza.

## Consecuencias

- Un módulo puede cambiar su servicio sin romper el tablero, siempre que la tabla siga significando lo mismo.
- La reacción al completar una lección (XP, racha, misión) no se escribe dentro de learning.
