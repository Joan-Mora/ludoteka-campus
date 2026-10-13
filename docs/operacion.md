# Operación

Cómo se despliega, configura y mantiene Ludoteka Campus en producción.

## Despliegue

Un solo Web Service de Render definido en [`render.yaml`](../render.yaml):

| Campo | Valor |
|---|---|
| Servicio | `ludoteka-campus`, Node 22.14, plan gratuito, región Virginia |
| Build | `npm ci --include=dev && npm run build` (contratos, luego web y luego API) |
| Inicio | `npm start` → `node apps/api/dist/main.js`, escucha en `0.0.0.0:$PORT` |
| Healthcheck | `GET /api/health` (incluye ping a la base) |
| URL | `https://ludoteka-campus.onrender.com` |

Cada push a la rama principal despliega. Al arrancar, la API aplica las migraciones pendientes; si una falla, el despliegue no queda en vivo y Render mantiene la versión anterior.

**Comprobar un despliegue sin entrar al panel:**

1. `GET /api/health` debe responder `{"ok":true,"db":"up"}`.
2. Una ruta nueva protegida debe responder 401, no 404. Un 404 significa que sigue la versión anterior.

**Restricciones del plan gratuito:**

- El servicio se duerme tras 15 minutos sin tráfico y la primera petición tarda en despertarlo.
- El disco es efímero: nada se guarda en archivos locales. Reportes y certificados se generan en la respuesta y los archivos van a Cloudinary.

## Variables de entorno

Plantilla en [`apps/api/.env.example`](../apps/api/.env.example). En local viven en `apps/api/.env` (ignorado por Git); en Render, en **Environment** del servicio. Las marcadas `sync: false` en `render.yaml` se cargan a mano en el panel.

| Variable | Secreta | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a CockroachDB Cloud (`sslmode=verify-full`) |
| `JWT_SECRET` | Sí | Firma de JWT y de códigos por correo; deriva la llave facial si `FACIAL_ENC_KEY` está vacía |
| `JWT_REFRESH_SECRET` | — | No se usa (el refresh es opaco); Render la genera |
| `APP_PUBLIC_URL` | — | URL pública: enlaces de correo, QR de reportes, `rpID` de passkeys y HSTS |
| `CORS_ORIGIN` | — | Orígenes permitidos, separados por coma |
| `AI_API_KEY` | Sí | Clave de Google AI Studio (Gemini). Vacía = todo usa el camino sin IA |
| `AI_BASE_URL` | — | Endpoint compatible con OpenAI |
| `AI_MODEL` | — | Modelo principal (`gemini-3.5-flash-lite`) |
| `AI_MODEL_SMART` | — | Modelo para tareas difíciles (`gemini-3.6-flash`) |
| `AI_FALLBACK_MODELS` | — | Respaldo en orden, separados por coma |
| `AI_EMBED_MODEL`, `AI_EMBED_DIM` | — | Embeddings de la biblioteca (`gemini-embedding-2`, 768). Cambiar la dimensión exige migrar `library_chunks` |
| `CLOUDINARY_URL` | Sí | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
| `RESEND_API_KEY`, `MAIL_FROM` | Sí / — | Envío de correo. Sin clave, el correo queda en `email_outbox` |
| `LAB_OTP_INBOX` | — | Buzón que recibe los códigos de las cuentas `@eduquest.local` |
| `FACIAL_ENC_KEY` | Sí | Llave AES de las plantillas faciales. Debe ser igual en todos los entornos que comparten la base |
| `FACIAL_MAX_DISTANCE`, `FACIAL_POLICY_VERSION`, `FACIAL_LOCK_ATTEMPTS`, `FACIAL_LOCK_MINUTES`, `FACIAL_RETENTION_DAYS` | — | Umbral, versión de política, bloqueo y retención del acceso facial |
| `INTEGRITY_SUSPEND_AFTER` | — | Violaciones antes de suspender un examen (3) |
| `SEED_PASSWORD` | Sí | Clave de las cuentas de laboratorio al sembrar una base vacía |

El entorno local apunta a la **misma base de producción**. Cualquier script que se corra en local (`migrate`, `seed`, `library:seed`) modifica producción.

## Tareas de mantenimiento

### Cambiar el modelo de IA

1. En Render → `ludoteka-campus` → **Environment**, edita `AI_MODEL`, `AI_MODEL_SMART` o `AI_FALLBACK_MODELS`.
2. Guarda: Render reinicia el servicio con el valor nuevo.
3. Actualiza también `render.yaml`, `apps/api/.env.example` y el valor por defecto en `apps/api/src/core/config/env.ts` para que el repositorio diga lo mismo.

Si la variable no existe en Render, se usa el valor por defecto de `env.ts`. Los modelos de Gemini 3.5 o superiores no reciben `temperature`: `AiService` lo omite solo.

### Rotar secretos

Se rota un secreto cuando se expone (aparece en un registro, una captura o un chat) o cuando alguien con acceso deja el proyecto. Nunca se pega el valor en issues, commits ni conversaciones.

| Secreto | Dónde se genera | Efecto de rotarlo |
|---|---|---|
| `CLOUDINARY_URL` | Cloudinary → Settings → API Keys → generar una clave nueva | Ninguno para los archivos existentes; las subidas usan la clave nueva |
| `AI_API_KEY` | Google AI Studio → API keys | Ninguno |
| `RESEND_API_KEY` | Resend → API Keys | Ninguno |
| Clave de `DATABASE_URL` | CockroachDB Cloud → SQL Users → cambiar contraseña | Hay que actualizar local y Render a la vez |
| `JWT_SECRET` | Cadena aleatoria larga | Cierra todas las sesiones e invalida los códigos pendientes. **Si `FACIAL_ENC_KEY` está vacía, vuelve ilegibles las plantillas faciales** |

**Pasos para Cloudinary** (aplican igual a las demás claves de servicios externos):

1. En la consola de Cloudinary, crea una clave nueva. Quedan dos activas mientras cambias.
2. Arma la URL nueva `cloudinary://<API_KEY nueva>:<API_SECRET nuevo>@<CLOUD_NAME>`.
3. Reemplaza `CLOUDINARY_URL` en `apps/api/.env` y en Render → Environment. Guarda: Render reinicia.
4. Prueba subir un archivo a la biblioteca.
5. Desactiva y borra la clave vieja en Cloudinary.

**Antes de rotar `JWT_SECRET`:** si `FACIAL_ENC_KEY` está vacía, primero define `FACIAL_ENC_KEY` con el valor **actual** de `JWT_SECRET` en todos los entornos y despliega. Así la llave facial deja de depender del JWT.

### Biblioteca y embeddings

`npm run library:seed -w @eduquest/api` (o `npm run library:seed` desde `apps/api`):

- Carga la biblioteca del manifiesto `db/seeds/library/manifest.json`: 60 guías propias en PDF por grado y materia, con glosario y lección en el curso demo, más 9 documentos abiertos con fuente y licencia.
- Es idempotente: reconoce lo ya publicado y reintenta lo fallido.
- Al final rellena los vectores (`embedding`) que falten, en lotes de 64. Si Gemini responde 429 espera 60 s y lo intenta hasta 6 veces; si la cuota no vuelve, termina y basta correrlo otro día.
- Requiere `CLOUDINARY_URL` y `AI_API_KEY`. Con `-- --dry` solo informa qué haría.

**Portadas.** Los PDF subidos a Cloudinary muestran su primera página directamente. Para los demás recursos, la API genera la portada y la guarda en Cloudinary y en `library_items.cover_url`:

- PDF alojados en otro sitio: dibuja la primera página en el servidor.
- Enlaces web: toma la imagen `og:image` de la página (solo sitios `https` públicos).

Las portadas que faltan se generan al arrancar, hasta 25 por arranque. Si un recurso queda sin portada (`cover_url = ''`), se puede volver a intentar con `UPDATE library_items SET cover_url = NULL WHERE id = '…'` y reiniciando el servicio.

Mientras falten vectores, la búsqueda por texto sigue funcionando; la búsqueda semántica mejora cuando se completan. Para ver cuántos faltan:

```sql
SELECT count(*) FILTER (WHERE embedding IS NULL) AS sin_vector, count(*) AS total FROM library_chunks;
```

### Migraciones

- Se aplican solas al arrancar. Para aplicarlas a mano: `npm run migrate`.
- Un archivo nuevo en `db/migrations` con el siguiente número; nunca se edita uno ya aplicado. Reglas de CockroachDB en [Modelo de datos](datos.md#migraciones).
- No hay migraciones de reversa. Para deshacer, se escribe otra migración.

### Contenido demo

`npm run seed` rehace el curso demo de Matemáticas 6.° (borra ese curso y sus preguntas `MAT6-%`). No toca usuarios ni otros cursos.

### Cuentas y accesos

- Las cuentas las crea el administrador en `/app/admin/usuarios`, una a una o con la plantilla de Excel; reciben una clave temporal por correo.
- Desde la misma pantalla se reenvía el acceso, se fuerza un cambio de clave o se cierran todas las sesiones de una persona.
- Una cuenta bloqueada por intentos se libera sola (máximo 60 minutos) o con un restablecimiento de clave.

## Monitoreo

| Qué | Dónde |
|---|---|
| Estado y base | `GET /api/health` |
| Registros de la API | Render → Logs. Los errores 500 dejan el mensaje sin traza en la respuesta y el detalle en el registro |
| Correos enviados | Tabla `email_outbox` (estado `sent` o `logged`) |
| Uso de IA | Tabla `ai_usage` por función y modelo |
| Auditoría | Tabla `audit_log` (ingresos, bloqueos, reuso de sesión, cambios de cuentas) |
| Consultas del Observatorio | Tabla `nl_queries` |

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El despliegue falla al arrancar | Migración con error o variable obligatoria faltante (`DATABASE_URL`, `JWT_SECRET`) | Leer el registro de Render; corregir con una migración nueva |
| La primera carga tarda medio minuto | El servicio estaba dormido (plan gratuito) | Esperado |
| El tutor, el Cuaderno o Mi ruta responden con contenido local en vez de IA | Cuota de Gemini agotada (429) o `AI_API_KEY` vacía | Revisar la cuota en Google AI Studio; todo sigue funcionando con el camino local |
| «Este navegador ya tiene abierta la sesión de …» | Hay otra cuenta con sesión en ese navegador | Cerrar sesión en esa cuenta y volver a entrar |
| «Por seguridad cerramos tu sesión en todos los dispositivos» | Se presentó un refresh ya usado (pestaña vieja o robo de cookie) | Volver a entrar; queda `session.reuse_detected` en la auditoría |
| No llegan los códigos de ingreso | `RESEND_API_KEY` vacía o dominio no verificado en Resend | Revisar `email_outbox`; para cuentas `@eduquest.local`, revisar `LAB_OTP_INBOX` |
| Las passkeys fallan en un dominio nuevo | El dominio no coincide con `APP_PUBLIC_URL` o `CORS_ORIGIN` | Ajustar ambas variables al dominio real |
| Acceso facial no reconoce a nadie tras un cambio de variables | Cambió `FACIAL_ENC_KEY` o `JWT_SECRET` (si la primera está vacía) | Restaurar la llave anterior; si se perdió, cada usuario debe registrar su rostro de nuevo |
| Subir a la biblioteca falla | `CLOUDINARY_URL` vacía o con una clave revocada | Revisar la variable en Render |
