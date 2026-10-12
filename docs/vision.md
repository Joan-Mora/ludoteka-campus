# Ludoteka Campus — Visión

> Última revisión: 2026-10-11 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest). La carpeta sigue siendo `Proyectos\EduQuest`.

**Cliente institucional:** Colegio Francisco Arango (CFA)
**Origen:** voluntariado de Tecnología en Desarrollo de Software y parcial de Gestión y Operación de BD (dual-track)
**Repositorio:** `ludoteka-campus` (GitHub; Darwin confirma la visibilidad)

## Problema

El colegio no tiene un aula propia. Las apps genéricas de quiz no conocen los grupos, no guardan el recorrido de cada estudiante y no avisan a tiempo cuando alguien va mal. Tampoco sostienen un examen en el aula frente a la copia. Docentes y coordinación llevan notas, asistencia y reportes en hojas de cálculo. Además, el parcial universitario exige una app web real sobre CockroachDB con autenticación, recuperación por correo, reportes PDF/Excel, reconocimiento facial, IA de dominio, captura de voz y despliegue público.

## Objetivo

Que una sola aplicación sea el campus virtual del CFA (MVP de Matemáticas de sexto) y cumpla toda la rúbrica del parcial, con evidencia demostrable en producción.

## Para qué

- **Estudiante:** aprende y practica en un campus gamificado (XP, rachas, Arena) con un tutor que cita las guías y no le da la respuesta en el examen.
- **Docente:** publica, evalúa con integridad (kiosco), califica con rúbricas y recibe alertas de riesgo.
- **Coordinación:** atiende las alertas de riesgo de todos los grupos con una bitácora, consolida la asistencia y cita a los acudientes.
- **Rectoría:** mira el tablero estratégico por periodo, firma certificados y boletines, y publica comunicados oficiales.
- **Acudiente:** sigue a cada hijo (lo que viene, notas, asistencia, alertas), responde citaciones, escribe a los docentes, recibe un resumen semanal y autoriza o revoca el facial del menor.
- **Universidad:** evidencia de diseño de BD distribuida, seguridad, IA y deploy.

## Usuarios y roles

Desde Ludoteka 2 (11-oct) el antiguo rol `directivo` se separó en `coordinator` y `rector` (migraciones `0020_roles_a` a `0020_roles_c`). Solo el docente y la administración escriben contenido académico; los demás roles consultan según su función.

| Rol | Código |
|-----|--------|
| Administrador | `admin` |
| Coordinación | `coordinator` |
| Rectoría | `rector` |
| Docente | `teacher` |
| Estudiante | `student` |
| Acudiente | `guardian` |

### Matriz de responsabilidades

L = lee, E = escribe, M = modera, F = firma, — = sin acceso (la web muestra «Esta sección no es para tu rol» y la API responde 403).

| Función | Estudiante | Docente | Coordinación | Rectoría | Acudiente | Admin |
|---|---|---|---|---|---|---|
| Cursos, lecciones y tareas | L y entrega | E | L | L | — | E |
| Calificaciones, asistencia y rúbricas | — | E (sus cursos) | L | L | L (sus hijos, en Familia) | E |
| Alertas de riesgo | — | E (sus cursos) | E (todas, con bitácora) | L (agregadas) | L (sus hijos) | E |
| Citaciones a acudientes | — | — | E | — | Responde | E |
| Banco de preguntas y sala en vivo | Juega en vivo | E | — | — | — | E |
| Observatorio y reportes | — | L | L | L | Boletín de sus hijos | L |
| Certificados y boletines oficiales | Descarga | Pide | Pide boletín | F | Descarga | Pide |
| Cartelera | L | E | E | E y comunicado oficial | L | E |
| Foros por curso | E | E y M | L y M | L | — | E y M |
| Mensajes acudiente–docente | — | E | — | — | E | — |
| Usuarios, grupos y vínculos | — | — | Vínculos de acudientes | — | — | E |

## Estado al 2026-10-09

| Frente | Estado |
|--------|--------|
| Registro de usuarios | Lo hace el administrador (alta individual o importación por Excel). Cumple EQ-P05; no hay autoregistro (freeze) |
| Producto | Reescrito el 5-oct como Ludoteka Campus: monolito modular NestJS + React sobre CockroachDB (ADR-001 a ADR-008). El Must funciona en local |
| Cambios del 9-oct (sin commit) | Cuentas creadas por el administrador (se quitó el registro público), login con código por correo, passkeys, dispositivos de confianza, bloqueo progresivo, módulo legal (Ley 1581), preferencias, PWA con íconos y smoke E2E con Playwright |
| Deploy | Web Service en Render con CockroachDB Cloud: `GET /api/health` responde `db:"up"`. Falta confirmar que producción corre el último código (los cambios del 9-oct no están en Git). Riesgo R3: sin Resend no hay login |
| UI | **Estética oficial:** el campus isométrico construido (Luka o Luna, temas claro y oscuro). Decisión del 9-oct. Fuego CFA (28-sep) queda como iteración pausada en la bitácora |
| Evidencias | 0/11 en Confluence (ver `confluence-eq-p08.md`) |
| Equipo | **Darwin construye.** Los bots solo revisan y documentan. Freeze hasta el 15-oct: solo entra lo que bloquee evidencia del Must |

## Qué no pretende esta versión

Proctoring forense, huella, firma criptográfica del rector (la firma es una aprobación registrada en la BD y en `audit_log`, no un certificado digital), app nativa, multi-colegio, otra base que no sea CockroachDB, ni rostros reales de menores en la demo.

## Documentos relacionados

`RF-RNF.md` · `arquitectura.md` · `er.md` · `adr/` · `glosario.md` · `investigacion.md` · `confluence-eq-p08.md` · `bitacora.md` · `CHANGELOG-docs.md`
