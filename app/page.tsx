"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CategoryDashboard,
  MetricRow,
  PendingRow,
  listCategories,
  loadCategoryDashboard,
  loadPendingSection,
} from "../lib/dashboard-data";

type CategoryOption = { key: string; label: string };

const fallbackCategories: CategoryOption[] = [
  { key: "almacenista", label: "Almacenista" },
  { key: "asesor", label: "Asesor" },
  { key: "cajero", label: "Cajero" },
  { key: "cobranza", label: "Cobranza" },
  { key: "gerente", label: "Gerente" },
  { key: "gerente_zona", label: "Gerente zona" },
  { key: "staff", label: "STAFF" },
];

const fallbackMetrics: MetricRow[] = [
  ["Almacenista", "Noroeste", "Seguridad en tienda", 820, 741],
  ["Almacenista", "Centro", "Seguridad en tienda", 760, 646],
  ["Gerente Ventas", "Noroeste", "Liderazgo operativo", 540, 465],
  ["Gerente Muebles", "Occidente", "Liderazgo operativo", 430, 331],
  ["Asesor Ventas", "Noreste", "Experiencia del cliente", 980, 714],
  ["Cajero", "Centro", "Prevención de fraudes", 610, 451],
].map(([puesto, region, curso, total, completados]) => ({
  puesto: String(puesto),
  region: String(region),
  curso: String(curso),
  total: Number(total),
  completados: Number(completados),
  pendientes: Number(total) - Number(completados),
  avance: Math.round((Number(completados) / Number(total)) * 10_000) / 100,
}));

const fallbackPending: PendingRow[] = [
  { numero_persona: "104582", nombre: "Ana Sofía López", puesto: "Almacenista", region: "Noroeste", tienda: "1517", curso: "Seguridad en tienda" },
  { numero_persona: "108341", nombre: "Luis Alberto Ruiz", puesto: "Gerente Ventas", region: "Noroeste", tienda: "1538", curso: "Liderazgo operativo" },
  { numero_persona: "112907", nombre: "Mariana Pérez", puesto: "Asesor Ventas", region: "Noreste", tienda: "6882", curso: "Experiencia del cliente" },
  { numero_persona: "117236", nombre: "Carlos Medina", puesto: "Cajero", region: "Centro", tienda: "6848", curso: "Prevención de fraudes" },
];

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function sumRows(rows: MetricRow[]) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const completed = rows.reduce((sum, row) => sum + row.completados, 0);
  return {
    total,
    completed,
    pending: total - completed,
    progress: total ? Math.round((completed / total) * 10_000) / 100 : 0,
  };
}

function groupMetrics(rows: MetricRow[], key: "region" | "curso") {
  const groups = new Map<string, MetricRow[]>();
  rows.forEach((row) => groups.set(row[key], [...(groups.get(row[key]) ?? []), row]));
  return [...groups].map(([label, values]) => ({ label, ...sumRows(values) })).sort((a, b) => b.progress - a.progress);
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange(value: string): void }) {
  return (
    <label className="select-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">Todos</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function Home() {
  const [categories, setCategories] = useState(fallbackCategories);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["almacenista"]);
  const [dashboards, setDashboards] = useState<CategoryDashboard[]>([]);
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("7");
  const [region, setRegion] = useState("all");
  const [course, setCourse] = useState("all");
  const [positions, setPositions] = useState<string[]>([]);
  const [peopleMode, setPeopleMode] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [pendingRows, setPendingRows] = useState<PendingRow[]>(fallbackPending);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const period = `${year}-${month.padStart(2, "0")}`;

  useEffect(() => {
    listCategories()
      .then((items) => {
        if (items.length) {
          setCategories(items.map(({ key, label }) => ({ key, label })));
          setSelectedCategories((current) => current.filter((key) => items.some((item) => item.key === key)).length ? current : [items[0].key]);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedCategories.length) {
      setDashboards([]);
      setUsingDemo(true);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    Promise.all(selectedCategories.map((category) => loadCategoryDashboard(category, period)))
      .then((loaded) => {
        if (!active) return;
        setDashboards(loaded);
        setUsingDemo(false);
        setLastSyncAt(new Date());
      })
      .catch(() => {
        if (!active) return;
        setDashboards([]);
        setUsingDemo(true);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [period, selectedCategories]);

  const sourceMetrics = !selectedCategories.length ? [] : dashboards.length ? dashboards.flatMap((item) => item.metrics) : fallbackMetrics;
  const availablePositions = useMemo(() => [...new Set(sourceMetrics.map((row) => row.puesto))].sort(), [sourceMetrics]);
  const availableRegions = useMemo(() => [...new Set(sourceMetrics.map((row) => row.region))].sort(), [sourceMetrics]);
  const availableCourses = useMemo(() => [...new Set(sourceMetrics.map((row) => row.curso))].sort(), [sourceMetrics]);
  const filteredMetrics = sourceMetrics.filter((row) =>
    (!positions.length || positions.includes(row.puesto)) &&
    (region === "all" || row.region === region) &&
    (course === "all" || row.curso === course),
  );
  const totals = sumRows(filteredMetrics);
  const regionalRanking = groupMetrics(filteredMetrics, "region");
  const courseProgress = groupMetrics(filteredMetrics, "curso");

  const history = useMemo(() => {
    const grouped = new Map<string, { total: number; completed: number }>();
    dashboards.forEach((dashboard) => Object.entries(dashboard.history).forEach(([key, value]) => {
      const current = grouped.get(key) ?? { total: 0, completed: 0 };
      current.total += value.total;
      current.completed += value.completed;
      grouped.set(key, current);
    }));
    const real = [...grouped].filter(([key]) => key.startsWith(`${year}-`)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
      label: months[Number(key.slice(5)) - 1]?.slice(0, 3) ?? key,
      value: value.total ? Math.round((value.completed / value.total) * 1000) / 10 : 0,
    }));
    return real.length ? real : [58, 63, 66, 71, 74, 78].map((value, index) => ({ label: ["Feb", "Mar", "Abr", "May", "Jun", "Jul"][index], value }));
  }, [dashboards, year]);

  const resetCategoryFilters = () => {
    setPositions([]);
    setRegion("all");
    setCourse("all");
    setNameQuery("");
    setShowAllRegions(false);
    setShowAllCourses(false);
  };

  const selectCategory = (key: string) => {
    resetCategoryFilters();
    setSelectedCategories([key]);
  };

  const addCategoryToSharedView = (key: string) => {
    setSelectedCategories((current) => current.includes(key) ? current : [...current, key]);
  };

  const togglePosition = (value: string) => {
    setPositions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const loadPeople = async () => {
    if (!dashboards.length) { setPendingRows(fallbackPending); return; }
    setLoadingPending(true);
    setPendingError("");
    try {
      const requests = dashboards.flatMap((dashboard) => dashboard.pendingSections
        .filter((section) => (region === "all" || section.region === region) && (!positions.length || positions.includes(section.position)))
        .map((section) => loadPendingSection(dashboard, section)));
      setPendingRows((await Promise.all(requests)).flat());
    } catch (error) {
      setPendingRows([]);
      setPendingError(
        error instanceof Error ? error.message : "No se pudo cargar el detalle.",
      );
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => { if (peopleMode) void loadPeople(); }, [peopleMode, dashboards, region, positions]);

  const visiblePending = pendingRows.filter((row) =>
    (!nameQuery || `${row.nombre} ${row.numero_persona}`.toLocaleLowerCase("es").includes(nameQuery.toLocaleLowerCase("es"))) &&
    (region === "all" || row.region === region) &&
    (course === "all" || row.curso === course) &&
    (!positions.length || positions.includes(row.puesto)),
  );

  const selectedLabel = !selectedCategories.length
    ? "Selecciona una categoría"
    : categories.length > 1 && selectedCategories.length === categories.length
      ? "Todas las categorías"
      : categories.filter((item) => selectedCategories.includes(item.key)).map((item) => item.label).join(", ");
  const syncLabel = loading ? "Sincronizando…" : usingDemo ? "Sin datos" : "Sincronizado";
  const syncTitle = loading
    ? "Consultando Firebase"
    : usingDemo
      ? "No se encontraron datos publicados para los filtros seleccionados"
      : `Última sincronización: ${lastSyncAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "ahora"}`;

  return (
    <div className="site-page">
      <header className="site-header">
        <strong>DataStore</strong>
        <nav aria-label="Navegación principal">
          <button className="active">Reportes</button>
        </nav>
        <span className={`sync-status ${loading ? "loading" : usingDemo ? "empty" : "synced"}`} title={syncTitle}>
          <i /> {syncLabel}
        </span>
      </header>

      <section className="page-intro">
        <h1>Reportes</h1>
        <p>Consulta el avance mensual, compara regiones y encuentra cursos pendientes.</p>
      </section>

    <main className="workspace-shell">
      <aside className="filter-rail">
        <header className="rail-heading">
          <div><span className="eyebrow">BIBLIOTECA</span><h1>Categorías</h1></div>
          <span className={`data-dot ${loading ? "loading" : usingDemo ? "empty" : "synced"}`} title={syncTitle} />
        </header>

        <div className="rail-section-title"><span>Categorías</span><small>{selectedCategories.length} {selectedCategories.length === 1 ? "activa" : "activas"}</small></div>
        <nav className="category-list" aria-label="Categorías del reporte">
          {categories.length > 1 && (
            <button className={selectedCategories.length === categories.length ? "category active" : "category"} onClick={() => { resetCategoryFilters(); setSelectedCategories((current) => current.length === categories.length ? [] : categories.map((item) => item.key)); }}>
              <span className="all-icon">•••</span><span>Todas las categorías</span><b>{selectedCategories.length === categories.length ? "✓" : ""}</b>
            </button>
          )}
          {categories.map((category) => (
            <button
              className={selectedCategories.includes(category.key) ? "category active" : "category"}
              key={category.key}
              onClick={() => selectCategory(category.key)}
              onContextMenu={(event) => { event.preventDefault(); addCategoryToSharedView(category.key); }}
            >
              <span className="doc-icon"><i /><i /><i /></span><span>{category.label}</span><b>{selectedCategories.includes(category.key) ? "✓" : ""}</b>
            </button>
          ))}
        </nav>

      </aside>

      <section className="report-space">
        <header className="topbar">
          <div className="report-name"><span className="mini-doc"><i /><i /><i /></span><span><strong title={selectedLabel}>{selectedLabel}</strong><small>Reporte mensual · {period}</small></span></div>
          <span className={`status-pill ${loading ? "loading" : usingDemo ? "empty" : "synced"}`} title={syncTitle}>{syncLabel}</span>
        </header>

        <div className="report-scroll">
          <article className="sheet">
            <header className="sheet-title">
              <div><span className="eyebrow">{peopleMode ? "CURSOS PENDIENTES" : "DOCUMENTO DE RESULTADOS"}</span><h2>{peopleMode ? "Detalle por colaborador" : "Reporte de capacitación"}</h2></div>
            </header>

            <div className={peopleMode ? "sheet-toolbar people" : "sheet-toolbar"} aria-label="Filtros del reporte">
              {peopleMode ? (
                <>
                  <label className="toolbar-search"><span>Buscar</span><i>⌕</i><input autoFocus value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} placeholder="Nombre o número de persona" /></label>
                  <details className="position-filter"><summary>Puestos {positions.length ? `· ${positions.length}` : ""}</summary><div>{availablePositions.map((item) => <label key={item}><input type="checkbox" checked={positions.includes(item)} onChange={() => togglePosition(item)} />{item}</label>)}</div></details>
                  <SelectFilter label="Región" value={region} options={availableRegions} onChange={setRegion} />
                  <SelectFilter label="Curso" value={course} options={availableCourses} onChange={setCourse} />
                  <button className="toolbar-people active" onClick={() => setPeopleMode(false)} aria-label="Volver al reporte" title="Volver al reporte"><span className="close-icon" aria-hidden="true" /></button>
                </>
              ) : (
                <>
                  <label><span>Año</span><select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option></select></label>
                  <label><span>Mes</span><select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((item, index) => <option value={String(index + 1)} key={item}>{item}</option>)}</select></label>
                  <details className="position-filter"><summary>Puestos {positions.length ? `· ${positions.length}` : ""}</summary><div>{availablePositions.map((item) => <label key={item}><input type="checkbox" checked={positions.includes(item)} onChange={() => togglePosition(item)} />{item}</label>)}</div></details>
                  <SelectFilter label="Región" value={region} options={availableRegions} onChange={setRegion} />
                  <SelectFilter label="Curso" value={course} options={availableCourses} onChange={setCourse} />
                  <button className="toolbar-people" onClick={() => setPeopleMode(true)} aria-label="Buscar colaboradores" title="Buscar colaboradores">◎</button>
                </>
              )}
            </div>

            <section className="report-lead">
              <h3>{selectedLabel}</h3>
              <p>{peopleMode ? "Listado de colaboradores con uno o más cursos pendientes según los filtros seleccionados." : "Concentrado mensual de avance, asignaciones y pendientes. Los indicadores se actualizan con la información publicada desde RunSQL."}</p>
              <small>{usingDemo ? "Aún no hay datos sincronizados para este periodo. Publica la información desde RunSQL." : `Fecha de corte del periodo ${period}.`}</small>
            </section>

            {!peopleMode ? (
              <>
                <section className="metric-grid">
                  <article><span>Avance total</span><strong>{totals.progress.toFixed(1)}%</strong><small>{totals.completed.toLocaleString("es-MX")} completados</small></article>
                  <article><span>Total asignado</span><strong>{totals.total.toLocaleString("es-MX")}</strong><small>{filteredMetrics.length.toLocaleString("es-MX")} combinaciones</small></article>
                  <article><span>Pendientes</span><strong>{totals.pending.toLocaleString("es-MX")}</strong><small>{(100 - totals.progress).toFixed(1)}% del total</small></article>
                </section>

                <section className="dashboard-grid">
                  <article className="panel chart-panel">
                    <div className="panel-heading"><div><span>Avance mensual</span><small>Comparativo del año</small></div><b>{totals.progress.toFixed(1)}%</b></div>
                    <div className="bars" aria-label="Gráfica de avance mensual">{history.map((item) => <div className="bar-column" key={item.label}><em>{item.value}%</em><div style={{ height: `${Math.max(item.value, 4)}%` }} /><small>{item.label}</small></div>)}</div>
                  </article>
                  <article className="panel ranking-panel">
                    <div className="panel-heading"><div><span>Ranking regional</span><small>Avance promedio</small></div></div>
                    {regionalRanking.slice(0, 5).map((item, index) => <div className="rank-row" key={item.label}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.label}</span><strong>{item.progress.toFixed(1)}%</strong></div>)}
                    <div className={showAllRegions ? "expandable-section is-open" : "expandable-section"}><div>{regionalRanking.slice(5).map((item, index) => <div className="rank-row" key={item.label}><b>{String(index + 6).padStart(2, "0")}</b><span>{item.label}</span><strong>{item.progress.toFixed(1)}%</strong></div>)}</div></div>
                    {regionalRanking.length > 5 && <button className="show-more-button" onClick={() => setShowAllRegions((current) => !current)}><span>{showAllRegions ? "Mostrar menos" : `Ver ${regionalRanking.length - 5} más`}</span><span className="more-icon-shell" aria-hidden="true"><i className={showAllRegions ? "more-icon collapse" : "more-icon"} /></span></button>}
                  </article>
                  <article className="panel course-panel">
                    <div className="panel-heading"><div><span>Avance por curso</span><small>Selecciona un curso para filtrar</small></div></div>
                    <div className="course-table">{courseProgress.slice(0, 7).map((item) => <button key={item.label} onClick={() => setCourse(item.label)}><span>{item.label}<small>{item.completed.toLocaleString("es-MX")} de {item.total.toLocaleString("es-MX")}</small></span><i><b style={{ width: `${item.progress}%` }} /></i><strong>{item.progress.toFixed(1)}%</strong></button>)}<div className={showAllCourses ? "expandable-section is-open" : "expandable-section"}><div>{courseProgress.slice(7).map((item) => <button key={item.label} onClick={() => setCourse(item.label)}><span>{item.label}<small>{item.completed.toLocaleString("es-MX")} de {item.total.toLocaleString("es-MX")}</small></span><i><b style={{ width: `${item.progress}%` }} /></i><strong>{item.progress.toFixed(1)}%</strong></button>)}</div></div></div>
                    {courseProgress.length > 7 && <button className="show-more-button" onClick={() => setShowAllCourses((current) => !current)}><span>{showAllCourses ? "Mostrar menos" : `Ver ${courseProgress.length - 7} más`}</span><span className="more-icon-shell" aria-hidden="true"><i className={showAllCourses ? "more-icon collapse" : "more-icon"} /></span></button>}
                  </article>
                </section>
              </>
            ) : (
              <section className="people-results">
                <div className={pendingError ? "people-summary error" : "people-summary"}><span>{loadingPending ? "Cargando colaboradores…" : pendingError || `${visiblePending.length.toLocaleString("es-MX")} pendientes encontrados`}</span><small>{pendingError ? "Verifica que el backend local de RunSQL esté encendido." : "La búsqueda utiliza únicamente los bloques de las secciones elegidas."}</small></div>
                <div className="people-table"><div className="people-table-head"><span>Colaborador</span><span>Puesto</span><span>Región</span><span>Curso pendiente</span></div>{visiblePending.slice(0, 100).map((person, index) => <div className="person-row" key={`${person.numero_persona}-${person.curso}-${index}`}><span><b>{person.nombre}</b><small>{person.numero_persona} · Tienda {person.tienda ?? "—"}</small></span><span>{person.puesto}</span><span>{person.region}</span><span>{person.curso}</span></div>)}</div>
              </section>
            )}
          </article>
        </div>
      </section>
    </main>
    </div>
  );
}
