"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CategoryDashboard,
  MetricRow,
  PendingRow,
  PeriodSummary,
  listCategories,
  loadCategoryDashboard,
  loadPendingSection,
} from "../lib/dashboard-data";
import SatisfactionReport from "./SatisfactionReport";
import PopupFilter, { useDelayedPanelClose } from "./ToolbarPopupFilter";

type CategoryOption = { key: string; label: string; history?: Record<string, PeriodSummary> };

const tiendaChapterKeys = ["almacenista", "asesor", "cajero", "gerente", "gerente_zona"];
const tiendaCategory: CategoryOption = { key: "tienda", label: "Tienda" };
const tiendaAccentOptions = [
  { key: "institutional", label: "Institucional", accent: "#F0D224", secondary: "#1C42E8", deep: "#081754", action: "#1C42E8", swatch: "linear-gradient(90deg, #F0D224 0 33%, #1C42E8 33% 66%, #081754 66% 100%)" },
  { key: "institutional_light", label: "Institucional clara", accent: "#F0D224", secondary: "#1C42E8", deep: "#081754", action: "#1C42E8", swatch: "linear-gradient(90deg, #F0D224 0 50%, #1C42E8 50% 76%, #081754 76% 100%)" },
  { key: "institutional_blue", label: "Institucional azul", accent: "#1C42E8", secondary: "#F0D224", deep: "#081754", action: "#1C42E8", swatch: "linear-gradient(90deg, #F0D224 0 26%, #1C42E8 26% 70%, #081754 70% 100%)" },
  { key: "institutional_sky", label: "Institucional cielo", accent: "#1CA8F7", secondary: "#1C42E8", deep: "#081754", action: "#1C42E8", swatch: "linear-gradient(90deg, #F0D224 0 28%, #1CA8F7 28% 62%, #1C42E8 62% 100%)" },
  { key: "solar", label: "Solar", accent: "#F0D224", secondary: "#081754", deep: "#081754", action: "#081754", swatch: "linear-gradient(90deg, #F0D224 0 46%, #081754 46% 76%, #1CA8F7 76% 100%)" },
  { key: "solar_blue", label: "Solar azul", accent: "#1C42E8", secondary: "#F0D224", deep: "#081754", action: "#081754", swatch: "linear-gradient(90deg, #F0D224 0 38%, #081754 38% 66%, #1C42E8 66% 100%)" },
];

function textKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
}

function reportFamily(category: CategoryOption) {
  if (category.key === "tienda") return { label: "Colección", description: "Cinco capítulos del equipo de Tienda" };
  if (category.key === "encuesta_de_satisfaccion") return { label: "Experiencia", description: "Satisfacción, recomendación y voz del participante" };
  if (category.key === "staff") return { label: "Talento", description: "Seguimiento de capacitación corporativa" };
  return { label: "Avance", description: "Cumplimiento, asignaciones y cursos pendientes" };
}

function reportTone(key: string) {
  const preferred: Record<string, string> = {
    almacenista: "cobalt", asesor: "forest", cajero: "coral", cobranza: "ink",
    encuesta_de_satisfaccion: "violet", gerente: "sand", gerente_zona: "ink", staff: "cobalt",
  };
  if (preferred[key]) return preferred[key];
  const tones = ["ink", "cobalt", "violet", "coral", "sand", "forest"];
  return tones[[...key].reduce((total, character) => total + character.charCodeAt(0), 0) % tones.length];
}

function latestSharedPeriod(items: CategoryOption[]) {
  const histories = items.map((item) => Object.keys(item.history ?? {}));
  if (!histories.length || histories.some((periods) => !periods.length)) return undefined;
  return histories[0].filter((period) => histories.every((periods) => periods.includes(period))).sort().at(-1);
}

const ReportCover = memo(function ReportCover({ category, compact = false }: { category: CategoryOption; compact?: boolean }) {
  const family = reportFamily(category);
  const coverArtwork = {
    almacenista: "/report-covers/almacenista-v2.png",
    asesor: "/report-covers/asesor-v1.png",
    cajero: "/report-covers/cajero-v2.png",
    encuesta_de_satisfaccion: "/report-covers/encuesta-satisfaccion-v2.png",
    gerente: "/report-covers/gerente-v1.png",
    tienda: "/report-covers/asesor-v1.png",
  }[category.key] ?? null;
  const artwork = compact && tiendaChapterKeys.includes(category.key) ? null : coverArtwork;
  return <span className={`report-cover ${compact ? "compact " : ""}${artwork ? `has-artwork artwork-${category.key}` : `tone-${reportTone(category.key)}`}`} style={artwork ? { backgroundImage: `url(${artwork})` } : undefined} aria-hidden="true">
    <span className="cover-rule" />
    <small>{family.label}</small>
    <strong>{category.label}</strong>
    <i>UC</i>
    <em>Universidad Corporativa Coppel</em>
  </span>;
});

function TiendaBookCover({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? "tienda-book-cover compact" : "tienda-book-cover"}>
    <ReportCover category={tiendaCategory} compact={compact} />
    <span className="book-index-tabs" aria-hidden="true">
      {tiendaChapterKeys.map((key, index) => <i key={key}>{String(index + 1).padStart(2, "0")}</i>)}
    </span>
  </span>;
}

function LibraryFooter() {
  return <footer className="library-footer">
    <div className="footer-signature">
      <span><small>Diseñado y desarrollado por</small><strong>Equipo de Efectividad y Proyectos</strong></span>
    </div>
    <p>Datos claros. Mejores decisiones.</p>
    <div className="footer-meta"><span>Universidad Corporativa Coppel</span><small>Hecho con intención · 2026</small></div>
  </footer>;
}

function UniversityBrand({ onClick }: { onClick(): void }) {
  return <button className="university-brand" onClick={onClick} aria-label="Ir a reportes">
    <span><strong>Universidad</strong><strong>Corporativa</strong><small>Coppel</small></span>
  </button>;
}

function ReportSkeleton({ survey }: { survey: boolean }) {
  return <div className={survey ? "report-skeleton survey" : "report-skeleton"} role="status" aria-label="Cargando reporte">
    <div className="skeleton-toolbar">{Array.from({ length: survey ? 4 : 6 }, (_, index) => <i key={index} />)}</div>
    <section className="skeleton-lead"><i /><i /><i /></section>
    <section className="skeleton-metrics">{Array.from({ length: survey ? 4 : 3 }, (_, index) => <article key={index}><i /><b /><i /></article>)}</section>
    <section className="skeleton-panels"><article><i /><b /></article><article><i /><b /></article></section>
    <span className="sr-only">Cargando información del reporte…</span>
  </div>;
}

const fallbackCategories: CategoryOption[] = [
  { key: "almacenista", label: "Almacenista" },
  { key: "asesor", label: "Asesor" },
  { key: "cajero", label: "Cajero" },
  { key: "cobranza", label: "Cobranza" },
  { key: "gerente", label: "Gerente" },
  { key: "gerente_zona", label: "Gerente zona" },
  { key: "staff", label: "STAFF" },
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

function SelectFilter({ label, allLabel = label, value, options, onChange }: { label: string; allLabel?: string; value: string; options: string[]; onChange(value: string): void }) {
  return (
    <label className="select-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">{allLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function PositionFilterMenu({ open, positions, options, onOpenChange, onToggle }: {
  open: boolean;
  positions: string[];
  options: string[];
  onOpenChange(open: boolean): void;
  onToggle(value: string): void;
}) {
  const { cancelClose, scheduleClose } = useDelayedPanelClose(() => onOpenChange(false));
  return <details
    className="position-filter"
    open={open}
    onMouseEnter={cancelClose}
    onMouseLeave={scheduleClose}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false); }}
  >
    <summary onClick={(event) => { event.preventDefault(); onOpenChange(!open); }}>Puestos {positions.length ? `· ${positions.length}` : ""}</summary>
    <div>{options.map((item) => <label key={item}><input type="checkbox" checked={positions.includes(item)} onChange={() => onToggle(item)} />{item}</label>)}</div>
  </details>;
}

export default function Home() {
  const [categories, setCategories] = useState(fallbackCategories);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [bookExpanded, setBookExpanded] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [dashboards, setDashboards] = useState<CategoryDashboard[]>([]);
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("7");
  const [region, setRegion] = useState("all");
  const [course, setCourse] = useState("all");
  const [positions, setPositions] = useState<string[]>([]);
  const [yearFilterChosen, setYearFilterChosen] = useState(false);
  const [monthFilterChosen, setMonthFilterChosen] = useState(false);
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const [openFilterMenu, setOpenFilterMenu] = useState<string | null>(null);
  const [peopleMode, setPeopleMode] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [peopleSearchOpen, setPeopleSearchOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [tiendaAccent, setTiendaAccent] = useState(tiendaAccentOptions[0]);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const reportScrollRef = useRef<HTMLDivElement>(null);
  const reportSheetRef = useRef<HTMLElement>(null);
  const pendingReportScrollRef = useRef<number | null>(null);
  const period = `${year}-${month.padStart(2, "0")}`;

  useEffect(() => {
    listCategories()
      .then((items) => {
        if (items.length) {
          setCategories(items.map(({ key, label, history }) => ({ key, label, history })));
          setSelectedCategories((current) => current.filter((key) => items.some((item) => item.key === key)));
          const latestPeriod = items.flatMap((item) => Object.keys(item.history ?? {})).sort().at(-1);
          if (latestPeriod) {
            setYear(latestPeriod.slice(0, 4));
            setMonth(String(Number(latestPeriod.slice(5, 7))));
          }
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("es") === "k") {
        event.preventDefault();
        librarySearchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const sheet = reportSheetRef.current;
    const scroller = reportScrollRef.current;
    if (!sheet || !scroller || !selectedCategories.length) return;
    const handleSheetWheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const canMoveDown = event.deltaY > 0 && scroller.scrollTop < maxScroll - 1;
      const canMoveUp = event.deltaY < 0 && scroller.scrollTop > 1;
      if (!canMoveDown && !canMoveUp) return;
      event.preventDefault();
      event.stopPropagation();
      scroller.scrollTop = Math.max(0, Math.min(maxScroll, scroller.scrollTop + event.deltaY));
    };
    sheet.addEventListener("wheel", handleSheetWheel, { passive: false });
    return () => sheet.removeEventListener("wheel", handleSheetWheel);
  }, [selectedCategories]);

  useEffect(() => {
    if (loading || pendingReportScrollRef.current === null) return;
    const scroller = reportScrollRef.current;
    if (!scroller) return;
    const target = pendingReportScrollRef.current;
    requestAnimationFrame(() => {
      scroller.scrollTop = Math.min(target, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
      pendingReportScrollRef.current = null;
    });
  }, [loading, selectedCategories]);

  useEffect(() => {
    let active = true;
    if (!selectedCategories.length) {
      return () => { active = false; };
    }
    // A period/category change starts a new remote dashboard synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const activeSurvey = dashboards.length === 1 && dashboards[0].dataKind === "satisfaction" ? dashboards[0] : null;
  const tiendaChapters = useMemo(
    () => tiendaChapterKeys.map((key) => categories.find((category) => category.key === key)).filter((category): category is CategoryOption => Boolean(category)),
    [categories],
  );
  const libraryReports = useMemo(() => {
    const standalone = categories.filter((category) => !tiendaChapterKeys.includes(category.key));
    return tiendaChapters.length ? [tiendaCategory, ...standalone] : standalone;
  }, [categories, tiendaChapters.length]);
  const filteredReports = useMemo(() => {
    const query = textKey(reportQuery);
    return query ? libraryReports.filter((category) => {
      const family = reportFamily(category);
      const chapterLabels = category.key === "tienda" ? tiendaChapters.map((chapter) => chapter.label).join(" ") : "";
      return textKey(`${category.label} ${family.label} ${family.description} ${chapterLabels}`).includes(query);
    }) : libraryReports;
  }, [libraryReports, reportQuery, tiendaChapters]);
  const visibleChapters = useMemo(() => {
    const query = textKey(reportQuery);
    return query ? tiendaChapters.filter((category) => textKey(category.label).includes(query)) : tiendaChapters;
  }, [reportQuery, tiendaChapters]);
  const selectedReportOptions = useMemo(
    () => categories.filter((item) => selectedCategories.includes(item.key)),
    [categories, selectedCategories],
  );
  const selectedCategory = selectedReportOptions[0] ?? categories[0];
  const reportIsSurvey = selectedCategory?.key === "encuesta_de_satisfaccion";
  const tiendaPeriodReady = openBook !== "tienda" || (yearFilterChosen && monthFilterChosen);
  const sourceMetrics = useMemo<MetricRow[]>(() => !selectedCategories.length
    ? []
    : dashboards.filter((item) => item.dataKind !== "satisfaction").flatMap((item) => item.metrics as MetricRow[]),
  [dashboards, selectedCategories.length]);
  const availablePositions = useMemo(() => [...new Set(sourceMetrics.map((row) => row.puesto))].sort(), [sourceMetrics]);
  const availableRegions = useMemo(() => [...new Set(sourceMetrics.map((row) => row.region))].sort(), [sourceMetrics]);
  const availableCourses = useMemo(() => [...new Set(sourceMetrics.map((row) => row.curso))].sort(), [sourceMetrics]);
  const filteredMetrics = useMemo(() => sourceMetrics.filter((row) =>
    (!positions.length || positions.includes(row.puesto)) &&
    (region === "all" || row.region === region) &&
    (course === "all" || row.curso === course),
  ), [course, positions, region, sourceMetrics]);
  const { totals, regionalRanking, courseProgress } = useMemo(() => ({
    totals: sumRows(filteredMetrics),
    regionalRanking: groupMetrics(filteredMetrics, "region"),
    courseProgress: groupMetrics(filteredMetrics, "curso"),
  }), [filteredMetrics]);
  const hasTrainingData = filteredMetrics.length > 0 && totals.total > 0;

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
    return real;
  }, [dashboards, year]);

  const resetCategoryFilters = () => {
    setPositions([]);
    setRegion("all");
    setCourse("all");
    setNameQuery("");
    setYearFilterChosen(false);
    setMonthFilterChosen(false);
    setPositionMenuOpen(false);
    setOpenFilterMenu(null);
    setPeopleSearchOpen(false);
    setShowAllRegions(false);
    setShowAllCourses(false);
  };

  const selectCategory = (key: string, combine = false) => {
    const switchingReport = selectedCategories.length > 0;
    const clickedCategory = categories.find((item) => item.key === key);
    if (!clickedCategory) return;
    const selectedFamily = selectedReportOptions[0] ? reportFamily(selectedReportOptions[0]).label : null;
    const clickedFamily = reportFamily(clickedCategory).label;
    let nextSelection: string[];
    if (!switchingReport) {
      nextSelection = [key];
    } else if (!combine) {
      nextSelection = selectedCategories.length === 1 && selectedCategories[0] === key ? selectedCategories : [key];
    } else if (selectedFamily !== clickedFamily) {
      nextSelection = selectedCategories;
    } else if (selectedCategories.includes(key)) {
      nextSelection = selectedCategories.length > 1 ? selectedCategories.filter((item) => item !== key) : selectedCategories;
    } else {
      nextSelection = [...selectedCategories, key];
    }
    if (nextSelection === selectedCategories) return;
    pendingReportScrollRef.current = switchingReport ? reportScrollRef.current?.scrollTop ?? 0 : null;
    const nextReports = categories.filter((item) => nextSelection.includes(item.key));
    const latestPeriod = latestSharedPeriod(nextReports) ?? Object.keys(clickedCategory.history ?? {}).sort().at(-1);
    resetCategoryFilters();
    setReportQuery("");
    if (latestPeriod) {
      setYear(latestPeriod.slice(0, 4));
      setMonth(String(Number(latestPeriod.slice(5, 7))));
    }
    setSelectedCategories(nextSelection);
    if (!switchingReport) window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openTiendaBook = () => {
    const firstChapter = tiendaChapters[0];
    if (!firstChapter) return;
    resetCategoryFilters();
    setReportQuery("");
    setOpenBook("tienda");
    setBookExpanded(false);
    selectCategory(firstChapter.key);
  };
  const selectLibraryReport = (key: string) => {
    if (key === "tienda") openTiendaBook();
    else {
      setOpenBook(null);
      selectCategory(key);
    }
  };
  const returnToLibrary = () => {
    resetCategoryFilters();
    setReportQuery("");
    setDashboards([]);
    setUsingDemo(true);
    setLoading(false);
    setSelectedCategories([]);
    setOpenBook(null);
    setBookExpanded(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const togglePosition = (value: string) => {
    setPositions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const openPeopleMode = () => {
    setPositions([]);
    setRegion("all");
    setCourse("all");
    setNameQuery("");
    setPositionMenuOpen(false);
    setOpenFilterMenu(null);
    setPeopleSearchOpen(false);
    setPeopleMode(true);
  };
  const closePeopleMode = () => {
    setPeopleSearchOpen(false);
    setPositionMenuOpen(false);
    setOpenFilterMenu(null);
    setPeopleMode(false);
  };

  const loadPeople = useCallback(async () => {
    if (!dashboards.length) { setPendingRows([]); return; }
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
  }, [dashboards, positions, region]);

  useEffect(() => {
    if (!peopleMode) return;
    // Pending rows are derived from the active report filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPeople();
  }, [peopleMode, loadPeople]);

  const visiblePending = pendingRows.filter((row) =>
    (!nameQuery || `${row.nombre} ${row.numero_persona}`.toLocaleLowerCase("es").includes(nameQuery.toLocaleLowerCase("es"))) &&
    (region === "all" || row.region === region) &&
    (course === "all" || row.curso === course) &&
    (!positions.length || positions.includes(row.puesto)),
  );
  const peopleSuggestions = visiblePending.slice(0, 8);

  const selectedLabel = selectedReportOptions.length > 2
    ? `${selectedReportOptions.length} reportes de ${reportFamily(selectedReportOptions[0]).label}`
    : selectedReportOptions.map((item) => item.label).join(" + ") || "Selecciona un reporte";
  const syncLabel = loading ? "Sincronizando…" : usingDemo ? "Sin datos" : "Sincronizado";
  const syncTitle = loading
    ? "Consultando Firebase"
    : usingDemo
      ? "No se encontraron datos publicados para los filtros seleccionados"
      : `Última sincronización: ${lastSyncAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "ahora"}`;

  if (!selectedCategories.length && !openBook) {
    return <div className="site-page library-page">
      <header className="site-header library-header">
        <UniversityBrand onClick={() => undefined} />
        <strong className="header-section-title">Reportes</strong>
        <span className="library-count">{libraryReports.length.toLocaleString("es-MX")} reportes</span>
      </header>
      <section className="library-hero">
        <span>UNIVERSIDAD CORPORATIVA COPPEL</span>
        <h1>Think different.</h1>
        <p>Cada reporte es una historia. Elige una portada y entra a leer tus datos.</p>
        <label className="library-search"><i aria-hidden="true">⌕</i><input ref={librarySearchRef} value={reportQuery} onChange={(event) => setReportQuery(event.target.value)} placeholder="Buscar un reporte" /><kbd>⌘ K</kbd></label>
      </section>
      <main className="library-content">
        <header><div><span>Todos los reportes</span><small>Publicados por la Universidad Corporativa</small></div><b>{filteredReports.length}</b></header>
        {filteredReports.length ? <div className="book-library-grid">{filteredReports.map((category, index) => {
          const family = reportFamily(category);
          return <button className={category.key === "tienda" ? "book-card collection" : "book-card"} key={category.key} onClick={() => selectLibraryReport(category.key)} style={{ animationDelay: `${index * 45}ms` }}>
            {category.key === "tienda" ? <TiendaBookCover /> : <ReportCover category={category} />}
            <span className="book-card-copy"><span className="report-family-tag">{family.label}</span><strong>{category.label}</strong><small>{family.description}</small></span>
          </button>;
        })}</div> : <section className="library-empty"><strong>No encontramos ese reporte.</strong><span>Prueba con otro nombre o con una familia como “Avance” o “Experiencia”.</span></section>}
      </main>
      <LibraryFooter />
    </div>;
  }

  return (
    <div className="site-page">
      <header className="site-header">
        <UniversityBrand onClick={returnToLibrary} />
        <strong className="header-section-title">{selectedLabel}</strong>
        <span className={`sync-status ${loading ? "loading" : usingDemo ? "empty" : "synced"}`} title={syncTitle}>
          <i /> {syncLabel}
        </span>
      </header>

      <section className="page-intro">
        <button className="report-back-button" onClick={returnToLibrary}>
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 18 9 12l6-6" /></svg></span>
          Todos los reportes
        </button>
        <h1>Reportes</h1>
        <p>{reportIsSurvey ? "Explora satisfacción, recomendación y desempeño por programa e instructor." : "Consulta el avance mensual, compara regiones y encuentra cursos pendientes."}</p>
      </section>

    <main className="workspace-shell">
      <aside className="filter-rail">
        <header className="rail-heading">
          <div><span className="eyebrow">CATÁLOGO</span><h1>Reportes</h1></div>
          <span className={`data-dot ${loading ? "loading" : usingDemo ? "empty" : "synced"}`} title={syncTitle} />
        </header>

        <label className="rail-search"><i aria-hidden="true">⌕</i><input value={reportQuery} onChange={(event) => setReportQuery(event.target.value)} placeholder="Buscar reporte" /></label>
        <div className="rail-section-title"><span>Reportes</span><small>{filteredReports.length}</small></div>
        <nav className="category-list" aria-label="Categorías del reporte">
          {filteredReports.map((category) => category.key === "tienda" ? <div className="category-collection" key={category.key}>
              <button className="category collection-category" onClick={() => setBookExpanded((current) => !current)} aria-expanded={bookExpanded}>
                <TiendaBookCover compact />
                <span className="category-copy"><span>Tienda</span><small>{tiendaChapters.length} capítulos</small></span>
              </button>
              <div className={bookExpanded ? "chapter-subnotes open" : "chapter-subnotes"}>
                {visibleChapters.map((chapter, index) => <button
                  className={selectedCategories.includes(chapter.key) ? "category chapter-note active" : "category chapter-note"}
                  key={chapter.key}
                  onClick={() => { setOpenBook("tienda"); selectCategory(chapter.key); }}
                  onContextMenu={(event) => { event.preventDefault(); setOpenBook("tienda"); selectCategory(chapter.key, true); }}
                  aria-pressed={selectedCategories.includes(chapter.key)}
                  title="Clic izquierdo para cambiar · clic derecho para combinar"
                >
                  <span className="chapter-note-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="category-copy"><span>{chapter.label}</span><small>Capítulo de Tienda</small></span>
                </button>)}
              </div>
            </div> : <button
                className={selectedCategories.includes(category.key) ? "category active" : "category"}
                key={category.key}
                onClick={() => { setOpenBook(null); setBookExpanded(false); selectCategory(category.key); }}
                onContextMenu={(event) => { event.preventDefault(); selectCategory(category.key, true); }}
                aria-pressed={selectedCategories.includes(category.key)}
                title="Clic izquierdo para cambiar · clic derecho para combinar"
              >
                <ReportCover category={category} compact />
                <span className="category-copy"><span>{category.label}</span><small>{reportFamily(category).label}</small></span>
              </button>)}
        </nav>

      </aside>

      <section className="report-space" key={selectedCategories.join("|")}>
        <header className="topbar">
          <div className="report-name"><ReportCover category={selectedCategory} compact /><span><strong title={selectedLabel}>{selectedLabel}</strong><small>{selectedReportOptions.length > 1 ? `Combinado · ${selectedReportOptions.length} reportes` : reportFamily(selectedCategory).label} · {tiendaPeriodReady ? period : "Selecciona periodo"}</small></span></div>
          <div className="topbar-actions">
            <span className={`status-pill ${loading ? "loading" : usingDemo ? "empty" : "synced"}`} title={syncTitle}>{syncLabel}</span>
            <button
              type="button"
              className="download-report-button"
              onClick={() => window.print()}
              aria-label="Descargar reporte en PDF"
              title="Descargar reporte en PDF"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 19h14" /></svg>
            </button>
          </div>
        </header>

        <div className="report-scroll" ref={reportScrollRef}>
          <article className={`${loading && tiendaPeriodReady ? "sheet is-loading" : "sheet is-ready"}${openBook === "tienda" ? " tienda-themed" : ""}`} ref={reportSheetRef} style={openBook === "tienda" ? { "--tienda-accent": tiendaAccent.accent, "--tienda-secondary": tiendaAccent.secondary, "--tienda-deep": tiendaAccent.deep, "--tienda-action": tiendaAccent.action } as CSSProperties : undefined}>
            <header className={openBook === "tienda" ? "sheet-title tienda-letterhead" : "sheet-title"}>
              {openBook === "tienda" && <div className="tienda-letterhead-top">
                <div className="tienda-letterhead-logo"><img src="/coppel-universidad-logo-black-v2.png" alt="Coppel Universidad Corporativa · Academia de Ventas" /></div>
                <div className={accentPickerOpen ? "tienda-accent-picker is-open" : "tienda-accent-picker"}>
                  <div className="accent-options" aria-hidden={!accentPickerOpen}>
                    <div>{tiendaAccentOptions.map((option) => <button
                      type="button"
                      key={option.key}
                      className={option.key === tiendaAccent.key ? "accent-swatch is-selected" : "accent-swatch"}
                      style={{ background: option.swatch }}
                      aria-label={`Usar color ${option.label}`}
                      aria-pressed={option.key === tiendaAccent.key}
                      disabled={!accentPickerOpen}
                      onClick={() => { setTiendaAccent(option); setAccentPickerOpen(false); }}
                    />)}</div>
                  </div>
                  <button
                    type="button"
                    className="accent-swatch accent-toggle"
                    style={{ background: tiendaAccent.swatch }}
                    aria-label="Mostrar colores del membrete"
                    aria-expanded={accentPickerOpen}
                    onClick={() => setAccentPickerOpen(true)}
                  />
                </div>
              </div>}
              <div className="sheet-title-copy"><span className="eyebrow">{reportIsSurvey ? "EXPERIENCIA DE APRENDIZAJE" : peopleMode ? "CURSOS PENDIENTES" : openBook === "tienda" ? "ACADEMIA DE VENTAS" : "DOCUMENTO DE RESULTADOS"}</span><h2>{reportIsSurvey ? "Satisfacción" : peopleMode ? "Detalle por colaborador" : "Reporte de capacitación"}</h2></div>
            </header>

            {loading && tiendaPeriodReady ? <ReportSkeleton survey={reportIsSurvey} /> : <div className="report-content">
            {!activeSurvey && <div className="floating-toolbar-frame"><div className={peopleMode ? "sheet-toolbar people" : "sheet-toolbar"} aria-label="Filtros del reporte">
              {peopleMode ? (
                <>
                  {openBook === "tienda" ? <div className="people-picker">
                    <label className="toolbar-search"><span>Buscar</span><i>⌕</i><input value={nameQuery} onFocus={() => setPeopleSearchOpen(true)} onBlur={() => setPeopleSearchOpen(false)} onChange={(event) => { setNameQuery(event.target.value); setPeopleSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setPeopleSearchOpen(false); }} placeholder="Buscar persona" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(nameQuery.trim() && peopleSearchOpen)} aria-controls="people-suggestions" /></label>
                    {nameQuery.trim() && peopleSearchOpen && <div className="people-suggestions" id="people-suggestions" role="listbox">
                      {loadingPending ? <p>Buscando colaboradores…</p> : pendingError ? <p>{pendingError}</p> : peopleSuggestions.length ? peopleSuggestions.map((person, index) => <button key={`${person.numero_persona}-${person.curso}-${index}`} onMouseDown={(event) => { event.preventDefault(); setNameQuery(person.nombre); setPeopleSearchOpen(false); }} role="option" aria-selected="false"><span><strong>{person.nombre}</strong><small>{person.numero_persona} · Tienda {person.tienda ?? "—"}</small></span><em>{person.curso}</em></button>) : <p>No encontramos personas con esa búsqueda.</p>}
                    </div>}
                  </div> : <label className="toolbar-search"><span>Buscar</span><i>⌕</i><input value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} placeholder="Nombre o número de persona" /></label>}
                  {openBook === "tienda" ? <>
                    <PositionFilterMenu open={positionMenuOpen} positions={positions} options={availablePositions} onOpenChange={(open) => { setPositionMenuOpen(open); if (open) setOpenFilterMenu(null); }} onToggle={togglePosition} />
                    <PopupFilter label="Región" className="region-filter" value={region} options={[{ value: "all", label: "Todos" }, ...availableRegions.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "people-region"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "people-region" : current === "people-region" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={setRegion} />
                    <PopupFilter label="Cursos" className="course-filter" value={course} options={[{ value: "all", label: "Todos" }, ...availableCourses.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "people-course"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "people-course" : current === "people-course" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={setCourse} />
                  </> : <>
                    <details className="position-filter"><summary>Puestos {positions.length ? `· ${positions.length}` : ""}</summary><div>{availablePositions.map((item) => <label key={item}><input type="checkbox" checked={positions.includes(item)} onChange={() => togglePosition(item)} />{item}</label>)}</div></details>
                    <SelectFilter label="Región" allLabel="Todos" value={region} options={availableRegions} onChange={setRegion} />
                    <SelectFilter label="Cursos" allLabel="Todos" value={course} options={availableCourses} onChange={setCourse} />
                  </>}
                  <button className="toolbar-people active" onClick={openBook === "tienda" ? closePeopleMode : () => setPeopleMode(false)} aria-label="Volver al reporte" title="Volver al reporte"><span className="close-icon" aria-hidden="true" /></button>
                </>
              ) : (
                <>
                  {openBook === "tienda" ? <>
                    <PopupFilter label="Año" value={yearFilterChosen ? year : undefined} options={[{ value: "2026", label: "2026" }]} open={openFilterMenu === "year"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "year" : current === "year" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={(value) => { setYearFilterChosen(true); setYear(value); }} />
                    <PopupFilter label="Mes" className="month-filter" value={monthFilterChosen ? month : undefined} options={months.map((item, index) => ({ value: String(index + 1), label: item }))} open={openFilterMenu === "month"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "month" : current === "month" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={(value) => { setMonthFilterChosen(true); setMonth(value); }} />
                    <PositionFilterMenu open={positionMenuOpen} positions={positions} options={availablePositions} onOpenChange={(open) => { setPositionMenuOpen(open); if (open) setOpenFilterMenu(null); }} onToggle={togglePosition} />
                    <PopupFilter label="Región" className="region-filter" value={region} options={[{ value: "all", label: "Todos" }, ...availableRegions.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "region"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "region" : current === "region" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={setRegion} />
                    <PopupFilter label="Cursos" className="course-filter" value={course} options={[{ value: "all", label: "Todos" }, ...availableCourses.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "course"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "course" : current === "course" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={setCourse} />
                  </> : <>
                    <label><span>Año</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="2026">2026</option></select></label>
                    <label><span>Mes</span><select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((item, index) => <option value={String(index + 1)} key={item}>{item}</option>)}</select></label>
                    <details className="position-filter"><summary>Puestos {positions.length ? `· ${positions.length}` : ""}</summary><div>{availablePositions.map((item) => <label key={item}><input type="checkbox" checked={positions.includes(item)} onChange={() => togglePosition(item)} />{item}</label>)}</div></details>
                    <SelectFilter label="Región" allLabel="Todos" value={region} options={availableRegions} onChange={setRegion} />
                    <SelectFilter label="Cursos" allLabel="Todos" value={course} options={availableCourses} onChange={setCourse} />
                  </>}
                  <button className="toolbar-people" disabled={openBook === "tienda" && !tiendaPeriodReady} onClick={openBook === "tienda" ? openPeopleMode : () => setPeopleMode(true)} aria-label="Buscar colaboradores" title={openBook === "tienda" && !tiendaPeriodReady ? "Selecciona Año y Mes" : "Buscar colaboradores"}>◎</button>
                </>
              )}
            </div></div>}

            {openBook === "tienda" && !tiendaPeriodReady ? <section className="filter-empty-state"><span>PERIODO REQUERIDO</span><h3>Selecciona Año y Mes</h3><p>El reporte permanecerá vacío hasta que definas el periodo que deseas consultar.</p></section> : activeSurvey ? <SatisfactionReport key={`${activeSurvey.category}/${activeSurvey.period}`} dashboard={activeSurvey} /> : <><section className="report-lead">
              <h3>{selectedLabel}</h3>
              <p>{peopleMode ? "Listado de colaboradores con uno o más cursos pendientes según los filtros seleccionados." : "Concentrado mensual de avance, asignaciones y pendientes. Los indicadores se actualizan con la información publicada desde RunSQL."}</p>
              <small>{usingDemo ? "Aún no hay datos sincronizados para este periodo. Publica la información desde RunSQL." : `Fecha de corte del periodo ${period}.`}</small>
            </section>

            {!peopleMode ? (
              <>
                <section className="metric-grid">
                  <article><span>Avance total</span><strong>{hasTrainingData ? `${totals.progress.toFixed(1)}%` : "—"}</strong><small>{hasTrainingData ? `${totals.completed.toLocaleString("es-MX")} completados` : "Sin datos"}</small></article>
                  <article><span>Total asignado</span><strong>{hasTrainingData ? totals.total.toLocaleString("es-MX") : "—"}</strong><small>{hasTrainingData ? `${filteredMetrics.length.toLocaleString("es-MX")} combinaciones` : "Sin datos"}</small></article>
                  <article><span>Pendientes</span><strong>{hasTrainingData ? totals.pending.toLocaleString("es-MX") : "—"}</strong><small>{hasTrainingData ? `${(100 - totals.progress).toFixed(1)}% del total` : "Sin datos"}</small></article>
                </section>

                <section className="dashboard-grid">
                  <article className="panel chart-panel">
                    <div className="panel-heading"><div><span>Avance mensual</span><small>Comparativo del año</small></div><b>{hasTrainingData ? `${totals.progress.toFixed(1)}%` : "—"}</b></div>
                    {history.length ? <div className="bars" aria-label="Gráfica de avance mensual">{history.map((item) => <div className="bar-column" key={item.label}><em>{item.value}%</em><div style={{ height: `${Math.max(item.value, 4)}%` }} /><small>{item.label}</small></div>)}</div> : <p className="comments-empty">Sin datos para el periodo seleccionado.</p>}
                  </article>
                  <article className="panel ranking-panel">
                    <div className="panel-heading"><div><span>Ranking regional</span><small>Avance promedio</small></div></div>
                    {regionalRanking.length ? regionalRanking.slice(0, 5).map((item, index) => <div className="rank-row" key={item.label}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.label}</span><strong>{item.progress.toFixed(1)}%</strong></div>) : <p className="comments-empty">Sin datos para los filtros seleccionados.</p>}
                    <div className={showAllRegions ? "expandable-section is-open" : "expandable-section"}><div>{regionalRanking.slice(5).map((item, index) => <div className="rank-row" key={item.label}><b>{String(index + 6).padStart(2, "0")}</b><span>{item.label}</span><strong>{item.progress.toFixed(1)}%</strong></div>)}</div></div>
                    {regionalRanking.length > 5 && <button className="show-more-button" onClick={() => setShowAllRegions((current) => !current)}><span>{showAllRegions ? "Mostrar menos" : `Ver ${regionalRanking.length - 5} más`}</span><span className="more-icon-shell more-glyph" aria-hidden="true">{showAllRegions ? "−" : "+"}</span></button>}
                  </article>
                  <article className="panel course-panel">
                    <div className="panel-heading"><div><span>Avance por curso</span><small>Selecciona un curso para filtrar</small></div></div>
                    {courseProgress.length ? <div className="course-table">{courseProgress.slice(0, 7).map((item) => <button key={item.label} onClick={() => setCourse(item.label)}><span>{item.label}<small>{item.completed.toLocaleString("es-MX")} de {item.total.toLocaleString("es-MX")}</small></span><i><b style={{ width: `${item.progress}%` }} /></i><strong>{item.progress.toFixed(1)}%</strong></button>)}<div className={showAllCourses ? "expandable-section is-open" : "expandable-section"}><div>{courseProgress.slice(7).map((item) => <button key={item.label} onClick={() => setCourse(item.label)}><span>{item.label}<small>{item.completed.toLocaleString("es-MX")} de {item.total.toLocaleString("es-MX")}</small></span><i><b style={{ width: `${item.progress}%` }} /></i><strong>{item.progress.toFixed(1)}%</strong></button>)}</div></div></div> : <p className="comments-empty">Sin datos para los filtros seleccionados.</p>}
                    {courseProgress.length > 7 && <button className="show-more-button" onClick={() => setShowAllCourses((current) => !current)}><span>{showAllCourses ? "Mostrar menos" : `Ver ${courseProgress.length - 7} más`}</span><span className="more-icon-shell more-glyph" aria-hidden="true">{showAllCourses ? "−" : "+"}</span></button>}
                  </article>
                </section>
              </>
            ) : (
              <section className="people-results">
                <div className={pendingError ? "people-summary error" : "people-summary"}><span>{loadingPending ? "Cargando colaboradores…" : pendingError || `${visiblePending.length.toLocaleString("es-MX")} pendientes encontrados`}</span><small>{pendingError ? "Verifica que el backend local de RunSQL esté encendido." : "La búsqueda utiliza únicamente los bloques de las secciones elegidas."}</small></div>
                <div className="people-table"><div className="people-table-head"><span>Colaborador</span><span>Puesto</span><span>Región</span><span>Curso pendiente</span></div>{visiblePending.slice(0, 100).map((person, index) => <div className="person-row" key={`${person.numero_persona}-${person.curso}-${index}`}><span><b>{person.nombre}</b><small>{person.numero_persona} · Tienda {person.tienda ?? "—"}</small></span><span>{person.puesto}</span><span>{person.region}</span><span>{person.curso}</span></div>)}</div>
              </section>
            )}</>}
            {openBook === "tienda" && <footer className="tienda-confidentiality"><strong>La información contenida en la totalidad de este documento constituye un secreto de marca y/o información de Grupo Coppel; y deberá tratarse de acuerdo con las Decisiones, Políticas y Procesos vigentes en la organización.</strong></footer>}
            </div>}
          </article>
        </div>
      </section>
    </main>
    </div>
  );
}
