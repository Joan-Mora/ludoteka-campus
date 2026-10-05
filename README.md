# EduQuest

Aula virtual gamificada del Colegio Francisco Arango. Un solo proceso (API NestJS + PWA React) y CockroachDB.

## Arranque local

```bash
npm install
npm run dev
```

La API queda en `http://localhost:3000` y la web en `http://localhost:5173`. La primera vez, si `users` está vacío, se siembra el aula de Matemáticas de sexto.

Cuentas de laboratorio (clave `SEED_PASSWORD`, por defecto `EduQuest2026!`):

| Correo | Rol |
|--------|-----|
| admin@eduquest.local | admin |
| rectoria@eduquest.local | directivo |
| docente@eduquest.local | teacher |
| estudiante@eduquest.local | student |
| estudiante2@eduquest.local | student |

Los secretos viven en `apps/api/.env`. La plantilla de nombres está en `apps/api/.env.example`.

## Scripts

- `npm run migrate` aplica `db/migrations`
- `npm run seed` rehace el contenido demo del curso de sexto (no borra usuarios)
- `npm run deps:check` exige las fronteras entre módulos
- `npm run build && npm start` es lo que corre Render

## Documentación

Visión, arquitectura, ADRs, requisitos y el modelo ER están en `docs/`. El parcial se sostiene con CockroachDB, auth, reportes PDF/Excel, facial on-device e IA de práctica.
