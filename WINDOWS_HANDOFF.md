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
- Los textos permitidos se editan directamente dentro de la hoja; el título de la colección no se edita.
- Tienda, Staff, Cobranza y Capacitación especializada usan una sola plantilla
  visual por colección aunque sus reportes de datos conserven claves independientes.
- Capacitación especializada conserva la plantilla financiera EIC del antiguo
  DataStore. En `/studio` sus 16 vistas se simulan en
  `lib/studio-demo-data.ts`; en `/` proceden de la receta local `eic_maestro` de Macintosh.
- Tienda, Staff y Cobranza permiten reordenar y ocultar Presentación, Indicadores,
  Avance mensual, Ranking regional y Avance por curso. Capacitación especializada
  usa diez bloques propios de la plantilla EIC, desde Presentación hasta Planes y
  capacitaciones.
- Reportes carga y aplica el mismo `layout.order` y `layout.hidden` persistido por
  Studio; el orden editorial no queda limitado a la vista de edición.
- La plantilla EIC admite edición directa de sus títulos, subtítulos, etiquetas
  financieras y presentación; no solo orden y visibilidad.
- El flujo operativo EIC usa cuatro gráficas de pastel: Cotizaciones,
  Capacitaciones, Contratación y Pagos. Cada leyenda controla por
  hover y teclado el segmento destacado y reemplaza temporalmente el total por su
  porcentaje.
- El movimiento usa una transición FLIP para evitar saltos bruscos.
- El botón **Guardar** permanece gris sin cambios y se vuelve negro cuando cambia
  texto, orden o visibilidad. Antes de pulsarlo, todo permanece como borrador local.
- Los campos persistidos se limitan a la lista permitida por Macintosh, incluidos
  `layout.order` y `layout.hidden`.
- Los mensajes del servicio y las fechas de corte no son editables.
- El indicador de Studio dice **Datos de prueba**; nunca **Datos reales**.
- El clic derecho dentro de la hoja abre un compositor de comentario. Los
  comentarios se fijan inmediatamente, usan coordenadas relativas para acompañar
  el scroll y aparecen al hacer hover o foco sobre el pin. Al hacer clic la tarjeta
  permanece abierta y permite completar el comentario o eliminarlo.
- Los comentarios nuevos se anclan al bloque donde nacieron y viajan con él al
  reordenar. Los registros anteriores con un bloque identificado también viajan
  con él mediante una conversión compatible en el navegador.

## Archivos principales

- `app/page.tsx`: biblioteca, reporte, modo Studio, edición y guardado.
- `app/globals.css`: sistema visual, selección, movimiento y estados del botón.
- `lib/dashboard-data.ts`: cliente de Macintosh para Reportes y configuración editorial.
- `lib/studio-demo-data.ts`: única fuente de valores visibles en `/studio`.
- `lib/vercel-studio-store.ts`: validación de enlaces, alcance y campos en Vercel.
- `app/api/studio/share/session/route.ts`: sesión pública limitada por colección.
- `app/api/studio/reports/[reportKey]/copy/route.ts`: lectura y guardado editorial.
- `proxy.ts`: redirección de `/` a `/studio` únicamente en Vercel.
- `tests/rendered-html.test.mjs`: verificación de ambas rutas.

## Contrato de seguridad de Vercel

- `/` redirige a `/studio` en el despliegue público.
- Una URL sin credencial vigente muestra acceso rechazado.
- La credencial se guarda en Firestore solamente como hash y vence en siete días.
- El servidor valida la colección y la clave técnica en cada `GET` y `PUT`.
- No existen endpoints públicos para tableros, pendientes, detalles o vistas reales.
- El navegador recibe datos sintéticos y configuración editorial; nunca una cuenta de servicio.
- El botón **Guardar** sigue siendo la única acción que persiste cambios.
- **Fijar** persiste únicamente un comentario; no guarda borradores editoriales.

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

Para administrar enlaces desde Macintosh:

```text
studio tienda share
studio staff share
studio cobranza share
studio capacitación especializada share
studio status
studio stop
```

No se instala ngrok en Windows. Los enlaces apuntan al mismo despliegue de Vercel y
solo cambia la credencial y el alcance almacenados por Macintosh.

## Estado externo

- Vercel está enlazado al proyecto `macintosh-studio` y el dominio estable es
  `https://macintosh-studio.vercel.app`.
- `MACINTOSH_FIREBASE_SERVICE_ACCOUNT_JSON` está cargado como secreto cifrado de
  producción. No puede recuperarse mediante `vercel env pull`.
- La prueba de extremo a extremo confirmó que un enlace de Tienda abre sus reportes,
  rechaza Staff y puede revocarse sin afectar otros enlaces.
- La API de comentarios confirmó creación y lectura compartidas; el comentario y el
  enlace usados para la prueba se eliminaron al finalizar.
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
- El flujo público acordado es Vercel; no reintroducir ngrok como ruta predeterminada.
- No introducir datos reales, nombres reales ni identificadores personales en demos o pruebas.
- No abrir rutas de dashboard en el gateway de Studio.
- No guardar automáticamente durante `blur`; solo el botón **Guardar** persiste.
- No volver editable el título de la colección ni crear una plantilla por puesto.
- Actualizar README y este handoff si cambia el contrato de datos, guardado o túnel.
