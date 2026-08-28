# DataStore

Tablero web de capacitación conectado a los datos agregados que publica RunSQL
en Cloud Firestore.

## Funciones incluidas

- Selección individual o múltiple de categorías.
- Filtros por año, mes, uno o varios puestos, región y curso.
- Avance total, total asignado y pendientes.
- Tendencia mensual y ranking regional.
- Avance por curso con filtrado desde la propia tabla.
- Modo de colaboradores con panel lateral expandido.
- Búsqueda por nombre o número de persona.
- Detalle pendiente solicitado por bloques de región y puesto.
- Caché durante la sesión para evitar repetir lecturas de Firestore.
- Datos de demostración cuando Firebase todavía no tiene publicaciones o no
  permite la lectura.

## Iniciar el proyecto

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

La aplicación se abre normalmente en `http://localhost:3000`.

## Firebase

DataStore consulta Firestore mediante el backend local de RunSQL para mantener
la cuenta de servicio fuera del navegador y respetar las reglas privadas de la
base. La URL se configura con `NEXT_PUBLIC_RUNSQL_API_URL` y por defecto es
`http://localhost:8000`.

DataStore espera la estructura que genera RunSQL:

```text
periods/{AAAA-MM}/categories/{categoria}
├── view_chunks/{seccion_fragmento}
└── pending_chunks/{region_puesto_fragmento}

dashboard_categories/{categoria}
└── periods: resumen histórico
```

Cada fragmento tabular guarda `columns`, `row_count` y una lista plana
`values`. Esto evita arreglos anidados, que Firestore no permite. DataStore
mantiene compatibilidad de lectura con el formato anterior basado en `rows`.

Las gráficas cargan el cubo agregado. Los colaboradores se descargan solamente
cuando se abre ese modo y únicamente para las secciones seleccionadas. Los
documentos ya descargados quedan en caché durante la sesión.

## Seguridad

Los pendientes contienen información de colaboradores. No deben habilitarse
reglas públicas de lectura en Firestore. Antes de utilizar datos reales fuera de
un entorno controlado, se debe configurar Firebase Authentication y permitir
lecturas solo a usuarios autorizados.

## Validación

```bash
npm run build
npm test
```
