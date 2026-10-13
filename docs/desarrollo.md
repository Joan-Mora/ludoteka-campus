# Desarrollo

## Entorno local

Requisitos: Node.js 20 o superior y acceso a la base de CockroachDB.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # completar DATABASE_URL, JWT_SECRET y lo que se vaya a usar
npm run dev
```

- `npm run dev` compila los contratos y levanta la API (`nest start --watch`) y la web (Vite en `:5173`), que redirige `/api` y `/socket.io` a la API. Para otro puerto: `PORT=3100 npm run dev`.
- La API recompila y reinicia en cada cambio; durante unos segundos responde error.
- Fuera de producción, la respuesta del ingreso trae `devCode` con el código de 6 dígitos. En modo desarrollo, la pantalla de ingreso muestra además botones con las cuentas de laboratorio.
- **La base local es la de producción.** Lo que se cree en local aparece en producción.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API y web en modo desarrollo |
| `npm run typecheck` | Tipos de contratos, API (y scripts) y web |
| `npm run deps:check` | Fronteras entre módulos (dependency-cruiser) |
| `npm run build` | Lo mismo que corre Render |
| `npm run migrate` | Aplica migraciones pendientes |
| `npm run seed` | Rehace el curso demo |
| `npm run library:seed -w @eduquest/api` | Carga la biblioteca y rellena embeddings |
| `npm run e2e -w @eduquest/web` | Pruebas contra local |
| `npm run e2e:prod -w @eduquest/web` | Las mismas pruebas contra producción |

Antes de cada commit: `npm run typecheck`, `npm run deps:check` y las pruebas e2e del área tocada.

## Convenciones de la API

**Estructura de un módulo** (`apps/api/src/modules/<nombre>`):

```
<nombre>.module.ts       Declaración Nest
<nombre>.controller.ts   Rutas: decoradores, validación y nada de lógica
<nombre>.service.ts      Reglas de negocio y acceso a datos
public-api.ts            Lo único que otros módulos pueden importar
```

**Rutas:**

- Toda ruta lleva `@Roles(...)` salvo que cualquier sesión sirva. Las públicas, `@Public()`. Las de ingreso, además, `@UseGuards(AuthThrottleGuard)`.
- El cuerpo se valida con `@Body(new ZodPipe(esquema))`, y el esquema vive en `packages/contracts` para que la web use el mismo.
- Los parámetros UUID usan `ParseUUIDPipe`.
- El usuario llega con `@CurrentUser() user: AuthUser`.

**Errores:** `throw new ApiError(status, 'CODIGO', 'Mensaje en español para el usuario')`. El código es estable y la web puede decidir con él; el mensaje se muestra tal cual.

**Datos:**

- Kysely con `this.database.db`.
- Lo que escribe varias tablas va en `this.database.withTx(async (trx) => …)`, que reintenta ante conflictos de serialización. Por eso el cuerpo debe poder repetirse sin efectos externos (nada de correos ni eventos dentro).
- Cada tabla la escribe solo su módulo dueño.

**Efectos transversales:** XP, insignias, avisos y correos se disparan con un evento de `core/events/domain-events.ts`; no se importan `gamification` ni `notifications`.

**Permisos por relación:** además del rol, cada servicio comprueba la relación (curso del docente, hijo del acudiente). Ver ejemplos en [Seguridad](Security.md#autorización).

## Convenciones de la web

- Una pantalla nueva va en `src/features/<área>.tsx`. En `src/app/router.tsx` se declara con `page(() => import(...), 'NombrePagina')` para cargarla bajo demanda y se agrega a la lista `app` con su ruta.
- Si es un edificio, se agrega al catálogo y al mapa del rol en `src/shared/buildings.ts`; `ROUTE_ROLES`, el menú y la guía se actualizan solos. Si es una página interna, se agrega a `INNER` en `src/app/nav.ts`.
- Los datos se leen con `useQuery` y `api<T>('/api/...')`. Los errores llegan como `ApiException` con `code` y `message`.
- Los estilos van en `src/index.css` con los tokens de radio, superficie y material ([Frontend](frontend.md#sistema-visual)).
- Todo texto visible está en español.

## Cómo agregar…

**Un endpoint:**

1. Esquema zod en `packages/contracts/src/index.ts`.
2. Método en el servicio con la verificación de acceso.
3. Ruta en el controlador con `@Roles` y `ZodPipe`.
4. Llamada desde la web y prueba e2e si cambia un flujo.

**Una tabla o columna:**

1. Archivo nuevo en `db/migrations` con el siguiente número. Si mezcla escritura de datos y cambio de esquema, se parte en dos archivos.
2. Tipos en `apps/api/src/core/database/database.types.ts`.
3. Si el Observatorio debe verla, se agrega a una vista `v_*` y se da `SELECT` a `ludoteka_reader`.

**Un evento:**

1. Constante en `core/events/domain-events.ts`.
2. `this.events.emit(...)` en el módulo dueño, después de guardar.
3. `@OnEvent(...)` en el módulo que reacciona.

**Un módulo:**

1. Carpeta en `modules/` con `public-api.ts`.
2. Registro en `app.module.ts`.
3. `npm run deps:check`.

## Pruebas

Playwright en `apps/web/e2e`, con cuatro perfiles de dispositivo:

| Proyecto | Dispositivo | Motor |
|---|---|---|
| `iphone` | iPhone 13 | WebKit |
| `ipad` | iPad (7.ª gen.) | WebKit |
| `safari-mac` | Safari de escritorio | WebKit |
| `android` | Pixel 7 | Chromium |

**Sesiones:**

- El proyecto `setup` (`auth.setup.ts`) entra con cada rol por la API y guarda la sesión en `e2e/.auth/<destino>/<rol>.json`.
- En local usa `devCode`. En producción solo reutiliza dispositivos de confianza ya guardados, porque nadie lee el correo.
- Para no repetir el ingreso en cada corrida: `npx playwright test --no-deps`.

**Cobertura:**

- Rutas públicas sin errores de JavaScript ni de CSP y sin desborde horizontal.
- Todas las rutas de cada rol, y las de otros roles mostrando «no es para tu rol».
- Flujos completos:
  - ingreso con código;
  - passkeys con autenticador virtual;
  - una cuenta por navegador;
  - foros, sala en vivo, mensajes entre colegas, Arcade, Mi ruta y biblioteca;
  - campus en cinco resoluciones y dos temas.

**Límite de ingresos:** la API acepta 10 ingresos por cuenta cada 5 minutos. Las pruebas reutilizan sesiones y varias corren en un solo proyecto para no agotarlo; si aparecen 429, esperar y repetir.

**Comandos útiles** (desde `apps/web`):

```bash
npx playwright test --project=setup --reporter=line          # regenerar sesiones
npx playwright test --no-deps -g "una cuenta por navegador"  # una prueba
npx playwright test --no-deps --project=android              # un dispositivo
```

Las capturas quedan en `apps/web/e2e/shots/<proyecto>/` (no se versionan).
