# Glosario

> Última revisión: 2026-10-09 · Responsable: Cronista
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest).

## Producto y proceso

| Término | Significado |
|---------|-------------|
| CFA | Colegio Francisco Arango, el cliente institucional |
| Dual-track | Una sola app sirve a dos pistas: **A** (colegio y rectoría) y **B** (parcial de Gestión y Operación de BD) |
| Must / Nice | Must es lo que exige la rúbrica del parcial o el MVP de sexto. Nice va después del 15-oct |
| EQ-P / EQ-C / EQ-A | IDs de requisitos: P = parcial, C = colegio, A = aula. Ver `RF-RNF.md` |
| RNF-F | Requisitos no funcionales del facial (Ley 1581) |
| Freeze | Hasta el 15-oct solo entra lo que bloquee evidencia del Must |
| Fuego CFA | Iteración visual del 28-sep (coral, oro e índigo, tono Kahoot), **pausada**. La estética oficial es el campus isométrico (decisión del 9-oct) |
| Campus isométrico | Estética oficial de la app: campus en vista isométrica, un edificio por módulo, Luka o Luna como guía, temas claro y oscuro |
| Modo revisión | Desde el 28-sep Darwin construye y los bots solo revisan y documentan |
| Gate | Punto que se libera con una acción de Darwin (secreto, aprobación o evidencia) |
| R1 / R2 / R3 | Riesgos declarados: clave demo por defecto, límites de intentos (R2, cerrado el 9-oct con ADR-009) y dependencia del correo para el login (ver `threat-model-eq-p09-facial.md`) |
| QA Lab | Equipo de pruebas (Speck ejecuta, Sentinel coordina) que corre las evidencias de verificación |
| Outbox | Patrón para garantizar efectos tras un commit (propuesto para la revocación facial, ADR-011 futura) |

## Plataforma y despliegue

| Término | Significado |
|---------|-------------|
| Cockroach Cloud | CockroachDB gestionado, la única base permitida. Se conecta por el protocolo de Postgres con SSL (`DATABASE_URL`) |
| Render | PaaS donde corre el Web Service `ludoteka-campus` (`render.yaml`). Plan gratuito: se duerme tras 15 min sin uso |
| Resend | Proveedor de correo: recuperación de contraseña y código de ingreso. Sin clave, el correo queda en `email_outbox` |
| `LAB_OTP_INBOX` | Buzón que recibe los códigos de **todas** las cuentas `@eduquest.local`, admin incluido. En Render debe quedar vacía o apuntar a un buzón que solo controle Darwin (R3) |
| Cloudinary | Almacén de archivos de la biblioteca (ADR-005) |
| DBA | Derechos Básicos de Aprendizaje del Ministerio de Educación Nacional: lo que se espera que aprenda cada grado. Cada guía de la biblioteca indica cuáles trabaja |
| Manifiesto de la biblioteca | `db/seeds/library/manifest.json`: materias, docentes demo, las 60 guías (grado, materia, DBA, focos) y los documentos abiertos con su fuente y licencia. Lo lee `npm run library:seed` |
| Curso demo | Curso por grado y materia creado por la siembra (`courses.is_demo`), a cargo de un docente demo deshabilitado. Reparte las guías por curso y se lista después de los cursos reales |
| Fuente y licencia | Procedencia de un recurso (`source_name`, `source_url`, `license`). Los DBA del MEN se indexan desde su sitio oficial sin copiarlos; los libros de OpenStax son CC BY 4.0 |
| Mejor respuesta | Respuesta del foro marcada por el autor del tema o por quien modera. Si es de un estudiante y la marca otra persona, suma 20 XP una sola vez y cuenta para la insignia «Respuesta estrella» |
| Mención | `@Nombre completo` en una respuesta del foro, elegido en el autocompletado entre las personas del curso. Avisa a la persona nombrada (`forum_mentions`) |
| Resumen del hilo | Síntesis que Luka o Luna hace de un tema del foro para quien modera: ideas principales, dudas sin resolver y quién podría necesitar apoyo. La IA solo ve seudónimos y el servidor pone los nombres después |
| `schema_migrations` | Tabla que registra qué migraciones SQL se aplicaron |
| `/api/health` | Healthcheck público. Hace ping a la base |
| `SEED_PASSWORD` | Variable con la clave de las cuentas demo. En Render debe ser fuerte; nunca se escribe su valor en docs |

## Identidad y seguridad

| Término | Significado |
|---------|-------------|
| argon2id | Algoritmo de hash de contraseñas |
| OTP / código de ingreso | Código de 6 dígitos por correo tras la contraseña. Vence en 10 min, admite 5 intentos (`login_challenges`) |
| Dispositivo de confianza | Cookie `HttpOnly` de 30 días que salta el código (`trusted_devices`) |
| Passkey | Credencial WebAuthn (Touch ID, Windows Hello…) en `webauthn_credentials` |
| Refresh rotativo | Token opaco en cookie que se renueva en cada uso. Si se reutiliza uno viejo, se cierra toda la familia de sesiones |
| `ACCOUNT_LOCKED` | Bloqueo progresivo por cuenta tras 5 contraseñas fallidas |
| Throttler | Límite de peticiones por ventana (`@nestjs/throttler`) en las rutas de autenticación: 300 por IP cada 15 min y 10 por IP más cuenta cada 5 min. Responde `429 TOO_MANY_REQUESTS` (ADR-009) |
| CSP | *Content Security Policy*: encabezado que le dice al navegador de dónde puede cargar scripts, estilos, imágenes y conexiones. La de Ludoteka solo permite scripts propios (ADR-009) |
| `audit_log` | Registro de acciones sensibles (`facial.delete`, `password.reset`, `login`…) |
| Habeas data | Derecho a conocer, exportar o borrar los datos. Se pide en `data_requests` |
| `legal_documents` | Términos, privacidad y cookies versionados. Una versión nueva exige aceptarla otra vez |

## Facial

| Término | Significado |
|---------|-------------|
| Embedding / descriptor facial | Vector de 128 números que calcula face-api en el navegador. Se guarda cifrado (AES-256-GCM) en `face_templates` |
| `modelId` | Identificador del modelo que generó el descriptor. Si cambia, la plantilla vieja no sirve y el usuario se registra de nuevo |
| `policyVersion` | Versión vigente de la política biométrica (`FACIAL_POLICY_VERSION`) |
| `needsReconsent` | Bandera que indica que el usuario aceptó una versión vieja de la política y debe aceptar la nueva |
| Prueba de vida | Gesto aleatorio (parpadear o girar) exigido antes de tomar las muestras |
| `face_attempts` | Auditoría de intentos faciales: modo, éxito, motivo, distancia, IP y hash del correo. Nunca el vector |
| `IMAGE_NOT_ALLOWED` | Error 400 si llega una foto a la API |
| `FACE_LOCKED` | Error 423 tras 5 fallos faciales (15 min) |
| `AMBIGUOUS` | El rostro se parece a dos cuentas. Se pide el correo |
| `guardian.facial_revoked` | Evento: el acudiente revoca la autorización y se borra la plantilla del menor |

## Aula, evaluación y juego

| Término | Significado |
|---------|-------------|
| Acudiente | Rol `guardian`. Sigue a sus hijos (`guardian_links`), recibe alertas y autoriza el facial de un menor |
| Alerta de riesgo | Fila de `risk_alerts`: nota baja, inasistencia, integridad o inactividad, con nivel `media` o `alta` |
| Arena | Juego en vivo por equipos con capitán rotativo, votos, candado de respuesta y podio |
| Campus | Pantalla de inicio isométrica: cada edificio abre un módulo |
| Capitán | Miembro del equipo que bloquea la respuesta en la Arena. Rota en cada pregunta |
| Cartelera | Novedades con audiencia, fijado, programación y confirmación de lectura |
| Código LK | Consecutivo `LK-AAAA-NNNNNN` de cada reporte, guardado en `report_log` y verificable en `/verificar-reporte/<código>` |
| Coordinación | Rol `coordinator`. Mesa de seguimiento de alertas con bitácora, asistencia consolidada, citaciones a acudientes y moderación de foros. Consulta notas sin editarlas |
| Rectoría | Rol `rector`. Tablero estratégico por periodo, firma de certificados y boletines, y comunicados oficiales |
| Citación | Reunión que coordinación agenda con los acudientes de un estudiante (`meetings`). Llega como aviso y correo, y el acudiente responde «Asistiré» o «No puedo» |
| Bitácora de alerta | Notas de seguimiento de una alerta (`risk_alert_notes`). Anotar una alerta abierta la pasa a «en seguimiento» |
| `pending_signature` | Estado de un certificado (`certificates.status`) o boletín (`bulletin_signatures`) que espera la firma de rectoría. Solo los certificados firmados se verifican públicamente |
| Comunicado oficial | Novedad de la cartelera marcada `official` por rectoría; se muestra con sello dorado |
| Resumen semanal | Correo de los viernes al acudiente con lo que viene, notas, faltas y alertas de cada hijo (`user_preferences.weekly_digest`) |
| Mensajes | Conversación privada acudiente–docente sobre un estudiante (`guardian_messages`) |
| Cuaderno | Apuntes con resumen IA, tarjetas de repaso, metas y sesiones de enfoque |
| Estación | Unidad del mapa de un curso |
| Kiosco | Examen en pantalla completa que registra salida, pérdida de foco, pestaña oculta y Esc |
| `KIOSK_ACTIVE` | Error 403 del tutor cuando el estudiante tiene un examen o sala en vivo activos |
| `integrity_events` | Una fila por evento de kiosco (`fullscreen_exit`, `visibility_hidden`, `blur`, `escape`) |
| `attempt_flags` | Contador de violaciones por intento. Al llegar a `INTEGRITY_SUSPEND_AFTER` el intento se suspende |
| Liga | Ranking semanal de XP del grupo (`leaderboard_snapshots`) |
| Libro de calificaciones | Notas ponderadas 1.0 a 5.0, asistencia y rúbricas |
| Libro de XP | Tabla `xp_ledger`. El total se suma; no hay contador editable |
| Luka / Luna | Compañero del campus (a elección del usuario) que sugiere la siguiente actividad |
| Maestría | Nivel de 1 a 10 por estudiante y tema (`topic_mastery`) |
| Mi ruta | Retos adaptativos dibujados como un sendero: una parada por tema con anillo de nivel, estrellas y corona. El servidor verifica la respuesta que propone la IA |
| Mi espacio | Página del estudiante (`/app/aprender`) con seis formas de aprender un tema. La recomendada por su perfil va primero con «Para ti», pero puede abrir cualquiera |
| Perfil de aprendizaje | Resultado del cuestionario «Descubre cómo aprendes» (12 preguntas) en `learning_profiles`: método principal, secundario y puntajes. Se repite una vez por periodo o al cambiar la versión del cuestionario |
| Métodos | `teoria`, `ejemplos`, `juegos`, `practica`, `visual` y `conversacion`. Cambian la redacción de los retos y del tutor, nunca la dificultad. Al tutor no se le envían datos personales |
| Estrellas | Hitos de dominio por tema: una al nivel 4, dos al 7 y tres al 10 |
| Reto jefe | Reto único dos niveles por encima del actual. Se desbloquea al nivel 4; si se acierta sube un nivel y suma una corona, si se falla no baja |
| Manipulativo | Ayuda interactiva por tipo de ejercicio (barra de fracciones, cuadrícula de porcentaje, triángulo, tabla de valor posicional…) que se arma con los mismos parámetros del reto |
| Arcade | Diez minijuegos ligados a temas (`arcade_games`). Cada partida vive en `arcade_sessions`: el servidor genera las preguntas, guarda las respuestas y califica. Da hasta 40 XP por partida, con un tope de 150 XP al día |
| Reto del día | Un juego del Arcade igual para todo el colegio cada día, de nivel 4 y una sola partida. Suma 15 XP extra si hay al menos un acierto y tiene su propio ranking |
| Insignia por niveles | Insignia con umbrales de bronce, plata y oro (`badges.thresholds`). El nivel y el progreso de cada estudiante quedan en `user_achievements` |
| Insignia oculta | No muestra nombre ni condición hasta ganarla |
| Insignia de temporada | Se gana de nuevo en cada periodo académico (`user_achievements.season` = id del periodo). Las de temporadas pasadas quedan en la sala de trofeos |
| Pendientes del campus | Número rojo de cada edificio: lo que el usuario tiene por hacer allí según su rol (`GET /campus`). Al tocarlo se abre la lista con «Ir» para cada elemento |
| Tipo de notificación | `notifications.kind` (aviso, cartelera, foro, logro, integridad, seguimiento, citación, mensaje, firma, certificado). Con `link` la notificación lleva al lugar exacto |
| «Qué puedo decir» | Panel del micrófono que lista los comandos de voz según el rol. Cada frase se puede tocar para probarla |
| Snapshot | Estado efímero de una sala de Arena en `arena_rooms.snapshot` para sobrevivir a un reinicio |
| `groups_class` | Tabla del grupo (evita la palabra reservada `GROUP`) |

## IA y datos

| Término | Significado |
|---------|-------------|
| Observatorio | Preguntas en español convertidas a SQL de solo lectura sobre las vistas `v_*` (ADR-006) |
| `ludoteka_reader` | Rol de base de datos con `SELECT` solo sobre `v_*` |
| RAG | Recuperación de fragmentos (`library_chunks`) para que el tutor responda con citas |
| `ai_usage` | Registro de cada llamada a IA (funcionalidad y modelo, sin contenido) |
| SM-2 | Algoritmo de repaso espaciado de las tarjetas |
| VECTOR INDEX | Índice vectorial de CockroachDB. Spike Nice después del 15-oct |
| Captura de voz | Dictado (Web Speech API), comandos de navegación y lectura en voz alta (EQ-P11). Comandos con texto libre: «busca en la biblioteca …», «empieza un reto de …» y «pregúntale a Luka …»; además, «qué tengo pendiente» y «léeme la lección» |
