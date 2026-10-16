# Registro de cambios

Todos los cambios relevantes de Ludoteka Campus, del más reciente al más antiguo. Cada entrada agrupa los commits de un día y enlaza su hash corto para ubicarlos en el historial (`git show <hash>`).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las secciones usan: **Añadido** (funciones nuevas), **Cambiado** (comportamiento distinto), **Corregido** (errores) y **Documentación**.

## [1.2.0] — 2026-10-16

Clase de octavo con ingreso por QR, diagnóstico y tres juegos de factorización y fracciones algebraicas.

### Añadido
- Sesiones de invitados: el docente o administración abre un grupo (81, 82 u 83), proyecta un QR y el estudiante entra con su nombre, sin cuenta. La etiqueta es «Estudiante (Invitado · Octavo)». La sesión queda guardada al cerrarla.
- Diagnóstico de octavo (un intento) y tres juegos: La fábrica, Dos elementos (parejas, en vivo por socket) y ¿Qué caso es?.
- Tablero del docente con el mejor de la sesión y exportación a Excel de una sesión, varias o un rango de fechas.

### Cambiado
- El arcade anterior, el banco de preguntas y la biblioteca publicados se despublican (migración `0035`). Entran dos guías de octavo con enlace a los DBA del MEN y a OpenStax Intermediate Algebra. Los archivos de Cloudinary no se borran.

## [1.1.0] — 2026-10-15

Ajustes de uso pedidos tras la primera entrega: banco de preguntas, cartelera, usuarios, Laboratorio IA y Mi ruta.

### Añadido
- [`6bb947b`] **Historial en el Laboratorio IA** (migración `0033`). Cada conversación es independiente y la IA le pone un título corto después de la primera respuesta (y lo ajusta en la tercera pregunta). La pestaña **Historial** reabre cualquier conversación; **Nueva conversación** y el botón **+** empiezan una en blanco, y la papelera borra una. La conversación abierta queda en la dirección (`?c=`), así que recargar no la pierde.
- [`6bb947b`] **Editar y eliminar preguntas del banco.** Una pregunta que ya se usó en evaluaciones, salas o la Arena se archiva en lugar de borrarse, para no romper intentos ni notas.
- [`6bb947b`] **Cartelera por grado** (migración `0034`). Un aviso puede ir a un grado completo: llega a estudiantes, acudientes y docentes de todos sus grupos.
- [`6bb947b`] Selector de fecha con calendario y desplegable de hora cada 30 minutos (`DateTimeField`) en la cartelera y las citaciones.
- [`6bb947b`] Cuadro de respuesta que crece hacia abajo (`AutoTextarea`): Enter envía, Shift+Enter baja de línea.

### Cambiado
- [`6bb947b`] **Banco de preguntas más claro.** Muestra un camino en tres pasos con conteos, pestañas Todas / Activas / Borradores, filtro por materia y buscador. Tiene un formulario de pregunta con 2 a 6 opciones y la correcta marcada con un círculo, y una barra fija para armar la evaluación. Al armarla se elige el tipo explicado (Práctica, Examen o En vivo) y el tiempo límite (5 a 90 minutos). Los borradores de IA se piden por materia y en cantidad de 1 a 5.
- [`6bb947b`] **Administración entra a los módulos de gestión:** banco de preguntas, consolidado de notas, archivo de reportes, alertas, asistencia, citaciones, tablero y grupos y cursos. Firmar y emitir comunicados oficiales siguen siendo de Rectoría.
- [`6bb947b`] **Destinatarios de la cartelera:** ya no aparecen materias ni cursos. Los directivos eligen toda la comunidad, grados o roles. El docente elige «Todos mis grupos» o sus grados (con todos los grupos que dicta, aunque sean varios) y puede afinar por grupo.
- [`6bb947b`] **Usuarios en pestañas** con su propia tabla: Estudiantes (grupo, acudientes, menor), Docentes (cursos a cargo), Acudientes (estudiantes a cargo), Coordinación y Rectoría. El filtro por grupo también encuentra a los docentes que dictan en él y a los acudientes de sus estudiantes.
- [`6bb947b`] **Mi ruta:** la respuesta admite 500 caracteres (antes 60) y trae botones para `/ , . −`. Si el estudiante explica su razonamiento, se califica el número que va después de «=» o «la respuesta es», o el último que escriba.
- [`6bb947b`] El tutor quita correos, enlaces y números largos de los mensajes del estudiante antes de enviarlos a la IA (`core/common/redact.ts`, compartido con el Cuaderno).

### Corregido
- [`6bb947b`] Una conversación del tutor solo la puede continuar, abrir o borrar su dueño. Antes, quien conociera el identificador podía escribir en ella.
- [`6bb947b`] El tutor enviaba a la IA los 12 primeros mensajes de la conversación en lugar de los 12 últimos.
- [`6bb947b`] En la biblioteca, la portada ya no se sale de su recuadro ni tapa el texto de la tarjeta.
- [`6bb947b`] La cartelera y las citaciones ya no aceptan fechas inexistentes.

### Documentación
- Manual de usuario (banco, cartelera, usuarios, Laboratorio IA, Mi ruta y edificios de administración), API, datos, frontend, roles y permisos, seguridad, manual técnico, README y PDF regenerados.

## [1.0.0] — 2026-10-13

Primera versión entregable: campus por rol, manuales completos en Markdown y PDF, e imagen Docker.

### Añadido
- [`6871acd`] **Luka y Luna unificados en un solo compañero.** Vive en la esquina inferior derecha de todas las pantallas, sin fondo blanco, flota, sigue el puntero con la mirada y saluda cuando hay pendientes nuevos o cuando el estudiante lleva un rato sin actividad. Al tocarlo habla y ofrece un menú: qué tengo pendiente (con conteo por edificio), cómo funciona esta pantalla, recorrido del campus, preguntarme un tema u Observatorio, orden por voz, leer la página y elegir entre Luka y Luna. Tiene modo silencio. Reemplaza la burbuja grande del inicio y el bloque del inicio en el teléfono.
- [`6871acd`] **Portadas automáticas en la biblioteca** (migración `0032`). Los PDF enlazados desde otros sitios (por ejemplo los DBA del MEN) se dibujan en el servidor a partir de su primera página. Los enlaces web (por ejemplo OpenStax) usan la imagen `og:image` de la página. Ambas portadas se guardan en Cloudinary. Al arrancar, el servidor completa las portadas que falten.
- [`6871acd`] **Manuales en PDF** con el diseño de Ludoteka Campus en `docs/manuales/pdf/`: Manual de Instalación, Manual de Usuario, Manual Técnico, Guía de Arquitectura y Manual de Seguridad. Los genera el equipo con una herramienta local que no forma parte del repositorio.
- [`6871acd`] `CHANGELOG.md`.
- [`6871acd`] Capturas del manual: `MANUAL_ONLY` permite repetir solo algunas sin rehacer las demás.

### Cambiado
- [`6871acd`] El título de la portada y del ingreso ya no habla de roles: «Aprender se siente como explorar un campus» y «Entra a tu campus».
- [`6871acd`] Las capturas del manual se agrupan por sección (`acceso`, `campus`, `cuenta`, `estudiante`, `docente`, `coordinacion`, `rectoria`, `acudiente`, `administracion`).
- [`6871acd`] `Architecture.md` y `Security.md` pasan a `docs/manuales/`.
- [`6871acd`] En las tarjetas de la biblioteca, las etiquetas de tipo y estado bajan a la parte inferior de la portada, con fondo sólido, para no tapar el encabezado del documento.
- [`6871acd`] El libro de Química de OpenStax apunta a la página de lectura en lugar de la ficha del libro.
- La imagen Docker ya no incluye las herramientas locales ni el registro de cambios (`.dockerignore`).

### Documentación
- Documentación al día con el compañero único y las portadas:
  - Frontend explica el compañero.
  - API documenta `thumbnail`.
  - Datos documenta `cover_url` y las tareas al arrancar.
  - Operación explica cómo reintentar una portada.
  - Arquitectura documenta las tareas de inicio de cada módulo.
  - Seguridad documenta las peticiones salientes y suma el riesgo 13: redirecciones y DNS al generar portadas.
  - Los manuales técnico, de instalación y de usuario quedan alineados con lo anterior.
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
