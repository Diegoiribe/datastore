# Macintosh Studio

> Para continuar desde Windows o desde una sesión nueva, lee primero
> [`WINDOWS_HANDOFF.md`](WINDOWS_HANDOFF.md). Contiene el estado vigente, las
> invariantes de datos y el despliegue de Vercel/Firebase.

Macintosh Studio reúne dos espacios del mismo producto:

- **Reportes:** biblioteca y consulta de tableros publicados.
- **Studio:** composición visual de reportes mediante secciones editables y reordenables.

La lógica se mantiene separada para que el visor pueda seguir consumiendo datos publicados y Studio pueda evolucionar como editor sin mezclar responsabilidades.

## Reportes

- Selección individual o múltiple de categorías.
- Filtros por año, mes, uno o varios puestos, región y curso.
- Avance total, total asignado y pendientes.
- Tendencia mensual, ranking regional y avance por curso.
- Búsqueda de colaboradores y consulta de cursos pendientes.
- Reportes de satisfacción y capacitación especializada.
- Caché durante la sesión para evitar lecturas repetidas.
- Estado vacío explícito cuando no hay publicaciones disponibles.

Los reportes consultan la API local de Macintosh. Los planes de Tienda y
Capacitación especializada cargados con `eic_maestro` salen directamente de su
base local; Firebase queda como compatibilidad para categorías complementarias
que todavía no se hayan migrado. La cuenta de servicio permanece fuera del
navegador. La URL se configura con `NEXT_PUBLIC_MACINTOSH_API_URL` y por defecto
es `http://localhost:8010`.

Macintosh Studio recibe desde Macintosh la estructura publicada de reportes:

```text
periods/{AAAA-MM}/categories/{categoria}
├── view_chunks/{seccion_fragmento}
└── pending_chunks/{region_puesto_fragmento}

dashboard_categories/{categoria}
└── periods: resumen histórico
```

Cada fragmento tabular guarda `columns`, `row_count` y una lista plana `values`. Se conserva compatibilidad con el formato anterior basado en `rows`.

## Studio

Studio está disponible en `/studio` e incluye:

- Un conjunto determinista de categorías, métricas, regiones, cursos y colaboradores ficticios. `/studio` nunca solicita los tableros reales de Macintosh.
- La plantilla financiera EIC heredada del antiguo DataStore, alimentada en
  Studio por presupuesto, áreas, iniciativas y personas completamente ficticias.
- Una sola plantilla visual por colección. Los títulos de colección, fechas de corte y mensajes del servicio permanecen bloqueados.
- Edición directa del texto dentro de la hoja, sin un inspector separado.
- Botón **Guardar**: permanece gris sin cambios, se vuelve negro al editar y es la única acción que sincroniza con Macintosh.
- Persistencia compartida de textos, orden y visibilidad por reporte mediante Macintosh y Firebase; el navegador conserva un borrador temporal para tolerar desconexiones.
- Reordenamiento de secciones desde el catálogo mediante arrastre o controles accesibles. Reportes lee y aplica el mismo `layout.order` y `layout.hidden` guardado por Studio.
- Visibilidad individual por sección, también guardada explícitamente.
- Capacitación especializada expone sus diez bloques EIC reales en Studio: presentación, indicadores financieros, resumen presupuestal, plan autorizado, distribución, presupuesto por categoría, ranking de colaboradores, flujo operativo, detalle por área y planes/capacitaciones. No reutiliza el catálogo genérico de cinco bloques de Tienda.
- Sus títulos, subtítulos, etiquetas financieras y texto de presentación se editan directamente dentro de la hoja y se guardan con la colección.
- El flujo operativo representa Cotizaciones, Capacitaciones, Contratación y Pagos con gráficas de pastel interactivas. Contratación lee los cuatro estados canónicos de `Capacitaciones en seguimiento`. Hover o foco sobre una leyenda destaca su segmento y muestra el porcentaje correspondiente.
- Vista previa sin herramientas de edición.
- Comentarios compartidos fijados con clic derecho únicamente dentro de la hoja;
  los pines acompañan el scroll y muestran su texto al pasar el cursor. Un clic
  mantiene abierta la tarjeta para marcarla como completada o eliminarla. Los
  comentarios nuevos guardan su posición dentro del bloque seleccionado y se
  desplazan con él al reordenar. Los anteriores aprovechan su ancla guardada para
  acompañar al bloque sin reescribir el registro histórico.

Studio reutiliza los mismos componentes, carátulas, navegación, textos base, filtros y dimensiones de Reportes. Cada colección guarda una sola composición compartida por todos sus reportes. Los textos guardados se vuelven a leer desde Macintosh, por lo que Reportes muestra el mismo contenido en otras pestañas y computadoras conectadas; el nombre de la colección no se edita.

## Iniciar Macintosh Studio

Requiere Node.js 22.13 o posterior y Macintosh iniciado.

```bash
npm install
npm run dev
```

- Reportes: `http://localhost:5175`
- Studio: `http://localhost:5175/studio`

## Compartir Studio con Vercel

Existe un solo despliegue en `https://macintosh-studio.vercel.app`. Los enlaces se
crean desde la terminal de Macintosh y caducan después de siete días:

```text
studio tienda share
studio staff share
studio cobranza share
studio capacitación especializada share
studio share
studio status
studio tienda stop
studio stop
```

Cada URL contiene una credencial aleatoria. Vercel valida su hash, vigencia y colección
antes de leer o guardar configuración editorial. Tienda guarda su composición bajo
la clave de colección `tienda`; las recetas `almacenista`, `asesor`, `cajero`, `gerente`
y `gerente_zona` siguen separadas únicamente en datos. Cambiar la URL manualmente no
concede acceso a Staff, Cobranza o Capacitación especializada. `studio stop` revoca todos
los enlaces y la variante con colección revoca solamente ese alcance.

El enlace no solicita Google ni otra cuenta. Cualquiera que lo posea puede editar la
colección autorizada hasta que expire o sea revocado, por lo que debe tratarse como
una contraseña temporal. Los valores visibles siguen siendo ficticios.

Para desplegar una versión nueva:

```bash
npm install
npm run build
npm run deploy
```

El proyecto de Vercel requiere `MACINTOSH_FIREBASE_SERVICE_ACCOUNT_JSON` como secreto
cifrado de producción. Su valor es el JSON completo de la cuenta de servicio que usa
Macintosh; nunca debe guardarse en `.env.local`, Git, documentación o capturas.

El flujo anterior de ngrok se conserva únicamente como alternativa futura mediante
`npm run studio:share:ngrok`; no forma parte de la operación normal.

## Seguridad

Los colaboradores de prueba usan nombres e identificadores sintéticos. Firestore no
se consulta directamente desde el navegador: las funciones de Vercel conservan la
credencial, validan el enlace y limitan los campos editables. No hay autenticación
Google en el flujo público actual.

## Continuar en Windows

Coloca `Macintosh` y `Macintosh Studio` como carpetas hermanas dentro del mismo directorio. Primero inicia Macintosh con `start-windows.bat`. Después puedes abrir Studio de dos formas:

```powershell
cd "..\Macintosh Studio"
npm install
npm run dev
```

Los enlaces compartidos no requieren que Studio esté ejecutándose en Windows. Se
administran desde la terminal de Macintosh:

```text
studio tienda share
studio status
studio stop
```

La computadora local necesita la cuenta de servicio configurada en Macintosh para
crear o revocar enlaces. Vercel mantiene la aplicación publicada de forma independiente.

## Validación

```bash
npm run build
npm test
```
