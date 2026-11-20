# Base de datos de la sincronización

Proyecto de Supabase propio y separado: `id-cocina` (ref `dyacksxibcwvrdsulsfc`, región París), plan gratuito.

- Tablas `id_spaces`, `id_items`, `id_history`, `id_images`, con RLS activado y sin políticas: no se pueden leer ni escribir directamente.
- Solo se accede con las funciones `id_open`, `id_push`, `id_pull`, `id_push_image`, `id_image_paths` e `id_pull_images`, y todas piden el código secreto de 24 caracteres (se guarda su resumen sha256, nunca el código).
- Gana el cambio más reciente de cada cosa; la versión sustituida queda en `id_history`. Nada se borra.
- Como mucho 5 libretas, 50 000 cosas y 4000 imágenes por libreta.
- La clave pública (anon) que va en `src/sync.js` no da acceso a nada sin el código.
