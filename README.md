# Macintosh Studio

> Para continuar desde Windows o desde una sesión nueva, lee primero
> [`WINDOWS_HANDOFF.md`](WINDOWS_HANDOFF.md). Contiene el estado vigente, las
> invariantes de datos y el pendiente de ngrok/Firebase.

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

Los reportes consultan la API local de Macintosh. Los planes de Tienda cargados en Macintosh salen directamente de su base local; los reportes complementarios, como Planes de capacitación, son recuperados por Macintosh desde Firebase. La cuenta de servicio permanece fuera del navegador. La URL se configura con `NEXT_PUBLIC_MACINTOSH_API_URL` y por defecto es `http://localhost:8010`.

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
- Edición directa de títulos y descripciones permitidos; fechas de corte y mensajes del servicio permanecen bloqueados.
- Edición directa del texto dentro de la hoja, sin un inspector separado.
- Botón **Guardar**: permanece gris sin cambios, se vuelve negro al editar y es la única acción que sincroniza con Macintosh.
- Persistencia compartida de textos, orden y visibilidad por reporte mediante Macintosh y Firebase; el navegador conserva un borrador temporal para tolerar desconexiones.
- Reordenamiento de secciones desde el catálogo mediante arrastre o controles accesibles.
- Visibilidad individual por sección, también guardada explícitamente.
- Vista previa sin herramientas de edición.

Studio reutiliza los mismos componentes, carátulas, navegación, textos base, filtros y dimensiones de Reportes. Los títulos y descripciones guardados se vuelven a leer desde Macintosh, por lo que Reportes muestra el mismo contenido en otras pestañas y computadoras conectadas. Cambiar el título actualiza el nombre visible en portada, catálogo y encabezado, pero conserva la clave técnica original en Macintosh.

## Iniciar Macintosh Studio

Requiere Node.js 22.13 o posterior y Macintosh iniciado.

```bash
npm install
npm run dev
```

- Reportes: `http://localhost:5175`
- Studio: `http://localhost:5175/studio`

## Compartir únicamente Studio con ngrok

Con ngrok instalado y autorizado:

```bash
npm run studio:share
```

También puede iniciarse desde la terminal de Macintosh con `studio share`. Los comandos
`studio status` y `studio stop` permiten consultar el enlace vigente y cerrarlo. La
ruta puede configurarse con `MACINTOSH_STUDIO_PATH`; si no se declara una clave,
Macintosh genera una clave efímera y la entrega únicamente al proceso que inicia.

El iniciador selecciona puertos disponibles, abre un túnel que entra por `/studio` y bloquea la navegación HTML hacia el área de Reportes. El enlace existe únicamente mientras el comando permanezca abierto. `Ctrl+C` apaga el túnel y la instancia local iniciada por el comando.

El túnel exige iniciar sesión con una cuenta Google de `coppel.com`. Solo reenvía a Macintosh la lectura y escritura de la configuración editorial; las rutas de tableros, pendientes, detalles y vistas reales quedan bloqueadas. Al usar `npm run studio:share` directamente, `MACINTOSH_STUDIO_TOKEN` debe tener el mismo valor privado en Macintosh y en el entorno local de Studio; el comando `studio share` de Macintosh coordina esa clave automáticamente.

Si aparece `ERR_NGROK_105`, la credencial guardada no es el authtoken del agente.
Copia el comando completo desde **Your Authtoken** en el panel de ngrok y vuelve a
ejecutar `ngrok config add-authtoken ...`; un API key, identificador de usuario o
inicio de sesión del navegador no sustituye ese valor.

Los valores de negocio visibles en `/studio` son siempre ficticios, tanto en local como mediante ngrok. La biblioteca normal de Reportes conserva su conexión separada con los datos publicados.

## Seguridad

Los colaboradores de prueba usan nombres e identificadores sintéticos. Firestore no se consulta directamente desde el navegador: Macintosh conserva la credencial, valida las rutas y limita los campos editables. El enlace temporal usa autenticación Google restringida al dominio corporativo.

## Continuar en Windows

Coloca `Macintosh` y `Macintosh Studio` como carpetas hermanas dentro del mismo directorio. Primero inicia Macintosh con `start-windows.bat`. Después puedes abrir Studio de dos formas:

```powershell
cd "..\Macintosh Studio"
npm install
npm run dev
```

o desde la terminal de Macintosh:

```text
studio share
studio status
studio stop
```

Para compartir necesitas Node.js 22.13 o posterior, ngrok instalado y una cuenta de ngrok autorizada. El valor predeterminado de `MACINTOSH_STUDIO_PATH` funciona cuando ambas carpetas son hermanas; si cambias la ubicación, declara la ruta completa en `Macintosh\backend\.env`.

## Validación

```bash
npm run build
npm test
```
