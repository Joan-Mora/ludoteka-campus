# Frontend

`apps/web`: React 19, Vite 7, TanStack Query 5, React Router 7, Framer Motion y Radix UI. Es una PWA que la API sirve desde `apps/web/dist`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/main.tsx` | Polyfills, `QueryClient`, `BrowserRouter`, `AuthProvider` y `AppRouter` |
| `src/app/router.tsx` | Rutas; cada página se carga bajo demanda (`lazy`) dentro de un único `Suspense` |
| `src/app/nav.ts` | `ROUTE_ROLES`, secciones del menú lateral y pestañas del teléfono |
| `src/app/shell.tsx` | Shell de escritorio o de teléfono según `useLayout()`, más la guía y la oferta de passkey |
| `src/app/guide.tsx` | Luka o Luna: recorrido guiado y ayuda por edificio |
| `src/features/*` | Pantallas por área (aula, evaluación, juegos, biblioteca, gobierno…) |
| `src/shared/*` | Sesión (`auth.tsx`), cliente HTTP (`api.ts`), avisos, voz, rostro, passkeys, catálogo de edificios |
| `src/ui/*` | Componentes base (`Sheet`, `PageHeader`, `Tile`…) y dibujo isométrico (`iso.tsx`, `campus-mini.tsx`) |
| `e2e/*` | Pruebas Playwright (ver [Desarrollo](desarrollo.md#pruebas)) |

## Rutas y acceso

- **Públicas:** `/`, `/legal/:tipo`, `/verificar/:código`, `/verificar-reporte/:código`, `/recuperar`, `/restablecer`, `/cambiar-clave`, `/aceptar`.
- **Solo sin sesión** (`GuestOnly`): `/ingresar` y `/ingresar/rostro`. Con sesión abierta redirigen a `/app`.
- **Con sesión** (`Gate`): todo `/app/*`, `/examen/:id` y `/arena/:id/proyector`. `Gate` manda a `/ingresar` sin sesión, a `/cambiar-clave` si la clave es temporal y a `/aceptar` si falta aceptar documentos legales.
- **Por rol** (`RoleRoute`): cada ruta de `/app` consulta `ROUTE_ROLES`; si el rol no está, muestra «Esta sección no es para tu rol». La API valida lo mismo por su lado.

## Sesión en el navegador

`src/shared/api.ts` y `src/shared/auth.tsx`.

- El token de acceso vive en una variable del módulo y en `sessionStorage['eq_access']`, así que cada pestaña tiene el suyo y muere al cerrarla. El refresh va en una cookie `HttpOnly` que JavaScript no puede leer.
- `api()` agrega `Authorization: Bearer` y `credentials: 'include'`. Ante un 401 pide un refresh (una sola petición en vuelo aunque fallen varias a la vez) y reintenta una vez. Si la respuesta es `SESSION_RACE` (otra pestaña rotó el refresh), reintenta a los 400 y 800 ms.
- Al montar, `AuthProvider` llama `GET /api/auth/me`. Una pestaña nueva sin token pasa por el refresh y hereda la sesión del navegador.
- **Sincronización entre pestañas** con `BroadcastChannel('eq-session')`:
  - cerrar sesión en una pestaña la cierra en todas;
  - si otra pestaña entra con una cuenta distinta, las pestañas sin sesión cargan la nueva y las que tenían otra cuenta se recargan para no mostrar datos cruzados.

## Datos del servidor

- TanStack Query con la configuración por defecto; tras una mutación se invalidan las consultas afectadas.
- **Actualización periódica:**
  - avisos cada 60 s;
  - contadores del campus cada 60 s;
  - tableros de coordinación cada 20 s;
  - estado de sala en vivo cada 6 s y de Arena cada 15 s, como respaldo del socket.

## Campus por rol

El inicio es un campus isométrico y cada sección es un edificio. Cada rol tiene su propio mapa con solo sus edificios (`MAPS` en `src/shared/buildings.ts`); el menú, las pestañas del teléfono y `ROUTE_ROLES` salen de ahí. La tabla por rol está en [Roles y permisos](roles-y-permisos.md#campus-de-cada-rol).

- El mapa crece con el número de edificios: cada uno ocupa una manzana de la cuadrícula, la central es la plaza y las sobrantes son parques (`campusFor`).
- La barra lateral de escritorio es el mismo mapa en miniatura, con un marcador «Estás aquí» sobre el techo del edificio actual (`roofTop`).
- Al entrar a un edificio, el dibujo crece hasta la cabecera de la página con la View Transitions API (`src/shared/enter.ts`). Sin la API o con «reducir movimiento», se navega sin animación.
- Luka o Luna acompaña desde un botón flotante. La primera visita a `/app` hace el recorrido por distritos; dentro de cada edificio explica cómo se usa para ese rol.

## Sistema visual

La marca es el violeta Ludoteka (`#5b3df5`). Cada edificio tiene un **material** que se ve en la cabecera de su página (la «fachada»):

| Material | Edificios |
|---|---|
| Pizarra (`#23463a`, tiza `#f4f1e6`) | Aula, cursos, calificaciones, sala en vivo, familia |
| Ficha bibliográfica (`#fbfaf6`, renglón azul, cabecera roja) | Biblioteca |
| Papel milimetrado (`#f4f7ff`) | Laboratorio IA, Mi espacio |
| Neón (`#12082b`, magenta `#ff3d9a`, cian `#33e4ff`) | Arena, Arcade |
| Corcho (`#c99a63`) | Cartelera |
| Hoja rayada | Cuaderno, Coordinación |
| Curvas de nivel | Mi ruta, Observatorio |
| Terciopelo con latón | Sala de trofeos, Rectoría |

Cada material redefine `--ink`, `--muted` y `--line` para mantener contraste AA en tema claro y oscuro.

**Tipografía:** Bricolage Grotesque en titulares y Plus Jakarta Sans en interfaz y lectura. Escala de 12, 13.5, 15.5, 18, 24 y 38 px. Sin rótulos en mayúsculas espaciadas.

**Radios y superficies** (`src/index.css`): lo que contiene es más redondo que lo contenido.

| Token | Valor | Uso |
|---|---|---|
| `--r-plate` | 6 px | Placa del edificio, insignias |
| `--r-control` | 12 px | Botones, campos, filas, tarjetas anidadas |
| `--r-card` | 18 px | Tarjetas |
| `--r-building` | 28 px | Fachadas y campus |

Cuatro niveles de superficie: terreno (fondo), fachada (con textura), tarjeta (línea fina y sombra corta) y hoja (dentro de una tarjeta, sin sombra, `--surface-2`).

**Principios:**

- La audacia va en las fachadas; tarjetas, tablas y formularios son sobrios.
- Todo se alinea a la izquierda; solo los estados vacíos van centrados.
- Hay un único movimiento orquestado: entrar al edificio.

## Diseño adaptable y compatibilidad

- `useLayout()` elige el shell de escritorio si el ancho es de al menos 901 px, o de 641 px con puntero fino; si no, usa el shell de teléfono, con barra inferior y hoja «Más».
- **Navegadores objetivo:** Safari 14 o superior (iPhone, iPad, Mac) y Chrome 90 o superior. El build compila a `es2020`, y Lightning CSS transforma el CSS para esos destinos. `src/polyfills.ts` cubre lo que falta en Safari 14.
- Ninguna página debe desbordar en horizontal; las pruebas e2e lo verifican en cada ruta.

## Funciones del navegador

| Función | Archivo | Notas |
|---|---|---|
| Rostro | `src/shared/face.ts` | `@vladmandic/face-api` cargado bajo demanda; modelos copiados al build por `scripts/copy-face-models.mjs`. Prueba de vida por parpadeo o giro |
| Passkeys | `src/shared/passkey.tsx` | `@simplewebauthn/browser`. Tras entrar con código, el inicio ofrece activar la llave del dispositivo una vez |
| Voz | `src/shared/voice.ts`, `voice-ui.tsx` | Web Speech API: dictado, lectura en voz alta y comandos («qué tengo pendiente», «busca en la biblioteca…») |
| PWA | `vite.config.ts` | `vite-plugin-pwa` con actualización automática; manifiesto en español |

## Build

`npm run build -w @eduquest/web` copia los modelos de rostro, revisa tipos y corre `vite build`.

- No publica mapas de código.
- Separa `face-api` y las dependencias en chunks propios.
- Ofusca los chunks de la app sin `eval`, compatible con la CSP. Es solo disuasión.
- En desarrollo, Vite sirve en `:5173` y redirige `/api` y `/socket.io` a la API (`PORT`, 3000 por defecto).
