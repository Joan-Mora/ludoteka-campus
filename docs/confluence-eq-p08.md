# EduQuest — plantilla Confluence (EQ-P08)

Copiar cada bloque a una página del espacio del equipo. Las evidencias (capturas o video) se pegan después del deploy.

## 1. Problema

El Colegio Francisco Arango no tiene un aula propia: las apps de quiz no conocen los grupos, no guardan el recorrido y no sostienen un examen frente a la copia. En paralelo, el parcial exige una aplicación web sobre CockroachDB, con autenticación, recuperación por correo, reportes, facial, IA y URL pública.

## 2. Solución

EduQuest es el aula virtual del colegio. Cada grupo tiene cursos, unidades y lecciones. El estudiante avanza por un mapa, entrega tareas, practica con un tutor y presenta exámenes en kiosco. El docente publica y ve la integridad. Rectoría mira matrícula y reportes. El certificado se verifica con un código.

## 3. Arquitectura

Monolito modular. NestJS sirve `/api`, `/socket.io` y el build de la PWA. React (Vite) en desarrollo usa proxy. Una sola base: CockroachDB Cloud por el wire de Postgres y SSL. Ver `docs/arquitectura.md` y ADR-001.

## 4. Base de datos

Modelo en `docs/er.md`. SQL en `db/migrations`. Semilla de Matemáticas de sexto en `db/seeds/001_contenido.sql`. PK UUID, FK con integridad, un intento activo por evaluación.

## 5. IA

Tutor de práctica acotado al temario. No entrega la respuesta final. Si hay un examen activo responde `403 KIOSK_ACTIVE`. También redacta borradores de preguntas (quedan inactivos hasta que el docente los revise) y recomendaciones para quien va bajo 60%. Adaptador compatible con la API de chat de OpenAI (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Sin clave, las pistas salen del texto de la lección y se declaran como tales.

## 6. Seguridad

Contraseñas con argon2id. JWT corto y refresh opaco en cookie HttpOnly. Roles `admin`, `directivo`, `teacher`, `student`, `guardian`. Facial: solo vector calculado en el dispositivo, consentimiento Ley 1581, sin foto, contraseña siempre disponible, menores bloqueados hasta consentimiento del acudiente. Ver ADR-002.

## 7. Demo

1. Entrar como `estudiante@eduquest.local`.
2. Abrir Matemáticas 6° y completar una lección (XP y mapa).
3. Entregar la bitácora.
4. Hacer la práctica o el examen (el examen pide pantalla completa).
5. Entrar como `docente@eduquest.local`, calificar y mirar integridad.
6. Descargar boletín PDF, resultados Excel e integridad PDF.
7. Emitir certificado y abrirlo en `/verificar/EQ-...`.
8. Mostrar login facial o, si la cámara falla, el fallback de contraseña.
9. Mostrar el tutor y el corte durante un examen activo.

## 8. Deploy

Web Service único en Render (`render.yaml`). Healthcheck `GET /api/health`. `DATABASE_URL` y `JWT_SECRET` solo en el entorno. La base no es Render Postgres.

URL: _pegar aquí cuando el servicio esté publicado._

## Evidencias

- [ ] Login con contraseña
- [ ] Login facial o intento con fallback visible
- [ ] Recuperación de contraseña
- [ ] Tutor
- [ ] CRUD de institución o de curso
- [ ] PDF y Excel
- [ ] Aplicación en la URL pública
