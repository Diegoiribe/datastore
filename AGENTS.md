# Instrucciones para agentes de programación

Antes de analizar o modificar este repositorio, lee completos `README.md` y
`WINDOWS_HANDOFF.md`. Después consulta `../Macintosh/README.md` y
`../Macintosh/docs/WINDOWS_HANDOFF.md` cuando el cambio toque API, persistencia,
Firebase, terminal o Vercel.

Inspecciona `git status` antes de editar y preserva los cambios existentes del
usuario. No incluyas secretos, tokens, credenciales, URLs privadas ni datos reales
en código, Git, pruebas o respuestas.

Invariantes esenciales:

- `/` puede consumir publicaciones reales mediante Macintosh.
- `/studio` usa exclusivamente `lib/studio-demo-data.ts` para valores visibles.
- Las funciones públicas nunca permiten rutas de tableros, pendientes, detalles o vistas.
- Solo el botón **Guardar** persiste textos, orden y visibilidad; **Fijar** persiste únicamente comentarios.
- Existe una sola plantilla por colección y su título no es editable.
- El flujo público usa Vercel con enlaces revocables creados desde Macintosh.
- Un enlace solo puede leer o editar las claves de reporte declaradas para su colección.
