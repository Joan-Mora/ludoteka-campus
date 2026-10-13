# Documentación técnica de Ludoteka Campus

Documentación de referencia para quien mantiene, despliega o audita la plataforma. Describe el sistema tal como está en el código; cuando el código cambie, se actualiza el documento en el mismo commit.

| Documento | Para qué sirve |
|---|---|
| [Arquitectura](Architecture.md) | Cómo está armado el sistema: procesos, módulos, eventos, tiempo real, IA y frontend |
| [Seguridad](Security.md) | Autenticación, sesiones, autorización, protección web, biometría, IA y datos personales, y los riesgos conocidos |
| [Roles y permisos](roles-y-permisos.md) | Qué ve y qué puede hacer cada uno de los seis roles, y dónde se exige |
| [Modelo de datos](datos.md) | Tablas por módulo, vistas del Observatorio, convenciones y particularidades de CockroachDB |
| [API](api.md) | Convenciones de la API REST y la lista completa de endpoints con su rol |
| [Frontend](frontend.md) | Estructura de la web, sesión en el navegador, campus por rol y sistema visual |
| [Operación](operacion.md) | Despliegue en Render, variables de entorno, migraciones, tareas de mantenimiento y solución de problemas |
| [Desarrollo](desarrollo.md) | Entorno local, convenciones de código, cómo agregar módulos, rutas y migraciones, y pruebas |

## Mapa rápido del repositorio

```
apps/api            API NestJS 11 + Kysely sobre CockroachDB
  src/core          Infraestructura compartida: auth, base de datos, IA, correo, reportes, tiempo real, seguridad
  src/modules       Módulos de dominio; cada uno expone su fachada en public-api.ts
  scripts           Scripts de mantenimiento (library-seed.ts)
apps/web            React 19 + Vite + TanStack Query
  src/app           Router, shell, navegación por rol y guía
  src/features      Pantallas por área funcional
  src/shared        Sesión, cliente HTTP, voz, rostro, passkeys, catálogo de edificios
  src/ui            Componentes y dibujo isométrico
  e2e               Pruebas Playwright
packages/contracts  Roles y esquemas zod compartidos por API y web
db/migrations       Esquema SQL versionado (se aplica al arrancar la API)
db/seeds            Contenido demo y manifiesto de la biblioteca
render.yaml         Blueprint del servicio en Render
```
