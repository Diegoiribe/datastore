# Instrucciones para agentes de programación

Antes de analizar o modificar este repositorio, lee completos `README.md` y
`WINDOWS_HANDOFF.md`. Después consulta `../Macintosh/README.md` y
`../Macintosh/docs/WINDOWS_HANDOFF.md` cuando el cambio toque API, persistencia,
Firebase, terminal o ngrok.

Inspecciona `git status` antes de editar y preserva los cambios existentes del
usuario. No incluyas secretos, tokens, credenciales, URLs privadas ni datos reales
en código, Git, pruebas o respuestas.

Invariantes esenciales:

- `/` puede consumir publicaciones reales mediante Macintosh.
- `/studio` usa exclusivamente `lib/studio-demo-data.ts` para valores visibles.
- El gateway de ngrok nunca permite rutas de tableros, pendientes, detalles o vistas.
- Solo el botón **Guardar** persiste textos, orden y visibilidad.
- El título visible puede cambiar; la clave técnica del reporte permanece estable.
- El flujo acordado de publicación temporal es local más ngrok, no Sites.
