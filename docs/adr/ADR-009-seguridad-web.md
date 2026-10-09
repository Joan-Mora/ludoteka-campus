# ADR-009 — Endurecimiento de seguridad web: encabezados, límites de intentos y código del cliente

**Estado:** aceptada · 2026-10-09
**Relacionada con:** ADR-010 (cuentas y autenticación), ADR-002 y ADR-007 (facial).

## Contexto

Ludoteka Campus atiende menores de edad y guarda datos académicos y biométricos (Ley 1581). Antes de este cambio la API solo configuraba CORS: no había encabezados de seguridad, ni límite de intentos en login, código, recuperación, facial o passkeys, y el JavaScript del navegador se publicaba sin protección. Todo corre en un solo Web Service de Render que sirve la API y el frontend desde el mismo origen.

## Decisión

1. **Encabezados con `helmet`** (`apps/api/src/core/security/headers.ts`), aplicados a la API y al frontend estático:
   - **CSP estricta.**
     - `script-src 'self'`: sin scripts en línea ni `eval`. `theme-init.js` es un archivo.
     - Estilos: `'self'` y Google Fonts. `'unsafe-inline'` en estilos porque React y Framer Motion escriben atributos `style`.
     - Imágenes, medios y marcos: Cloudinary y YouTube (`youtube-nocookie`).
     - `connect-src`: el propio origen, el WebSocket propio y `api.cloudinary.com` (subida directa firmada).
     - `object-src 'none'` y `frame-ancestors 'none'`.
   - **HSTS** de un año con subdominios y `upgrade-insecure-requests`, solo si `APP_PUBLIC_URL` es `https`. En local no se fuerzan.
   - **`Referrer-Policy: strict-origin-when-cross-origin`**, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Cross-Origin-Opener-Policy` y `Cross-Origin-Resource-Policy` en `same-origin`.
   - **`Permissions-Policy`.**
     - Cámara, micrófono, pantalla completa y WebAuthn solo para el propio origen.
     - Geolocalización, pagos, USB, serie, Bluetooth y `browsing-topics` deshabilitados.
   - **Sin `X-Powered-By`.**
2. **Límite de intentos con `@nestjs/throttler`** (`core/security/throttle.ts`, `AuthThrottleGuard`), solo en las rutas sensibles:
   - **Rutas cubiertas:**
     - `auth/login`, `auth/otp/verify`, `auth/otp/resend`, `auth/forgot`, `auth/reset` y `auth/password`;
     - `facial/challenge`, `facial/enroll` y `facial/login`;
     - las cuatro rutas de passkeys.
   - **Dos ventanas:**
     - `ip`: 300 peticiones cada 15 minutos. Es amplia porque un salón entero sale a internet con la misma IP del colegio.
     - `subject`: 10 cada 5 minutos por IP más cuenta (correo) o reto (`challengeId`). Frena a quien insiste contra una cuenta sin bloquear al resto del salón.
   - Al superar el límite responde `429 TOO_MANY_REQUESTS` con un mensaje en español y `retryAfter`.
   - Se suma al bloqueo progresivo por cuenta (ADR-010), que sigue activo.
3. **Código en el navegador:**
   - Vite compila sin mapas de código (`sourcemap: false`) y sin comentarios de licencia en línea.
   - Las librerías van a los chunks `vendor` y `face-api`.
   - Los chunks hechos solo con código propio pasan por una ofuscación ligera con `javascript-obfuscator`. Se aplica a los chunks ya empaquetados, para no romper las rutas diferidas:
     - nombres mangleados y arreglo de cadenas al 60 %;
     - sin aplanar el flujo, sin autodefensa y sin `eval`, para respetar la CSP.
   - Es una barrera disuasoria: la seguridad real está en la API (roles, validación con zod y nada sensible en el cliente).
4. **Dependencias:**
   - `npm audit fix` cerró los avisos crítico (`shell-quote`, vía `concurrently`, solo en desarrollo) y alto (`source-map-js`, en la compilación).
   - Queda un aviso moderado de `uuid` < 11.1.1 dentro de `exceljs` (GHSA-w5hq-g745-h8pq). Solo afecta a `v3`, `v5` y `v6` cuando se pasa un `buf`, y `exceljs` usa únicamente `v4()` sin búfer. Se acepta y se revisa cuando `exceljs` publique una versión con `uuid` actualizado. Forzar la versión con `overrides` rompía la resolución en el monorepo.

## Verificación

- Playwright contra el build de producción servido por la API (`E2E_BASE_URL=http://localhost:3000`), con Chromium (Android) y WebKit (iPhone y Safari Mac). La prueba falla si el navegador reporta una violación de CSP: 0 violaciones.
- El intento 11 de login contra la misma cuenta desde la misma IP recibe `429`. Otra cuenta desde la misma IP sigue respondiendo con normalidad.

## Consecuencias

- Agregar un dominio externo (otro CDN, analítica, otro proveedor de video) exige actualizar la CSP. Si no, el navegador lo bloquea.
- El almacenamiento del throttler está en memoria: con varias instancias habría que moverlo a un almacén compartido. Es el mismo límite de una sola instancia que ADR-008.
- La ofuscación agrega unos segundos al build y hace más difícil depurar en producción. Para depurar se compila en local sin el plugin.

## Pendiente

- `FACIAL_ENC_KEY` propia, para que rotar `JWT_SECRET` no deje ilegibles las plantillas faciales (riesgo R4 del modelo de amenazas). Va después del freeze del 15-oct junto con el outbox de revocación facial.
