# Changelog de documentación

> Última revisión: 2026-10-09 · Responsable: Cronista
> Documentación viva: cada martes a las 8:52 (hora Colombia) se compara la doc con las decisiones recientes y con el repo. Si hay desfase, se corrige y se agrega una entrada aquí.

## 2026-10-09 (quinta ronda)

**Por qué:** cierre del plan de multiplataforma, cuentas, voz, legal y seguridad.

| Archivo | Cambio |
|---|---|
| `adr/ADR-009-seguridad-web.md` | Nuevo: encabezados y CSP, throttler, código del cliente y `npm audit` |
| `adr/ADR-010-cuentas-y-autenticacion.md` | Nuevo: cuentas del administrador, código por correo, dispositivos de confianza, passkeys y sesión verificada |
| `RF-RNF.md` | RNF-08 pasa a Hecho (R2 cerrado). Nuevos RNF-12 (encabezados) y RNF-13 (código del cliente). EQ-P03 al día con `er.md`. EQ-A12 con el flujo de `/aceptar`. Sale el throttler del backlog Nice |
| `confluence-eq-p08.md` | §9 con los controles nuevos, R2 cerrado y el plan B de login disponible. §4 con el ER al día. E11 sin la falla de Ajustes. Guion de seguridad con el `429`, la CSP y la aceptación legal |
| `threat-model-eq-p09-facial.md` | R2 cerrado. La llave facial propia y el outbox pasan a ADR-011 (futura) |
| `glosario.md` | Throttler y CSP. R2 cerrado |
| `arquitectura.md` | `core/security`, flujo de ingreso, seguridad web y compatibilidad |
| `bitacora.md` | Cinco filas: R2 cerrado y renumeración de ADR, ADR-010, módulo legal, Playwright en verde y deploy con E0 |
| `confluence-eq-p08.md`, `RF-RNF.md`, `threat-model-eq-p09-facial.md` | Después del deploy del commit `340b047`: R6 cerrado, E0 y E7 con evidencia (faltan las capturas), RNF-11 hecho para el código de ingreso, RNF-09 con la corrida contra prod y sin menciones a "sin commit" |

## 2026-10-09 (cuarta ronda)

| Archivo | Cambio |
|---|---|
| `confluence-eq-p08.md` | E14 confirmada como obligatoria (16). §9: R4 (`JWT_SECRET` fuerte, sin rotar antes del 15-oct), R5 (listener sin reintento) y R6 (código en prod). R3 con la regla de `onboarding@resend.dev`. Anexo B con el orden obligatorio 1-2-3 en Render (variables → deploy → rostros) y la advertencia de rotación. Migrate de las `0011` como verificación. §4 al día con `er.md` |
| `threat-model-eq-p09-facial.md` | R3, R4 y R5 actualizados con las decisiones del 9-oct. Numeración R1 a R7 unificada con Confluence |
| `arquitectura.md` | Las migraciones `0011` pasan de bloqueo a verificación |
| `bitacora.md` | Seis filas con las decisiones de Nexus de esta ronda |

## 2026-10-09 (tercera ronda)

| Archivo | Cambio |
|---|---|
| `er.md` | Agregadas las 9 tablas de 0018 (`login_challenges`, `trusted_devices`, `webauthn_credentials`, `webauthn_challenges`, `account_imports`) y 0019 (`user_preferences`, `legal_documents`, `legal_acceptances`, `data_requests`), transcritas del SQL del repo con atributos, PK, FK, constraints, índices y relaciones. También las columnas nuevas de `users` y `refresh_tokens`. Nuevos el índice y las relaciones en el diagrama. Indicadores: 98 tablas, 159 FK, 147 CHECK y 52 UNIQUE (los de 0018 y 0019 contados desde el SQL; se confirman con el catálogo de prod en E9). Desbloquea la parte documental de E12 |

## 2026-10-09 (segunda ronda)

**Por qué:** decisiones de Nexus y del equipo del 9-oct (registro, riesgos R2 y R3, estética, backlog, QA Lab) y pedido de regenerar contratos y threat model desde el código NestJS actual.

| Archivo (`Proyectos\EduQuest\docs\`) | Cambio |
|---|---|
| `contratos-api.md` | **Regenerado** desde `apps/api` (con los cambios del 9-oct): auth con OTP, passkey y dispositivo de confianza, cuentas del administrador, acudientes, facial, voz (sin endpoints), reportes, legal, Socket.IO, eventos y códigos de error. Lo no confirmado está marcado **no verificado** |
| `threat-model-eq-p09-facial.md` | **Regenerado** (no estaba en el disco): face-api y ADR-007, STRIDE, revocación por `guardian.facial_revoked` con DELETE explícito, R1 a R5 y pendientes de verificación |
| `RF-RNF.md` | EQ-P05 pasa a Hecho con un criterio nuevo (alta por el administrador + hash). RNF-08 redefinido (R2). RNF-11 nuevo (correo y R3). Plan B de login al backlog |
| `confluence-eq-p08.md` | Evidencia E1b (alta y hash), R2 y R3 nuevos (R4 = código sin commit), sin plan B de login, Anexo A a cargo de QA Lab, Anexo B con el migrate sobre una base vacía (el total de evidencias se recalcula en la fila de §13) |
| `vision.md`, `glosario.md` | Estética oficial = campus isométrico; Fuego CFA pausada. Glosario: `LAB_OTP_INBOX`, R1 a R3, QA Lab, outbox |
| `arquitectura.md` | Nota sobre las dos migraciones `0011` y el análisis de `migrate.ts` |
| `bitacora.md` | Decisiones del 9-oct y backlog posterior al 15-oct de Forge, Atlas y Nova |
| `confluence-eq-p08.md` §13 | **Lista oficial de evidencias**, alineada con el cruce de QA Lab (Sentinel). Nuevas: E0 (gate de correo en prod), E12 (ER, P03), E13 (evaluación con timer, C02) y E14 (revocación, obligatoria). E7 con el commit desplegado, E9 con `SELECT version()`, E11 con el riesgo de admin en `/app/ajustes` y E2 con el bloqueo tras 5 fallos y los umbrales de Prisma pendientes. Total: 0/16 + 0/2 |

## 2026-10-09 (primera ronda)

**Por qué:** pedido de documentación viva (Darwin vía Marquitos) y orden de Nexus para el taller de Confluence EQ-P08, con entrega el lunes 12-oct. Desde el 28-sep el repo cambió de fondo: el 5-oct Darwin lo reescribió como **Ludoteka Campus** (NestJS + React, `apps/`, `packages/`, `db/`) y el 9-oct agregó cuentas por administrador, código por correo, passkeys y el módulo legal (sin commit). La API pública está en línea (`/api/health` con `db:"up"`).

| Archivo (`Proyectos\EduQuest\docs\`) | Cambio |
|---|---|
| `RF-RNF.md` | Reescrito. Cada EQ-P01 a P11, EQ-C01 a C06, EQ-A01 a A12, RNF-01 a 10 y RNF-F01 a F09 tiene criterio de aceptación, verificación y estado. **EQ-P11 Captura de voz** pasa a Must. Se agregaron "Nice después del 15-oct" y "Fuera de alcance: el sistema NO debe" |
| `vision.md` | Problema, objetivo, para qué, roles y estado al 9-oct. Nombre provisional Ludoteka Campus |
| `glosario.md` | Ampliado a unos 70 términos agrupados (plataforma, identidad, facial, aula, IA) |
| `investigacion.md` | **Nuevo.** Referencias competitivas (Kahoot, Wayground, Proctorizer, Klarway) y técnicas (Cockroach, Render, MediaPipe, Ley 1581), con la decisión que sale de cada una |
| `confluence-eq-p08.md` | Reescrito con todo el enunciado. Tabla de estado por sección, reportes, facial, voz, kiosco C05, seguridad con riesgos R1 a R3, 14 evidencias con dueño, entregables, Anexo A (revocación facial) y Anexo B (checklist Lab Innovación). **Se quitó la clave demo que estaba escrita en texto plano** |
| `arquitectura.md` | Encabezado, módulo `legal`, migraciones hasta 0019 y la sección "Cambios del 2026-10-09" |
| `er.md` | Encabezado y nota de las 9 tablas de 0018 y 0019 que faltan |
| `bitacora.md` | Restaurada en `docs/` (no estaba en el disco) con el histórico del 28-sep y las filas del 9-oct |
| `CHANGELOG-docs.md` | **Nuevo** (este archivo) |

**Estados que cambiaron frente al 28-sep:**

- Deploy: pasó de *hold* a *en línea*.
- Facial: pasó del modelo geométrico a face-api (ADR-007).
- Registro público: pasó de *Hecho* a *Parcial*; las cuentas ahora las crea el administrador.
- Voz: pasó de Nice a Must (EQ-P11, Hecho).
- Límite de intentos: ahora hay bloqueo por cuenta, pero no throttler por IP ni límite en recuperación.
