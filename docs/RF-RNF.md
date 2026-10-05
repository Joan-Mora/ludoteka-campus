# EduQuest — RF / RNF (v2 aula virtual)

**Producto:** EduQuest · Colegio Francisco Arango  
**Fecha:** 2026-09-28

El aula virtual es el producto. Los identificadores EQ-P y EQ-C se conservan porque son la rúbrica del parcial y del colegio; ahora viven dentro del aula, no como un quiz suelto.

## RF — Parcial

| ID | Requisito | Dónde queda |
|----|-----------|-------------|
| EQ-P01 | URL pública, sin ngrok | `render.yaml`, Web Service único |
| EQ-P02 | CockroachDB como única BD | `DATABASE_URL`, ADR-004 |
| EQ-P03 | ER, PK/FK, restricciones | `docs/er.md`, `db/migrations/` |
| EQ-P04 | CRUD e integridad | institución, aula, banco, tareas |
| EQ-P05 | Registro, login, logout, hash | identity, argon2id |
| EQ-P06 | Roles y rutas protegidas | `admin`, `directivo`, `teacher`, `student`, `guardian` |
| EQ-P07 | Recuperación por correo | Resend + `email_outbox` |
| EQ-P08 | Confluence | `docs/confluence-eq-p08.md` |
| EQ-P09 | Facial on-device | biometrics, ADR-002 |
| EQ-P10 | IA de dominio | tutor de práctica, recomendaciones, borradores de preguntas; bloqueado en examen |

## RF — Colegio

| ID | Requisito | Dónde queda |
|----|-----------|-------------|
| EQ-C01 | PWA | `manifest` + service worker (vite-plugin-pwa) |
| EQ-C02 | Evaluación en aula, timer y puntos | assessment + sesiones en vivo |
| EQ-C03 | Banco de matemáticas de sexto | semilla en `db/seeds/` |
| EQ-C04 | Roles alineados a P06 | los mismos |
| EQ-C05 | Kiosco anti-fraude | integrity |
| EQ-C06 | Certificado PDF + insignia + verificación | certification |

## RF — Aula (producto nuevo)

| ID | Requisito |
|----|-----------|
| EQ-A01 | Año, periodo, grado, grupo, materia, matrícula y asignación docente |
| EQ-A02 | Curso con unidades, lecciones, recursos y progreso |
| EQ-A03 | Tareas con entrega y calificación |
| EQ-A04 | Anuncios y calendario del curso |
| EQ-A05 | Mapa de avance del estudiante |
| EQ-A06 | XP, nivel, insignias, racha, misiones y liga del grupo |
| EQ-A07 | Dos minijuegos de refuerzo (carrera numérica y fracciones) |
| EQ-A08 | Tablero del docente y tablero de Rectoría |
| EQ-A09 | Al menos cuatro reportes PDF/Excel con título, fecha, datos de la BD e identificador |

## RNF

| ID | Criterio |
|----|----------|
| RNF-01 | Monolito modular `apps/api` + `apps/web` + `packages/contracts` + `db/` |
| RNF-02 | Render + Cockroach Cloud con SSL |
| RNF-03 | Secretos solo en entorno. El `.env` no entra al repositorio |
| RNF-04 | `GET /api/health` hace ping a la BD |
| RNF-05 | Branding EduQuest / Colegio Francisco Arango |
| RNF-06 | Migraciones SQL en el repo |
| RNF-07 | Dependencias entre módulos verificadas con dependency-cruiser |
| RNF-F01…F08 | Igual que ADR-002: sin foto, consentimiento, retención, fallback de contraseña, login 1:1, sin vectores en logs, copy de Ley 1581, modelo de laboratorio documentado |

## Fuera de esta versión

Huella, liveness forense, firma criptográfica del rector, app nativa, voz, multi-colegio, interfaz del acudiente.
