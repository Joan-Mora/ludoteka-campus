# ADR-008 — Arena por equipos: estado en memoria con snapshot en CockroachDB, sin Redis

**Estado:** aceptada · 2026-10-05

## Contexto

La Arena es un juego en vivo por equipos: sala con código QR, capitán rotativo, votos del equipo, candado de respuesta, cronómetro, revelación y podio. Cada toque de un estudiante cambia el estado y debe llegar a todos en menos de un segundo. La solución habitual sería Redis para el estado compartido, pero el despliegue es un solo Web Service en Render y la única base permitida es CockroachDB.

## Decisión

1. **Una sola instancia es dueña de la sala.** El estado vivo (votos, candados, capitanes, cronómetro, pausas) está en memoria del proceso NestJS. Tras cada cambio, cada participante recibe por Socket.IO (`arena:state`) una vista hecha para él: el estudiante solo ve los votos de su propio equipo, la respuesta correcta aparece hasta la revelación y los puntajes se ocultan antes del podio.
2. **Una cola por sala.** Todas las acciones de una sala se encadenan en una promesa por sala, de modo que dos votos simultáneos no se pisan.
3. **Lo que debe sobrevivir va a tablas normalizadas:** equipos, miembros, respuestas bloqueadas (`arena_answers`, únicas por sala, equipo y pregunta) y resultados finales (`arena_results`).
4. **Lo efímero va a un snapshot JSONB** en `arena_rooms.snapshot`:
   - cada cambio de fase se guarda en el momento;
   - los votos se agrupan y se guardan con 1,5 s de retraso;
   - `snapshot_at` indica la frescura.
5. **Recuperación:** al arrancar, la API rehidrata las salas de las últimas 24 h que no estén en `lobby` ni `ended` y reprograma sus cronómetros desde `endsAt`. Un reinicio de Render en plena partida pierde como máximo 1,5 s de votos, nunca una respuesta bloqueada.

## Por qué no Redis

- Un servicio más que pagar, asegurar y documentar, para un colegio con unas pocas salas simultáneas.
- El plan gratuito de Render tiene una sola instancia, así que no hay estado que compartir entre procesos.
- La consistencia de lo que importa (respuestas y puntajes) ya la da CockroachDB con restricciones `UNIQUE` y `CHECK`.

## Consecuencias

- Escalar a varias instancias exigiría fijar cada sala a una instancia o mover el estado vivo a un almacén compartido. Queda anotado como límite conocido.
- El proyector y el moderador pueden recargar la página en cualquier momento: el estado se reconstruye desde memoria o desde el snapshot.
