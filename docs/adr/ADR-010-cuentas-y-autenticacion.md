# ADR-010 — Cuentas institucionales y autenticación: contraseña + código, dispositivos de confianza y passkeys

**Estado:** aceptada · 2026-10-09
**Relacionada con:** ADR-009 (seguridad web), ADR-002 y ADR-007 (facial).

## Contexto

El campus tenía registro público: cualquiera podía crear una cuenta y declararse estudiante. En un colegio con menores eso no es aceptable. El colegio debe saber quién entra, los acudientes deben quedar vinculados a sus estudiantes y el acceso debe ser cómodo en el iPhone, el Android o el computador de cada persona.

## Decisión

1. **Sin registro público.** Solo el administrador crea cuentas (`/app/admin/usuarios`):
   - una por una;
   - o por carga masiva de Excel o CSV, con plantilla, vista previa por fila y registro en `account_imports`.
   Cada cuenta nace con una clave temporal y `must_change_password`, y el correo de bienvenida se envía por Resend. Si se desactiva el envío, el administrador descarga las credenciales una sola vez.
2. **Ingreso en dos pasos:**
   - contraseña (argon2id);
   - código de 6 dígitos por correo (`login_challenges`): vence en 10 minutos, admite 5 intentos y se reenvía cada 30 s.
   El código de las cuentas de laboratorio (`*@eduquest.local`) llega al buzón `LAB_OTP_INBOX`. En desarrollo la API devuelve `devCode`.
3. **Dispositivo de confianza** opcional por 30 días: cookie `lk_device` HttpOnly; en la base solo se guarda su hash. Con ella el código no se pide. Se revoca desde Ajustes o con "Cerrar sesión en todos los dispositivos".
4. **Sesiones:**
   - token de acceso JWT de 20 minutos (claims `amr` con el método y `mcp` con el cambio de clave pendiente);
   - refresh rotativo en la cookie `eq_refresh` (HttpOnly, ruta `/api/auth`), agrupado por familia.
   Si alguien reutiliza un refresh ya rotado, se revoca toda la familia y se audita `session.reuse_detected`. Ajustes › Seguridad lista las sesiones y permite cerrar una o todas.
5. **Bloqueo progresivo** por cuenta tras 5 contraseñas fallidas (`ACCOUNT_LOCKED`), además del límite por IP de ADR-009.
6. **Passkeys WebAuthn** (Face ID, Touch ID, huella, Windows Hello) con `@simplewebauthn`:
   - **Alta:** solo desde una sesión verificada (`amr` igual a `otp`, `trusted_device` o `passkey`). Una contraseña robada no basta para registrar una llave. Se admiten hasta 10 por persona.
   - **Requisitos:** credencial residente y verificación de usuario obligatoria.
   - **Ingreso:** directo, sin contraseña ni código.
   - **Datos guardados:** solo la llave pública y el contador. Un contador que retrocede invalida el ingreso.
   - **Dominio:** el RP ID es el dominio de `APP_PUBLIC_URL`.
7. **Facial** (ADR-007) también se registra solo desde una sesión verificada y sigue siendo opcional.
8. **Aceptación legal versionada** (Ley 1581 y Decreto 1377):
   - Tras el ingreso, si hay una versión vigente de términos, tratamiento de datos o cookies sin aceptar, el usuario pasa por `/aceptar`.
   - Un menor con acudiente vinculado espera a que el acudiente acepte por él desde su cuenta (`accepted_by`).
   - Un menor sin acudiente declara que su acudiente leyó los documentos con él.
   - Publicar una versión nueva en `legal_documents` vuelve a pedir la aceptación a todos.
9. **Habeas data:**
   - Ajustes › Privacidad descarga un JSON con los datos de la persona, sin hashes, tokens ni plantillas biométricas.
   - Desde ahí se pide la eliminación (`data_requests`), que el administrador atiende en 15 días hábiles.
10. Todo queda en `audit_log`:
    - creación, cambios y desactivación de cuentas;
    - reenvío de acceso;
    - ingresos y fallos;
    - passkeys, aceptación legal y solicitudes de datos.

## Alternativas descartadas

- **Mantener el registro abierto con validación posterior:** deja cuentas falsas activas mientras nadie revisa.
- **SMS como segundo factor:** tiene costo por mensaje, no todos los estudiantes tienen línea propia y no es más seguro que el correo institucional.
- **Contraseñas sin código:** son vulnerables a la reutilización de claves. El código por correo más el dispositivo de confianza mantiene la comodidad en el equipo propio.

## Consecuencias

- El primer ingreso depende de que el correo llegue: Resend con dominio verificado (`abacore.co`) y botón "Reenviar código".
- Las passkeys quedan atadas al dominio. Si el campus cambia de dirección, hay que registrarlas de nuevo.
- Los textos legales son una plantilla: el abogado del colegio debe revisarlos antes del uso real (lo indica un aviso en cada página).
