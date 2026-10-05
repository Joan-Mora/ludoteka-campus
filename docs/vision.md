# EduQuest — Visión

**Producto:** EduQuest, el aula virtual gamificada del Colegio Francisco Arango  
**Cliente institucional:** Colegio Francisco Arango (CFA)  
**Origen:** voluntariado de Tecnología en Desarrollo de Software + parcial de Gestión y Operación de BD  
**Fecha:** 2026-09-28

## Problema

El colegio necesita un entorno propio para enseñar, practicar y evaluar. Las apps genéricas de quiz no conocen los grupos, no dejan constancia del recorrido de cada estudiante, no dan herramientas al docente para publicar un temario y no sostienen la integridad cuando la evaluación es en el aula. El parcial universitario, en paralelo, exige una aplicación web real sobre CockroachDB, con autenticación, recuperación por correo, reportes, reconocimiento facial, una IA de dominio y un despliegue público.

## Qué es EduQuest

EduQuest es el aula del colegio: cada grupo tiene cursos, cada curso tiene unidades y lecciones, y el estudiante avanza por un mapa de aventura. La práctica suma XP, insignias y rachas. La evaluación puede ser tranquila (práctica), formal (examen con kiosco) o en vivo (sesión tipo aula). El docente publica, califica y ve la integridad. Coordinación y Rectoría miran el tablero del colegio. El certificado se verifica con un código público.

La gamificación acompaña el aprendizaje. No lo reemplaza.

## Pilares

| Pilar | Qué resuelve |
|-------|----------------|
| Identidad | Cuentas, roles, recuperación y acceso facial con consentimiento |
| Institución | Año lectivo, periodos, grados, grupos, materias, matrículas y asignación docente |
| Aula | Cursos, unidades, lecciones, recursos, tareas, anuncios y calendario |
| Evaluación | Banco por materia y grado, práctica, examen y sesión en vivo |
| Integridad | Kiosco, eventos y suspensión, visibles para el docente |
| Gamificación | XP, niveles, insignias, rachas, misiones, ligas y minijuegos de refuerzo |
| Tutor | Pistas de matemáticas acotadas al temario, fuera del examen |
| Analítica y certificación | Tableros, reportes y certificados verificables |

## Roles

`admin`, `directivo`, `teacher`, `student`. El rol `guardian` (acudiente) existe en el modelo para el consentimiento de menores; su interfaz queda para una fase posterior.

## Alcance de contenido

El modelo admite varios grados y varias materias. El contenido sembrado del primer aula es **Matemáticas de sexto**. Los demás grados quedan creados para que la institución crezca sin cambiar el esquema.

## Lo que esta versión no pretende

Proctoring forense, huella dactilar, firma criptográfica del rector, app nativa y una segunda base de datos. El facial es un modelo de laboratorio en el dispositivo, con contraseña siempre disponible, y no se activa para menores sin consentimiento del acudiente.

## Relación con el parcial

Una sola aplicación cumple el aula del colegio y la rúbrica: CockroachDB, CRUD, auth con hash y roles, recuperación por correo, PDF y Excel, facial, IA de dominio, URL pública y documentación.
