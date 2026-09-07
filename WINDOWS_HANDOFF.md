# Continuidad de Macintosh Studio en Windows

Estado documentado el **7 de septiembre de 2026**. Lee primero [`README.md`](README.md)
y después este archivo. Para el backend y la IA, consulta
[`../Macintosh/README.md`](../Macintosh/README.md) y
[`../Macintosh/docs/WINDOWS_HANDOFF.md`](../Macintosh/docs/WINDOWS_HANDOFF.md).

## Qué contiene este proyecto

Macintosh Studio tiene dos superficies visualmente coherentes pero con fuentes de
datos distintas:

- `/`: biblioteca **Reportes**. Consume el contrato de tableros de Macintosh y puede
  mostrar publicaciones reales.
- `/studio`: editor **Studio**. Usa categorías, métricas, regiones, cursos y personas
  ficticias generadas en `lib/studio-demo-data.ts`.

La separación es una invariante. No debe resolverse una ausencia de datos en Studio
consultando `/api/dashboard`.

## Trabajo implementado

- El diseño de Studio reutiliza encabezado, catálogo, carátulas, filtros, hoja y
  escala del visor de Reportes.
- Los textos permitidos se editan directamente dentro de la hoja.
- El título editado se refleja en portada, menú y encabezado, pero conserva claves
  como `almacenista` en backend y rutas.
- Las secciones Presentación, Indicadores, Avance mensual, Ranking regional y Avance
  por curso se pueden reordenar y ocultar.
- El movimiento usa una transición FLIP para evitar saltos bruscos.
- El botón **Guardar** permanece gris sin cambios y se vuelve negro cuando cambia
  texto, orden o visibilidad. Antes de pulsarlo, todo permanece como borrador local.
- Los campos persistidos se limitan a la lista permitida por Macintosh, incluidos
  `layout.order` y `layout.hidden`.
- Los mensajes del servicio y las fechas de corte no son editables.
- El indicador de Studio dice **Datos de prueba**; nunca **Datos reales**.

## Archivos principales

- `app/page.tsx`: biblioteca, reporte, modo Studio, edición y guardado.
- `app/globals.css`: sistema visual, selección, movimiento y estados del botón.
- `lib/dashboard-data.ts`: cliente de Macintosh para Reportes y configuración editorial.
- `lib/studio-demo-data.ts`: única fuente de valores visibles en `/studio`.
- `scripts/share-studio.mjs`: Vinext, gateway restringido y proceso ngrok.
- `ngrok-traffic-policy.yml`: Google OAuth y restricción `@coppel.com`.
- `tests/rendered-html.test.mjs`: verificación de ambas rutas.

## Contrato de seguridad del túnel

El gateway:

1. redirige `/` a `/studio`;
2. rechaza navegación HTML fuera de `/studio`;
3. permite únicamente `GET` y `PUT` sobre
   `/api/studio/reports/{clave}/copy`;
4. bloquea catálogo, tableros, pendientes, detalles y vistas reales;
5. añade la clave privada editorial en el servidor local, nunca en el navegador;
6. oculta un authtoken si ngrok intenta imprimirlo en un error.

Cuando ya existe un servidor Vinext del mismo proyecto, el iniciador lee el lock
local, verifica la ruta y reutiliza su puerto. Esto evita el error de “another vinext
dev server is already running”.

## Preparación en Windows

Mantén la carpeta al lado de `Macintosh`:

```text
Proyectos\Macintosh
Proyectos\Macintosh Studio
```

Instala Node.js 22.13 o posterior y después ejecuta:

```powershell
cd "ruta\a\Proyectos\Macintosh Studio"
npm install
npm run dev
```

Para compartir desde Macintosh:

```text
studio share
studio status
studio stop
```

Para compartir directamente desde este proyecto, configura el mismo valor privado de
`MACINTOSH_STUDIO_TOKEN` en ambos entornos y usa `npm run studio:share`. La terminal
de Macintosh es preferible porque coordina una clave efímera automáticamente.

## Estado externo pendiente

- El último intento de ngrok produjo `ERR_NGROK_105`: la credencial guardada no era
  el authtoken válido del agente. Debe reemplazarse desde **Your Authtoken** en el
  panel de ngrok.
- El último entorno revisado no tenía la cuenta de servicio Firebase bajo
  `Macintosh/backend/.secrets/firebase-service-account.json`. Sin ella se conserva
  el borrador local, pero el botón no puede compartir la edición mediante Firebase.
- El repositorio contiene cambios locales sin commit. Transfiere la carpeta completa
  o crea y publica un commit deliberadamente antes de trabajar desde un clon nuevo.

## Validación

```powershell
npm run lint
npm test
```

Último resultado: build correcto, 2 pruebas correctas y lint sin errores. Persisten
tres advertencias conocidas por el uso intencional de `<img>` en reportes existentes.

## Reglas para la siguiente sesión

- Inspeccionar `git status` antes de editar y preservar cambios existentes.
- No desplegar este proyecto mediante Sites: el flujo acordado es local y ngrok.
- No introducir datos reales, nombres reales ni identificadores personales en demos o pruebas.
- No abrir rutas de dashboard en el gateway de Studio.
- No guardar automáticamente durante `blur`; solo el botón **Guardar** persiste.
- No cambiar claves técnicas cuando se editen títulos visibles.
- Actualizar README y este handoff si cambia el contrato de datos, guardado o túnel.
