# ADR-005 — Archivos en Cloudinary, metadatos en CockroachDB

**Estado:** aceptada · 2026-10-05

## Contexto

La biblioteca guarda guías en PDF, imágenes y videos. Render tiene disco efímero: lo que se escribe en el contenedor se pierde en cada deploy o reinicio. CockroachDB es la única base permitida y no es un almacén de binarios.

## Decisión

1. El archivo vive en Cloudinary, carpeta `ludoteka/biblioteca`. La conexión se configura con una sola variable, `CLOUDINARY_URL` (`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`).
2. El navegador sube directo a Cloudinary con un ticket firmado que entrega la API (`POST /api/library/uploads/ticket`): carpeta fija, `timestamp`, firma SHA-1 y tope de 50 MB. El archivo no pasa por el servidor.
3. Al registrar el recurso, la API comprueba la firma de la respuesta de Cloudinary (`public_id` + `version`) y que el `public_id` esté dentro de la carpeta. Sin firma válida no se crea la fila.
4. En `library_items` solo quedan metadatos: URL segura, `cloudinary_public_id` (único), `resource_type`, formato, bytes, páginas, visibilidad, curso, materia y autor.
5. Si el recurso es un PDF, la API lo descarga una vez, extrae el texto por página y lo guarda en `library_chunks` (texto, `tsvector` en español y embedding). Eso alimenta la búsqueda y las citas del tutor (RAG).
6. Borrar el recurso borra la fila, sus fragmentos en cascada y el archivo en Cloudinary (`destroy`).
7. Sin `CLOUDINARY_URL` la biblioteca sigue funcionando con enlaces externos y responde `503 STORAGE_OFF` al pedir un ticket.

## Consecuencias

- Un deploy en Render no borra ningún archivo.
- La base guarda lo que se consulta y se reporta (vistas, guardados, etiquetas) y no crece con binarios.
- La miniatura sale de una transformación de URL de Cloudinary, sin procesar imágenes en el servidor.
- El secreto de Cloudinary solo está en el entorno del servidor; el navegador recibe una firma de un solo uso.
