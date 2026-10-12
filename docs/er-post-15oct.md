# ER post-15-oct (migraciones 0028 a 0030)

> Última revisión: 2026-10-12 · Responsable: Cronista
> **Fuera del ER oficial, de E9 y de E12** (decisión de Nexus, 12-oct). Archivos sin commit en 2Klair al 2026-10-12. Contenido movido tal cual desde `er.md`; entra al ER cuando Nexus lo apruebe y `schema_migrations` de producción lo liste.

## Columnas nuevas

- `courses`: is_demo BOOL (0029)
- `forum_threads`: summary STRING NULL, summary_posts INT8 NULL, summary_at TIMESTAMPTZ NULL (0030); relación 1:N forum_attachments
- `library_items`: source_name STRING NULL, source_url STRING NULL, license STRING NULL (0028)

## Tablas nuevas (0030)

| Entidad | Atributos | PK/FK y restricciones | Relaciones |
|---|---|---|---|
| `forum_reactions` (0030) | **post_id** (FK) UUID<br>**user_id** (FK) UUID<br>**kind** STRING<br>created_at TIMESTAMPTZ | PK (post_id, user_id, kind)<br>FK post_id → forum_posts(id) CASCADE<br>FK user_id → users(id) CASCADE<br>CHECK kind IN (util, idea, gracias, duda) | N:1 forum_posts<br>N:1 users |
| `forum_mentions` (0030) | **post_id** (FK) UUID<br>**user_id** (FK) UUID | PK (post_id, user_id)<br>FK post_id → forum_posts(id) CASCADE<br>FK user_id → users(id) CASCADE | N:1 forum_posts<br>N:1 users |
| `forum_attachments` (0030) | **id** UUID<br>thread_id (FK) UUID<br>post_id (FK) UUID NULL<br>item_id (FK) UUID<br>created_at TIMESTAMPTZ | PK (id)<br>FK thread_id → forum_threads(id) CASCADE<br>FK post_id → forum_posts(id) CASCADE<br>FK item_id → library_items(id) CASCADE | N:1 forum_threads<br>N:1 forum_posts<br>N:1 library_items |

## Restricciones y notas

- `library_items` (0028): desde 0028, `kind = 'link'` o `cloudinary_public_id` o `source_url` (un PDF puede quedarse en su sitio oficial), `source_url` https ≤ 500, `source_name` y `license` ≤ 120 
- Foros (0030): `summary` guarda el último resumen del hilo para quien modera; `summary_posts` es el `posts_count` de ese momento y sirve para avisar que hay respuestas nuevas. Un adjunto con `post_id` nulo es del tema.
