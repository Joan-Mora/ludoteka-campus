# Threat model — EQ-P09 acceso facial (y autenticación relacionada)

> Última revisión: 2026-10-09 · Responsable: Cronista (con insumos de Bastión, Atlas y Forge)
> **Nombre:** Ludoteka Campus (nombre pendiente de confirmar por Darwin; antes EduQuest).
> **Fuente:** código de `apps/api` y `packages/contracts` en 2Klair (incluidos los cambios sin commit del 9-oct), ADR-002 y ADR-007. Reemplaza al threat model del 28-sep, que trataba el modelo geométrico y la API Express.
> Lo que no se pudo confirmar en el código está marcado como **no verificado**.

## 1. Alcance y activos

| Activo | Dónde vive | Sensibilidad |
|---|---|---|
| Descriptor facial (128 floats, promedio de 3 a 10 muestras) | `face_templates` (`ciphertext`, `iv`, `tag`, `model_id`, `samples`, `spread`). PK y FK a `users` con `ON DELETE CASCADE` | Dato biométrico sensible (Ley 1581) |
| Llave de cifrado | `FACIAL_ENC_KEY`. Si no está definida, se deriva de `facial:${JWT_SECRET}` (SHA-256) | Secreto |
| Consentimiento | Versión de la política del usuario; `users.guardian_consent_at`; `guardian_authorizations` | Prueba legal |
| Intentos | `face_attempts` (modo, éxito, motivo, distancia, IP y hash del correo; sin vector) | Auditoría |
| Sesión resultante | JWT de 20 min y refresh `eq_refresh` (método `facial`) | Acceso a la cuenta |

## 2. Diseño (ADR-002 y ADR-007)

1. **Captura en el dispositivo:** `@vladmandic/face-api` (TinyFaceDetector, 68 landmarks y FaceRecognitionNet; `modelId = face-api-resnet34-128`). Los pesos se sirven desde `/models`. Al servidor solo llegan descriptores.
2. **Prueba de vida:** `POST /facial/challenge` (público) entrega un reto (`blink`, `turn_left` o `turn_right`) de un solo uso y con vencimiento. Se guarda en memoria del proceso: un reinicio lo invalida y no se comparte entre instancias.
3. **Registro:** exige sesión verificada (`otp`, `trusted_device` o `passkey`; si no, `403 STEP_UP_REQUIRED`), el consentimiento vigente y, para un menor, la autorización del acudiente. Se rechaza si las muestras son poco consistentes (`QUALITY`). La plantilla se cifra con AES-256-GCM y AAD. Queda `audit_log` `facial.enroll`.
4. **Login:** 1:1 con correo o 1:N sin correo (si dos cuentas quedan cerca, `AMBIGUOUS`). Distancia euclidiana con umbral `FACIAL_MAX_DISTANCE` (0,5). Si hay coincidencia, se emite la sesión directamente, **sin código por correo**.
5. **Bloqueo:** con `FACIAL_LOCK_ATTEMPTS` (5) fallos, el acceso facial de la cuenta o de la IP se bloquea por `FACIAL_LOCK_MINUTES` (15) → `423 FACE_LOCKED`.
6. **Borrado:**
   - El usuario: `DELETE /facial/enroll` → `audit_log` `facial.delete`.
   - El acudiente (ver §4).
   - La retención: `FACIAL_RETENTION_DAYS` (0 = sin purga). El disparador de `purgeExpired()` (cron o arranque): **no verificado**.
   - Borrar la cuenta → `CASCADE`.

## 3. Amenazas (STRIDE resumido)

| # | Amenaza | Control actual | Riesgo residual |
|---|---|---|---|
| T1 | Suplantación con una foto impresa o en pantalla | Prueba de vida por gesto aleatorio y umbral de distancia | **Medio:** un video o una animación puede pasar el gesto. Se declara como control de laboratorio (ADR-007) |
| T2 | Fuerza bruta con muchos descriptores contra una cuenta | Bloqueo por cuenta y por IP (5 fallos por 15 min). Cada intento necesita un reto nuevo | Bajo-medio: un atacante que rote IPs en modo 1:N tiene solo el límite por IP. Si existe un límite global: **no verificado** |
| T3 | Envío de imágenes al servidor (minimización) | `rejectImageFields`: claves `image`, `photo`, `selfie`, `picture`, `blob`, `dataurl`, `data_url`, `frame`, `jpeg`, `png` o `base64` → `400 IMAGE_NOT_ALLOWED`. El esquema zod exige arrays de 128 números | Bajo |
| T4 | Robo de la base de datos | Plantilla cifrada con AES-256-GCM; sin la llave no sirve ni para comparar | **Medio:** sin `FACIAL_ENC_KEY` propia, la llave depende de `JWT_SECRET`. `render.yaml` no declara `FACIAL_ENC_KEY`; si está en Render: **no verificado** |
| T5 | Rotar `JWT_SECRET` sin `FACIAL_ENC_KEY` | — | Todas las plantillas quedan ilegibles (disponibilidad). Backlog de Atlas: llave propia más ADR-011 (futura; ADR-009 quedó para seguridad web) |
| T6 | Fuga de vectores en logs | `face_attempts` sin vector. El filtro global solo registra el mensaje del error | Bajo. Una revisión exhaustiva de los `console.log`: **no verificado** |
| T7 | Facial de un menor sin autorización | `403 GUARDIAN_CONSENT_REQUIRED` al registrar. En el login, `FACE_UNAVAILABLE` si falta la autorización | Bajo |
| T8 | Revocación del acudiente que no borra la plantilla | Ver §4 | **Medio** (sin reintento) |
| T9 | El facial salta el segundo factor | Diseño elegido: el rostro es el factor. La contraseña sigue disponible | Aceptado. Registrar un rostro exige sesión verificada |
| T10 | Reto reutilizado o vencido | Un solo uso y vencimiento → `400 LIVENESS` | Bajo. Se pierde al reiniciar (incomodidad, no riesgo) |
| T11 | Cambio de modelo | Un `model_id` distinto equivale a "sin registro" | Bajo |

## 4. Revocación por el acudiente (`guardian.facial_revoked`)

**Flujo (verificado en el código):**

1. `POST /api/guardian/authorizations {studentId, scope:"facial", granted:false}` (rol `guardian` con vínculo activo).
2. En una transacción:
   - fila en `guardian_authorizations`;
   - `users.guardian_consent_at = NULL`;
   - `audit_log` `guardian.revoke`.
3. **Después del commit**, se emite `guardian.facial_revoked`. El listener de `biometrics` hace un **DELETE explícito** en `face_templates` del estudiante y escribe `audit_log` `facial.delete` con `{"reason":"guardian_revoked"}`. El `ON DELETE CASCADE` no actúa aquí; solo cuando se borra el usuario.

**Riesgo:** el evento es en memoria y sin reintento. Si el listener falla (por ejemplo, la BD no está disponible o el proceso se reinicia), la plantilla queda guardada. Mitigación parcial: sin `guardian_consent_at`, el login facial del menor se rechaza igual (`FACE_UNAVAILABLE`). Backlog de Atlas: outbox para la revocación y ADR-011 (futura).

**Criterio de evidencia (QA Lab):** después de revocar, `count(*) = 0` en `face_templates` para el menor, y existe una fila `facial.delete` en `audit_log` (más la `guardian.revoke`). La auditoría se verifica a mano.

## 5. Riesgos transversales de autenticación

| ID | Riesgo | Estado y acción |
|---|---|---|
| **R1** | En cada arranque, la API crea las cuentas demo que falten (`admin@eduquest.local`, etc.). Si falta `SEED_PASSWORD`, usa una clave por defecto que está en el repo y en el README | Antes de la demo: `SEED_PASSWORD` fuerte en Render y comprobar que ninguna cuenta demo entra con la clave por defecto. Quitar la clave del README |
| R2 | ~~Sin límite por IP en `/auth/login` ni límite en `/auth/forgot`~~ | **Cerrado el 9-oct (ADR-009).** `@nestjs/throttler` con dos ventanas: 300 por IP cada 15 min y 10 por IP más cuenta o reto cada 5 min. Cubre login, código, `forgot`, `reset`, cambio de clave, facial y passkeys, y se suma al bloqueo progresivo por cuenta. Responde `429 TOO_MANY_REQUESTS` |
| **R3** | El login con contraseña pide un código por correo. Sin envío real (Resend caído, sin clave o sin cuota) no hay login ni demo. Con `onboarding@resend.dev` como remitente, `LAB_OTP_INBOX` debe ser la dirección dueña de la cuenta de Resend, o hay que verificar un dominio en `MAIL_FROM`. Además, `LAB_OTP_INBOX` manda los códigos de **todas** las cuentas `@eduquest.local`, admin incluido, a un mismo buzón. Plan B: un dispositivo de confianza o una passkey ya registrados entran sin código (implementados y probados el 9-oct) | Resend escalado a Darwin. En Render, `LAB_OTP_INBOX` debe quedar vacía o apuntar a un buzón que solo controle Darwin, y `SEED_PASSWORD` debe ser fuerte |
| R4 | `JWT_SECRET` solo exige 8 caracteres. **Decisión del 9-oct:** valor aleatorio de 32 bytes o más (por ejemplo `openssl rand -base64 48`), no reutilizado en otros servicios. No se rota antes del 15-oct, y `FACIAL_ENC_KEY` propia con ADR-011 (futura) va después del freeze. Rotarlo deja ilegibles las plantillas e invalida las sesiones: no rotar entre el registro de rostros y la demo del 12-oct. Contexto original: El rechazo de secretos débiles en producción era de la API del 28-sep; en el código actual no aparece | Hallazgo nuevo para Bastión. Si hoy existe otro control: **no verificado** |
| R5 | El listener de `guardian.facial_revoked` no se reintenta (§4) | Riesgo conocido. Para la demo basta con que E14 muestre `facial.delete`. Outbox después del freeze |
| R6 | ~~Producción puede no correr el código del 9-oct~~ | **Cerrado:** el commit `340b047` está `live` en Render desde el 9-oct (14:22) |
| R7 | El bloqueo por cuenta responde `429 ACCOUNT_LOCKED` solo cuando la cuenta existe, lo que permite averiguar qué correos tienen cuenta | Riesgo bajo. Anotado |

## 6. Privacidad (Ley 1581)

Consentimiento versionado (`FACIAL_POLICY_VERSION`), autorización del acudiente para menores, documentos legales versionados con aceptación por el acudiente (módulo `legal`, 9-oct), solicitudes de exportar o borrar (`data_requests`), borrado de la plantilla por el usuario y sin fotos. En la demo no se usan rostros reales de menores.

## 7. Pendientes de verificación

- El disparador de `purgeExpired()`.
- Si `FACIAL_ENC_KEY` está definida en Render.
- Algún límite global de intentos faciales en modo 1:N.
- La revisión de todos los `console.log` en busca de datos sensibles.
- Una prueba automatizada de la revocación. Hoy es manual, a cargo de QA Lab el 12-oct.
