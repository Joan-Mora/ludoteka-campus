# Ludoteka Campus — Visión

> Última revisión: 2026-10-09 · Responsable: Cronista
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
- **Coordinación y rectoría:** ven indicadores, consultan en lenguaje natural (Observatorio) y descargan reportes numerados y verificables.
- **Acudiente:** sigue el avance y las alertas, y autoriza o revoca el facial del menor.
- **Universidad:** evidencia de diseño de BD distribuida, seguridad, IA y deploy.

## Usuarios y roles

| Rol | Código |
|-----|--------|
| Administrador | `admin` |
| Coordinación y rectoría | `directivo` |
| Docente | `teacher` |
| Estudiante | `student` |
| Acudiente | `guardian` |

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

Proctoring forense, huella, firma criptográfica del rector, app nativa, multi-colegio, otra base que no sea CockroachDB, ni rostros reales de menores en la demo.

## Documentos relacionados

`RF-RNF.md` · `arquitectura.md` · `er.md` · `adr/` · `glosario.md` · `investigacion.md` · `confluence-eq-p08.md` · `bitacora.md` · `CHANGELOG-docs.md`
