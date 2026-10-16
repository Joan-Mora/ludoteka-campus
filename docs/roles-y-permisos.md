# Roles y permisos

Hay seis roles, definidos en `packages/contracts` (`ROLES`). Cada cuenta tiene exactamente uno (`user_roles`).

| Clave | Nombre en la app | Grupo |
|---|---|---|
| `student` | Estudiante | — |
| `teacher` | Docente | — |
| `coordinator` | Coordinación | Supervisión (`isOversight`) y dirección (`isBoard`) |
| `rector` | Rectoría | Supervisión y dirección |
| `guardian` | Acudiente | — |
| `admin` | Administración | Dirección |

## Dónde se exige

| Capa | Mecanismo | Archivo |
|---|---|---|
| API, por ruta | `@Roles(...)` con `RolesGuard` global; sin `@Roles` basta con sesión | `apps/api/src/core/auth/guards.ts` |
| API, por dato | Filtros por relación en cada servicio (docente–curso, acudiente–hijo, estudiante–matrícula) | Ver [Seguridad](manuales/Security.md#autorización) |
| Web, menú y rutas | `ROUTE_ROLES` derivado del mapa de cada rol; `RoleRoute` muestra «Esta sección no es para tu rol» | `apps/web/src/app/nav.ts`, `apps/web/src/shared/buildings.ts` |
| Pruebas | `routesByRole` y `forbiddenByRole` recorren lo permitido y lo prohibido de cada rol | `apps/web/e2e/accounts.ts` |

La web solo esconde. Cualquier regla nueva se pone primero en la API.

## Campus de cada rol

Cada rol tiene su propio mapa: solo sus edificios, agrupados en distritos. El menú lateral, la barra del teléfono (Inicio más los tres primeros edificios) y el router salen de esta tabla (`MAPS` en `buildings.ts`).

| Rol | Distritos y edificios (ruta) |
|---|---|
| Estudiante | **Mi día:** Mis cursos `/app/cursos`, Mi ruta `/app/ruta`, Cuaderno `/app/cuaderno` · **A mi manera:** Mi espacio `/app/aprender`, Laboratorio IA `/app/tutor` · **Jugar:** Sala en vivo `/app/en-vivo`, Arena `/app/arena`, Arcade `/app/jugar`, Sala de trofeos `/app/logros` · **Colegio:** Biblioteca `/app/biblioteca`, Cartelera `/app/novedades` |
| Docente | **Enseñar:** Mis cursos, Planilla de notas `/app/calificaciones`, Banco de preguntas `/app/banco` · **En clase:** Sesiones de invitados `/app/clase`, Sala en vivo, Arena · **Comunicación:** Mensajes `/app/mensajes`, Cartelera · **Recursos:** Biblioteca, Observatorio `/app/consultas` |
| Coordinación | **Seguimiento:** Alertas `/app/coordinacion`, Asistencia `/app/coordinacion/asistencia`, Citaciones `/app/coordinacion/citaciones` · **Académico:** Grupos y cursos `/app/cursos`, Consolidado de notas `/app/calificaciones`, Observatorio · **Comunicación:** Mensajes, Cartelera, Biblioteca |
| Rectoría | **Dirección:** Tablero `/app/rectoria`, Sala de firmas `/app/rectoria/firmas`, Archivo de reportes `/app/rectoria/reportes` · **Datos:** Observatorio · **Comunicación:** Mensajes, Cartelera, Biblioteca |
| Acudiente | **Familia:** Mis hijos `/app/acudiente`, Mensajes · **Colegio:** Cartelera, Biblioteca |
| Administración | **Administración:** Usuarios `/app/admin/usuarios`, Institución `/app/admin`, Grupos y cursos `/app/cursos` · **Académico:** Banco de preguntas `/app/banco`, Consolidado de notas `/app/calificaciones`, Archivo de reportes `/app/rectoria/reportes` · **Seguimiento:** Alertas, Asistencia, Citaciones · **Datos:** Tablero `/app/rectoria`, Observatorio · **Comunicación:** Mensajes, Cartelera, Biblioteca |

Todos los roles tienen además Inicio (`/app`), Notificaciones, Ajustes y Acceso facial.

**Páginas internas** (se abren desde un edificio):

| Ruta | Roles |
|---|---|
| `cursos/:id` | Estudiante, docente, coordinación, rectoría, administración |
| `lecciones/:id` | Estudiante, docente, coordinación, administración |
| `cursos/:id/aula` | Docente, coordinación, rectoría, administración |
| `arena/:id` | Estudiante, docente |
| `integridad/:id` | Docente, coordinación, administración |
| `reportes/:id` | Docente, coordinación, rectoría, administración |
| `rectoria/comunicados` | Rectoría |

**El inicio cambia por rol:** estudiante y docente ven su semana (clases, pendientes, actividad). Coordinación, rectoría, acudiente y administración ven su campus con lo pendiente de cada edificio; el acudiente ve además una tarjeta por hijo.

## Qué puede hacer cada rol

**Estudiante**
- Ve los cursos publicados de su grupo, completa lecciones, entrega tareas y presenta prácticas y exámenes.
- Juega Sala en vivo, Arena y Arcade; estudia con Mi ruta, Cuaderno, Mi espacio y el tutor IA. Si es menor, el tutor necesita la autorización del acudiente.
- Participa en los foros de sus cursos; consulta la biblioteca y la cartelera.

**Docente**
- Crea y publica contenido solo en sus cursos: unidades, lecciones, tareas y anuncios.
- Arma el banco de preguntas y las evaluaciones; conduce la sala en vivo y la Arena.
- Califica con categorías ponderadas, rúbricas y asistencia. Recibe alertas de riesgo y de integridad.
- Escribe a los acudientes de sus estudiantes y a sus colegas. Sube archivos a la biblioteca. En el Observatorio, solo ve sus grupos.

**Coordinación**
- Atiende las alertas de riesgo de todos los grupos con bitácora, consolida la asistencia y cita a acudientes (aviso y correo).
- Ve cursos y notas en solo lectura y modera foros.
- Gestiona vínculos de acudientes y el consentimiento facial de menores.

**Rectoría**
- Tablero institucional por periodo; firma o rechaza certificados y boletines.
- Publica comunicados oficiales en la cartelera; consulta el archivo de reportes y el Observatorio.

**Acudiente**
- Ve a cada hijo vinculado: lo que viene, notas, asistencia y alertas.
- Responde citaciones, escribe a los docentes y recibe un resumen semanal por correo.
- Acepta los documentos legales por el menor y autoriza o revoca el acceso facial, el tutor IA y el tratamiento de datos.

**Administración**
- Gestiona la estructura académica (años, grados, grupos, materias, matrículas y carga docente).
- Crea cuentas una a una o por Excel, reenvía accesos, fuerza cambios de clave y cierra sesiones.
- Resuelve solicitudes de datos personales. También puede crear contenido académico.
- Entra a todos los módulos de gestión: banco de preguntas (puede editar o archivar cualquier pregunta), consolidado de notas, alertas, asistencia, citaciones, tablero y archivo de reportes. En Rectoría ve los indicadores y los reportes; firmar y emitir comunicados oficiales siguen siendo de Rectoría.
- Ve las cuentas en pestañas por rol (Estudiantes, Docentes, Acudientes, Coordinación, Rectoría).

En el banco de preguntas, un docente modifica las preguntas que creó y las de las materias que dicta; las demás las ve en modo lectura.

Solo docentes y administración escriben contenido académico. Coordinación y rectoría leen cursos y notas, pero cualquier escritura responde `403 READ_ONLY`.

## Cuentas de laboratorio

Se crean al sembrar una base vacía, con la clave de `SEED_PASSWORD`. Todas usan el dominio `@eduquest.local`, que no tiene buzón: sus códigos llegan a `LAB_OTP_INBOX`.

| Correo | Rol |
|---|---|
| `admin@eduquest.local` | Administración |
| `rectoria@eduquest.local` | Rectoría |
| `coordinacion@eduquest.local` | Coordinación |
| `docente@eduquest.local` | Docente |
| `estudiante@eduquest.local` | Estudiante |
| `estudiante2@eduquest.local` | Estudiante (menor de edad) |
| `acudiente@eduquest.local` | Acudiente de ambos estudiantes |
