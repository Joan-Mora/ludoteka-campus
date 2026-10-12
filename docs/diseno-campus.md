# Diseño: «El campus es la app»

> Última revisión: 2026-10-12 · Fase 5 de Ludoteka 2 · Skill `frontend-design`

## Encargo

- **Qué es:** Ludoteka Campus, la plataforma del Colegio Francisco Arango (Colombia), grados 6.° a 11.°.
- **Para quién:** estudiantes de 11 a 17 años que la usan a diario en el teléfono y en el computador del aula; docentes, coordinación, rectoría y acudientes que entran a tareas puntuales.
- **Trabajo principal:** que cada persona sepa en qué lugar del colegio está y qué tiene pendiente allí, sin sentir que abre «otro panel administrativo».

El inicio ya es un campus isométrico con edificios (Aula, Biblioteca, Laboratorio IA, Arena, Cartelera, Cuaderno, Mi ruta, Sala de trofeos). El resto de la app no lo sabía: cada página era la misma tarjeta blanca con un rótulo en mayúsculas. La idea de esta fase es que **al entrar a una sección se entre a un edificio**, y que el edificio se note en el material de su fachada.

## Fichas de diseño

### Color

La marca no cambia (violeta de Ludoteka). Lo nuevo son los **materiales**, uno por edificio, tomados de objetos reales de un colegio colombiano:

| Nombre | Hex | Dónde |
|---|---|---|
| Violeta Ludoteka | `#5b3df5` | Marca, acción principal, foco |
| Pizarra | `#23463a` (tiza `#f4f1e6`, repisa `#9a6a3e`) | Aula: cursos, lecciones, calificaciones, sala en vivo, familia |
| Ficha bibliográfica | `#fbfaf6` (renglón `#4f86f7` al 22 %, cabecera roja `#d9534f`) | Biblioteca |
| Papel milimetrado | `#f4f7ff` (línea `#5b3df5` al 12 %) | Laboratorio IA y Mi espacio |
| Neón de gradería | fondo `#12082b`, magenta `#ff3d9a`, cian `#33e4ff` | Arena y Arcade |
| Corcho | `#c99a63` (tinta `#2b1a08`) | Cartelera |

Otros tres edificios completan el mapa con materiales menos ruidosos: hoja rayada con margen rojo (Cuaderno, Coordinación, Taller docente), curvas de nivel (Mi ruta, Observatorio) y terciopelo con latón (Sala de trofeos, Rectoría). En tema oscuro cada material conserva su identidad y baja la luz: la ficha pasa a azul tinta `#1c2238`, el milimetrado a plano `#0f1638`; pizarra, neón y terciopelo ya son oscuros.

### Tipografía

- **Bricolage Grotesque** (titulares): sus terminaciones irregulares recuerdan letra de cartel escolar; en la pizarra se le agrega un leve halo de tiza y en el neón un resplandor, en vez de traer una tercera familia.
- **Plus Jakarta Sans** (interfaz y lectura): redonda y legible a 14–16 px en pantallas de aula.
- Escala: 12 · 13.5 · 15.5 · 18 · 24 · 38 px (titular de fachada `clamp(28px, 3vw, 40px)`), líneas de lectura por debajo de 75 caracteres.
- **Sin rótulos en mayúsculas espaciadas.** El rótulo sobre el título se vuelve la **placa del edificio** (icono más nombre, en minúscula de oración) y solo aparece cuando se está dentro de uno.

### Radios y superficies

Antes: 20 px en todo. Ahora la jerarquía dice qué contiene a qué:

| Token | Valor | Uso |
|---|---|---|
| `--r-plate` | 6 px | Placa del edificio, insignias pequeñas |
| `--r-control` | 12 px | Botones, campos, filas y tarjetas anidadas |
| `--r-card` | 18 px | Tarjetas de contenido |
| `--r-building` | 28 px | Fachadas y el campus del inicio |

Cuatro superficies, de abajo hacia arriba: **terreno** (fondo), **fachada** (con textura, una por página), **tarjeta** (superficie con línea fina y sombra corta) y **hoja** (lo que va dentro de una tarjeta: plano, sin sombra, `--surface-2`).

### Composición

```
Escritorio                                         Teléfono
┌──────────────┬──────────────────────────────┐    ┌──────────────────────┐
│ Ludoteka     │ [buscar]           XP 🎙 ☾ 🔔 │    │ ←  Biblioteca  🔔 (JE)│
│ ┌──────────┐ │ ┌──────────────────────────┐ │    │ ┌──────────────────┐ │
│ │ ◇ mapa   │ │ │ ▣ Biblioteca      ┌────┐ │ │    │ │ ▣ Biblioteca     │ │
│ │  ▲ aquí  │ │ │ Biblioteca del    │ ⌂  │ │ │    │ │ Biblioteca del   │ │
│ └──────────┘ │ │ campus            └────┘ │ │    │ │ campus           │ │
│ Estás en la  │ │ (ficha con renglones)    │ │    │ └──────────────────┘ │
│ Biblioteca   │ └──────────────────────────┘ │    │ [contenido]          │
│ ─ Aprender   │ [contenido en tarjetas]      │    │                      │
│ ▣ Aula       │                              │    │ [Inicio Cursos … Más]│
└──────────────┴──────────────────────────────┘    └──────────────────────┘
```

- La **barra lateral es el mapa**: un campus isométrico en miniatura con los mismos edificios, colores y posiciones que el inicio; un marcador «Estás aquí» se posa sobre el edificio de la página actual (en el inicio, sobre la plaza). Cada icono del menú toma el color de su edificio, así el mapa y la lista se leen igual.
- La **cabecera de página es la fachada**: placa, título, descripción y acciones alineados a la izquierda; a la derecha, el edificio isométrico (el mismo dibujo del mapa, en grande). En teléfonos el dibujo se oculta y queda el material.
- **Alineación:** todo a la izquierda; nada centrado salvo estados vacíos.

### Un campus por rol

Cada rol tiene su propio mapa, con solo sus módulos y sin edificios repetidos. El mapa crece con el número de módulos: cada edificio ocupa una manzana de la cuadrícula de calles, la manzana central es la plaza y las que sobran se vuelven parques. El marcador «Estás aquí» se apoya en el techo del edificio (`roofTop`), no en su base.

| Rol | Distritos y edificios |
|---|---|
| Estudiante | Mi día (Mis cursos, Mi ruta, Cuaderno) · A mi manera (Mi espacio, Laboratorio IA) · Jugar (Sala en vivo, Arena, Arcade, Sala de trofeos) · Colegio (Biblioteca, Cartelera) |
| Docente | Enseñar (Mis cursos, Planilla de notas, Banco de preguntas) · En clase (Sala en vivo, Arena) · Comunicación (Mensajes, Cartelera) · Recursos (Biblioteca, Observatorio) |
| Coordinación | Seguimiento (Alertas, Asistencia, Citaciones) · Académico (Grupos y cursos, Consolidado de notas, Observatorio) · Comunicación (Mensajes, Cartelera, Biblioteca) |
| Rectoría | Dirección (Tablero, Sala de firmas, Archivo de reportes) · Datos (Observatorio) · Comunicación (Mensajes, Cartelera, Biblioteca) |
| Acudiente | Familia (Mis hijos, Mensajes) · Colegio (Cartelera, Biblioteca) |
| Administración | Administración (Usuarios, Institución) · Datos (Observatorio) · Comunicación (Mensajes, Cartelera, Biblioteca) |

Un módulo pertenece a los roles cuyo mapa tiene su edificio: el menú y el router (`ROUTE_ROLES`) salen de esta tabla, y la API valida el rol en cada ruta, así nadie ve módulos de otro rol. El inicio también cambia: estudiante y docente ven su semana; coordinación, rectoría, acudiente y administración ven su campus, sus edificios con lo pendiente y, el acudiente, una tarjeta por hijo.

Luka o Luna acompaña siempre desde un botón flotante: la primera vez recorre el mapa distrito por distrito y, dentro de cada edificio, explica cómo se usa para ese rol.

### Movimiento

Un solo momento orquestado: **entrar al edificio**. Al tocar un edificio (en el mapa del inicio, en el mini mapa o en el menú), el dibujo crece hasta ocupar su lugar en la fachada con la View Transitions API, mientras la página anterior se aleja un poco. Sin la API o con «reducir movimiento» se navega sin animación. Nada más se mueve solo: se quitan las entradas con desvanecimiento de la cabecera.

## Principios

1. **Un lugar, un material.** El material dice dónde estás antes de leer el título.
2. **El mapa es la navegación.** Lo que está en el inicio está en la barra lateral, con la misma forma y el mismo color.
3. **La audacia va en las fachadas.** Tarjetas, tablas y formularios se quedan sobrios.
4. **Contraste primero.** Cada material redefine `--ink`, `--muted` y `--line` para que los botones y textos que caen sobre él sigan siendo legibles (AA) en ambos temas.

## Revisión contra lo genérico

| Primera idea | Por qué sonaba genérica | Cambio |
|---|---|---|
| Fondo crema con serif para la Biblioteca | Es el «papel crema con serif y acento terracota» de cualquier página generada | Ficha bibliográfica casi blanca con renglones azules y cabecera roja, la que se usa en las bibliotecas escolares; misma tipografía de la app |
| Rótulo en mayúsculas espaciadas sobre cada título | Cromo de plantilla que no informa nada | Placa del edificio en minúscula de oración, solo dentro de un edificio |
| Todas las tarjetas con el mismo radio y la misma sombra | Kit de tarjetas SaaS | Cuatro radios y cuatro superficies; lo anidado pierde la sombra |
| Animar la entrada de cada sección | Desvanecer y subir en todo se lee como generado | Una sola transición, la de entrar al edificio |
| Neón en toda la app «gamer» | Fondo oscuro con un acento ácido es otro lugar común | Neón solo donde se compite (Arena y Arcade); el resto conserva su material |

## Implementación

| Pieza | Archivo |
|---|---|
| Edificios, mapa de cada rol y trazado de la cuadrícula (`campusFor`, `roofTop`, ruta → edificio) | `apps/web/src/shared/buildings.ts` |
| Guía persistente de Luka o Luna con recorrido por rol | `apps/web/src/app/guide.tsx` |
| Geometría isométrica y dibujo de cada edificio (compartidos con el inicio) | `apps/web/src/ui/iso.tsx` |
| Dibujo isométrico de un edificio y mini mapa con «Estás aquí» | `apps/web/src/ui/campus-mini.tsx` |
| Entrar al edificio (View Transitions con respaldo) | `apps/web/src/shared/enter.ts` |
| Fachada en `PageHeader` | `apps/web/src/ui/index.tsx` |
| Materiales, radios y superficies | `apps/web/src/index.css` (secciones «Radios y superficies», «Fachadas», «Mini mapa», «Entrar al edificio») |
| Capturas en 1280, 1440, 1920, 2560 y 3840 px, tema claro y oscuro, de los ocho materiales | `apps/web/e2e/smoke.spec.ts`, «Campus: fachadas y mapa…» y «Campus: entrar al edificio…» |

La Sala de trofeos conserva su cabecera propia (anillo de nivel y estadísticas) y toma el material de latón y la placa en lugar de una fachada aparte.
