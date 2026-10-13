# Registro de cambios

Todos los cambios relevantes de Ludoteka Campus, del más reciente al más antiguo. Cada entrada agrupa los commits de un día y enlaza su hash corto para ubicarlos en el historial (`git show <hash>`).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las secciones usan: **Añadido** (funciones nuevas), **Cambiado** (comportamiento distinto), **Corregido** (errores) y **Documentación**.

## [1.0.0] — 2026-10-13

Primera versión entregable: campus por rol, manuales completos en Markdown y PDF, e imagen Docker.

### Añadido
- **Luka y Luna unificados en un solo compañero.** Vive en la esquina inferior derecha de todas las pantallas, sin fondo blanco, flota, sigue el puntero con la mirada y saluda cuando hay pendientes nuevos o cuando el estudiante lleva un rato sin actividad. Al tocarlo habla y ofrece un menú: qué tengo pendiente (con conteo por edificio), cómo funciona esta pantalla, recorrido del campus, preguntarme un tema u Observatorio, orden por voz, leer la página y elegir entre Luka y Luna. Tiene modo silencio. Reemplaza la burbuja grande del inicio y el bloque del inicio en el teléfono.
- **Portadas automáticas en la biblioteca** (migración `0032`). Los PDF enlazados desde otros sitios (por ejemplo los DBA del MEN) se dibujan en el servidor a partir de su primera página. Los enlaces web (por ejemplo OpenStax) usan la imagen `og:image` de la página. Ambas portadas se guardan en Cloudinary. Al arrancar, el servidor completa las portadas que falten.
- **Manuales en PDF** con el diseño de Ludoteka Campus en `docs/manuales/pdf/`: Manual de Instalación, Manual de Usuario, Manual Técnico, Guía de Arquitectura y Manual de Seguridad. Se generan con `npm run docs:pdf`.
- `CHANGELOG.md`.

### Cambiado
- El título de la portada y del ingreso ya no habla de roles: «Aprender se siente como explorar un campus» y «Entra a tu campus».
- Las capturas del manual se agrupan por sección (`acceso`, `campus`, `cuenta`, `estudiante`, `docente`, `coordinacion`, `rectoria`, `acudiente`, `administracion`).
- `Architecture.md` y `Security.md` pasan a `docs/manuales/`.
- En las tarjetas de la biblioteca, las etiquetas de tipo y estado bajan a la parte inferior de la portada para no tapar el encabezado del documento.
- El libro de Química de OpenStax apunta a la página de lectura en lugar de la ficha del libro.

### Documentación
- [`0a076a5`] Manual de usuario con capturas reales por rol, manual técnico, manual de instalación, `Dockerfile` y `docker-compose` (con CockroachDB local opcional) y créditos del equipo.
- [`8324654`] Documentación técnica actualizada: arquitectura, seguridad, datos, API, frontend, roles y permisos, operación y desarrollo.

### Corregido
- [`8324654`] Un mismo navegador ya puede recordar varias cuentas de confianza sin que una expulse a la otra.
- [`8324654`] El acudiente, el rector y el administrador ya no reciben la lista completa de cursos; cada rol recibe solo lo que le corresponde.

## 2026-10-12 — Fase 5: el campus es la app

### Añadido
- [`7f09d5a`] Un campus por rol con módulos estrictos: cada rol ve solo sus edificios y su mapa.
- [`7f09d5a`] Sala en vivo que crea y conduce el docente (código, preguntas, resultados).
- [`7f09d5a`] Mensajes entre el personal con nombre y rol.
- [`7f09d5a`] Luka como guía persistente con recorrido del campus.
- [`7f09d5a`] Oferta de Windows Hello (passkey) después de ingresar con código.
- [`7c782f4`] Mini mapa con «Estás aquí», fachadas por material, entrada a los edificios con View Transitions y jerarquía de radios.
- [`7329ab1`] Biblioteca sembrada por grado.
- [`7329ab1`] Foros con reacciones, menciones, adjuntos, XP por mejor respuesta y resumen de Luka.

## 2026-10-11 — Fases 1 a 4

### Añadido
- [`c2c0a6c`] Arcade con puntajes verificados en el servidor, sala de trofeos, notificaciones que llevan a su destino y comandos de voz.
- [`c5a9b04`] Perfil de aprendizaje, Mi espacio y sendero visual de Mi ruta.
- [`a501008`] Roles separados de coordinación y rectoría.
- [`a501008`] Mesa de seguimiento y citaciones para coordinación.
- [`a501008`] Tablero y firmas para rectoría.
- [`a501008`] Mensajes y resumen semanal para la familia.
- [`a501008`] Rutas por rol.
- [`a132355`] Layout fluido desde teléfono hasta TV, barra lateral con tema, sin zoom por pellizco, edificios estables y voces curadas.
- [`655ccdc`] Gemini 3.6 Flash como modelo razonador; sin parámetros de muestreo en Gemini 3.5 o superior.
- [`655ccdc`] Skill de diseño de interfaz.

### Documentación
- [`2714e3b`] README profesional y licencia.

## 2026-10-09 — Cuentas, seguridad y correos

### Añadido
- [`340b047`] Cuentas institucionales, passkeys, Ajustes, documentos legales, cabeceras de seguridad web y compatibilidad con Safari e iOS.
- [`8ce66cf`] Landing con tema claro y oscuro real.
- [`8ce66cf`] Correos de Resend con el diseño de Ludoteka Campus (código, recuperación y bienvenida).
- [`d872356`] Correos con el arte del campus embebido (CID) y barra de desplazamiento con la marca.

### Corregido
- [`0347e52`] Barra de desplazamiento sin flechas en Chrome y Safari.
- [`ee68c14`] Se quita `baseUrl` del `tsconfig` web (obsoleto en TypeScript 6).

### Documentación
- [`7ce84f2`] Evidencia de producción (despliegue de `340b047`, código por Resend, Playwright contra producción).
- [`7ce84f2`] Configuración e2e sin pedir códigos innecesarios.

## 2026-10-05 — De EduQuest a Ludoteka Campus

### Añadido
- [`fad3ebe`] EduQuest pasa a llamarse Ludoteka Campus; el acceso facial se reconstruye sobre descriptores de face-api.
- [`5d03c11`] Todos los reportes llevan número y cualquiera puede verificarlos con un código QR.
- [`69bd02d`] La app abre en un campus isométrico con Luka como compañero de voz.
- [`1e8e7ec`] Los estudiantes pueden dictar, escuchar y navegar por voz.
- [`94ba631`] Acudientes y coordinación.
- [`94ba631`] Cartelera con audiencia y acuses de lectura.
- [`94ba631`] Foros por curso.
- [`21657a4`] Biblioteca con Cloudinary, búsqueda híbrida y tutor RAG con citas (migración `0011`).
- [`a9f85d8`] Mi ruta adaptativa con verificación en el servidor (`0013`).
- [`a9f85d8`] Observatorio de lenguaje natural a SQL de solo lectura (`0017`).
- [`0550f40`] Arena por equipos: salas con QR, capitán rotativo, candados, fases, modo proyector, podio y recuperación desde snapshot (`0015`).
- [`5281750`] Cuaderno: resumen con IA, flashcards SM-2, metas y modo enfoque.
- [`5281750`] Libro de calificaciones ponderado con asistencia, rúbricas, alertas de riesgo y reporte.

### Documentación
- [`5c6f4ac`] Modelo entidad-relación por módulo.
- [`5c6f4ac`] Páginas de Confluence con rúbrica y guion.
- [`5c6f4ac`] ADR-005 a ADR-008.

## 2026-09-28 — Punto de partida

- [`eb9053f`] Copia recuperable de EduQuest antes del rediseño hacia el aula virtual.

[1.0.0]: https://github.com/Joan-Mora/ludoteka-campus/commits/main
