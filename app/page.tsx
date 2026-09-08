"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  CategoryDashboard,
  MetricRow,
  PendingRow,
  PeriodSummary,
  SatisfactionComment,
  StudioComment,
  completeStudioComment,
  createStudioComment,
  deleteStudioComment,
  listCategories,
  loadCategoryDashboard,
  loadDashboardDetails,
  loadPendingSection,
  loadStudioReportCopy,
  loadStudioComments,
  loadStudioShareSession,
  saveStudioReportCopy,
} from "../lib/dashboard-data";
import SatisfactionReport from "./SatisfactionReport";
import EicStatusReport, { eicBlockLabels, eicDefaultBlockOrder, type EicBlockKey } from "./EicStatusReport";
import PopupFilter, { useDelayedPanelClose } from "./ToolbarPopupFilter";
import { loadStudioDemoDashboard, studioDemoCategories, studioDemoPendingRows } from "../lib/studio-demo-data";

type CategoryOption = {
  key: string;
  label: string;
  collectionKey?: string | null;
  collectionLabel?: string | null;
  history?: Record<string, PeriodSummary>;
};

const tiendaChapterKeys = ["almacenista", "asesor", "cajero", "gerente", "gerente_zona"];
const tiendaCategory: CategoryOption = { key: "tienda", label: "Tienda" };
const staffCollectionCategory: CategoryOption = { key: "staff_collection", label: "Staff" };
const trainingPlansCollectionCategory: CategoryOption = { key: "training_plans_collection", label: "Capacitación especializada" };
const trainingPlansCollectionKeys = new Set(["training_plans", "planes_de_capacitacion"]);
const collectionTabColors = ["#f4cb63", "#f2a895", "#b9dcae", "#9ec9eb", "#c8b7df", "#efb8d5", "#a8d9d2"];
const institutionalPalette = {
  accent: "#F0D224",
  secondary: "#1C42E8",
  deep: "#081754",
};
const satisfactionPalette = {
  accent: "#F0D224",
  secondary: "#93C5FD",
  deep: "#5275A3",
};

function textKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
}

function reportFamily(category: CategoryOption) {
  if (category.key === "tienda") return { label: "Colección", description: "Cinco capítulos del equipo de Tienda" };
  if (category.key === "staff_collection") return { label: "Colección", description: "Reportes de capacitación del equipo Staff" };
  if (category.key === "training_plans_collection") return { label: "Colección", description: "Planes de capacitación organizados por dirección C-Level" };
  if (category.collectionKey && trainingPlansCollectionKeys.has(category.collectionKey)) return { label: "Planes", description: "Seguimiento presupuestal y operativo por C-Level" };
  if (category.collectionKey === "staff") return { label: "Talento", description: "Seguimiento de capacitación corporativa" };
  if (category.key === "encuesta_de_satisfaccion") return { label: "Experiencia", description: "Satisfacción, recomendación y voz del participante" };
  if (category.key === "eic_administrativa") return { label: "Gestión", description: "Presupuesto y operación de la Dirección de Administración GC" };
  if (category.key === "staff") return { label: "Talento", description: "Seguimiento de capacitación corporativa" };
  return { label: "Avance", description: "Cumplimiento, asignaciones y cursos pendientes" };
}

function studioDocumentKeyFor(category: CategoryOption | undefined) {
  return category?.collectionKey || category?.key || "reporte";
}

function reportTone(key: string) {
  const preferred: Record<string, string> = {
    almacenista: "cobalt", asesor: "forest", cajero: "coral", cobranza: "ink",
    encuesta_de_satisfaccion: "violet", gerente: "sand", gerente_zona: "ink", staff: "cobalt",
    eic_administrativa: "cobalt",
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
  const longTitle = category.label.length > 22;
  return <span className={`report-cover ${compact ? "compact " : ""}${longTitle ? "long-title " : ""}${artwork ? `has-artwork artwork-${category.key}` : `tone-${reportTone(category.key)}`}`} style={artwork ? { backgroundImage: `url(${artwork})` } : undefined} aria-hidden="true">
    <span className="cover-rule" />
    <small>{family.label}</small>
    <strong>{category.label}</strong>
    <i>UC</i>
    <em>Universidad Corporativa Coppel</em>
  </span>;
});

function CollectionBookCover({ category, chapters, compact = false }: { category: CategoryOption; chapters: CategoryOption[]; compact?: boolean }) {
  const visibleTabs = compact
    ? chapters.slice(0, 5).map((chapter, index) => ({ key: chapter.key, label: String(index + 1).padStart(2, "0") }))
    : chapters.length > 7
      ? [
          ...chapters.slice(0, 5).map((chapter, index) => ({ key: chapter.key, label: String(index + 1).padStart(2, "0") })),
          { key: "overflow", label: "…" },
          { key: "total", label: String(chapters.length).padStart(2, "0") },
        ]
      : chapters.map((chapter, index) => ({ key: chapter.key, label: String(index + 1).padStart(2, "0") }));
  return <span className={compact ? "tienda-book-cover compact" : "tienda-book-cover"}>
    <ReportCover category={category} compact={compact} />
    <span className="book-index-tabs" aria-hidden="true" data-visible-tabs={visibleTabs.length} data-total-chapters={chapters.length}>
      {visibleTabs.map((tab, index) => <i key={tab.key} style={{ "--tab-color": collectionTabColors[index % collectionTabColors.length] } as CSSProperties}>{tab.label}</i>)}
    </span>
  </span>;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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

type StudioBlockKey = "intro" | "metrics" | "chart" | "ranking" | "courses";
type LayoutBlockKey = StudioBlockKey | EicBlockKey;
type StudioCommentComposer = Pick<StudioComment, "anchor" | "x" | "y" | "coordinateSpace"> & { sheetX: number; sheetY: number };
const studioDraftsStorageKey = "macintosh-studio:report-copy:v1";
const studioDefaultBlockOrder: StudioBlockKey[] = ["intro", "metrics", "chart", "ranking", "courses"];

const studioBlockLabels: Record<StudioBlockKey, string> = {
  intro: "Presentación",
  metrics: "Indicadores",
  chart: "Avance mensual",
  ranking: "Ranking regional",
  courses: "Avance por curso",
};

function StudioActionIcon({ name }: { name: "up" | "down" | "lock" | "unlock" }) {
  if (name === "up" || name === "down") return <svg className="studio-action-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={name === "up" ? "M12 19V5M6.5 10.5 12 5l5.5 5.5" : "M12 5v14m5.5-5.5L12 19l-5.5-5.5"} />
  </svg>;
  return <svg className="studio-action-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2.5" />
    <path d={name === "lock" ? "M8 10V7a4 4 0 0 1 8 0v3" : "M8 10V7a4 4 0 0 1 7.7-1.5"} />
  </svg>;
}

function StudioBlockList({ order, hidden, selected, onSelect, onMove, onToggle, onDragStart, onDrop }: {
  order: LayoutBlockKey[];
  hidden: LayoutBlockKey[];
  selected: LayoutBlockKey;
  onSelect(key: LayoutBlockKey): void;
  onMove(key: LayoutBlockKey, direction: -1 | 1): void;
  onToggle(key: LayoutBlockKey): void;
  onDragStart(key: LayoutBlockKey): void;
  onDrop(key: LayoutBlockKey): void;
}) {
  const labels: Record<string, string> = order.length === eicDefaultBlockOrder.length ? eicBlockLabels : studioBlockLabels;
  return <ol className="studio-block-list" aria-label="Secciones editables del reporte">
    {order.map((key, index) => <li
      key={key}
      draggable
      data-studio-order-key={key}
      data-selected={selected === key}
      data-hidden={hidden.includes(key)}
      onDragStart={(event: DragEvent<HTMLLIElement>) => { event.dataTransfer.effectAllowed = "move"; onDragStart(key); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(key)}
    >
      <span className="studio-drag-handle" title="Arrastra para mover" aria-hidden="true">⠿</span>
      <button type="button" className="studio-block-name" onClick={() => onSelect(key)}><small>{String(index + 1).padStart(2, "0")}</small><strong>{labels[key]}</strong></button>
      <span className="studio-block-actions">
        <button type="button" onClick={() => onMove(key, -1)} aria-label={`Subir ${labels[key]}`} title="Subir sección"><StudioActionIcon name="up" /></button>
        <button type="button" onClick={() => onMove(key, 1)} aria-label={`Bajar ${labels[key]}`} title="Bajar sección"><StudioActionIcon name="down" /></button>
        <button type="button" className="studio-lock-button" onClick={() => onToggle(key)} aria-label={`${hidden.includes(key) ? "Mostrar" : "Ocultar"} ${labels[key]}`} title={hidden.includes(key) ? "Mostrar sección" : "Ocultar sección"}><StudioActionIcon name={hidden.includes(key) ? "unlock" : "lock"} /></button>
      </span>
    </li>)}
  </ol>;
}

function EditableCopy({ value, enabled, onChange, as: Tag = "span" }: { value: string; enabled: boolean; onChange(value: string): void; as?: "span" | "h3" | "p" | "small" }) {
  return <Tag
    className={enabled ? "studio-editable-copy" : undefined}
    contentEditable={enabled}
    suppressContentEditableWarning
    spellCheck
    onClick={(event) => event.stopPropagation()}
    onBlur={(event) => {
      const nextValue = event.currentTarget.innerText.trim();
      if (nextValue && nextValue !== value) onChange(nextValue);
    }}
    onKeyDown={(event) => {
      if (Tag !== "p" && event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    }}
  >{value}</Tag>;
}

export default function Home({ studioMode = false }: { studioMode?: boolean }) {
  const [categories, setCategories] = useState(studioMode ? studioDemoCategories : fallbackCategories);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [reportQuery, setReportQuery] = useState("");
  const [dashboards, setDashboards] = useState<CategoryDashboard[]>([]);
  const [surveyDetails, setSurveyDetails] = useState<SatisfactionComment[]>([]);
  const [surveyDetailsError, setSurveyDetailsError] = useState("");
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState(studioMode ? "8" : "7");
  const [region, setRegion] = useState("all");
  const [course, setCourse] = useState("all");
  const [positions, setPositions] = useState<string[]>([]);
  const [yearFilterChosen, setYearFilterChosen] = useState(false);
  const [monthFilterChosen, setMonthFilterChosen] = useState(false);
  const [regionFilterChosen, setRegionFilterChosen] = useState(false);
  const [courseFilterChosen, setCourseFilterChosen] = useState(false);
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
  const [readerMode, setReaderMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [studioBlockOrder, setStudioBlockOrder] = useState<LayoutBlockKey[]>(studioDefaultBlockOrder);
  const [studioHiddenBlocks, setStudioHiddenBlocks] = useState<LayoutBlockKey[]>([]);
  const [studioSelectedBlock, setStudioSelectedBlock] = useState<LayoutBlockKey>("intro");
  const [studioDraggedBlock, setStudioDraggedBlock] = useState<LayoutBlockKey | null>(null);
  const [studioDrafts, setStudioDrafts] = useState<Record<string, string>>({});
  const [studioSavedDrafts, setStudioSavedDrafts] = useState<Record<string, string>>({});
  const [studioSaveStatus, setStudioSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [studioAccessError, setStudioAccessError] = useState("");
  const [studioComments, setStudioComments] = useState<StudioComment[]>([]);
  const [studioCommentPositions, setStudioCommentPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [studioCommentComposer, setStudioCommentComposer] = useState<StudioCommentComposer | null>(null);
  const [studioCommentText, setStudioCommentText] = useState("");
  const [studioCommentStatus, setStudioCommentStatus] = useState<"idle" | "saving" | "error">("idle");
  const [activeStudioComment, setActiveStudioComment] = useState<string | null>(null);
  const [studioCommentAction, setStudioCommentAction] = useState<string | null>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const reportScrollRef = useRef<HTMLDivElement>(null);
  const reportSheetRef = useRef<HTMLElement>(null);
  const studioCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const legacyCommentOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const pendingReportScrollRef = useRef<number | null>(null);
  const period = `${year}-${month.padStart(2, "0")}`;
  const requestKey = `${selectedCategories.join("|")}@${period}`;
  const reportLoading = selectedCategories.length > 0 && (loading || loadedRequestKey !== requestKey);

  useEffect(() => {
    const readDrafts = (serialized: string | null) => {
      if (!serialized) return;
      try {
        const parsed = JSON.parse(serialized) as Record<string, unknown>;
        setStudioDrafts(Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      } catch {
        // A malformed local preference must never prevent reports from opening.
      }
    };
    readDrafts(window.localStorage.getItem(studioDraftsStorageKey));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === studioDraftsStorageKey) readDrafts(event.newValue);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!studioMode) return;
    const isRemote = !["localhost", "127.0.0.1"].includes(window.location.hostname);
    const token = new URLSearchParams(window.location.search).get("share") ?? "";
    if (!isRemote) return;
    if (!token) {
      // The remote URL is an external input; synchronize its access state after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStudioAccessError("Este enlace de Macintosh Studio no es válido o ya no está disponible.");
      return;
    }
    const applyScope = (scope: string) => {
      const scopedCollection = scope === "especializada" ? "planes_de_capacitacion" : scope;
      const scoped = scope === "all"
        ? studioDemoCategories
        : studioDemoCategories.filter((category) => category.collectionKey === scopedCollection);
      setCategories(scoped);
      setSelectedCategories((current) => current.filter((key) => scoped.some((category) => category.key === key)));
      setOpenBook(null);
      setExpandedBook(null);
    };
    const hintedScope = token.split(".", 1)[0];
    if (["all", "tienda", "staff", "cobranza", "especializada"].includes(hintedScope)) applyScope(hintedScope);
    loadStudioShareSession()
      .then((session) => applyScope(session.scope))
      .catch(() => setStudioAccessError("Este enlace de Macintosh Studio venció, fue revocado o no es válido."));
  }, [studioMode]);

  useEffect(() => {
    if (studioMode) return;
    listCategories()
      .then((items) => {
        if (items.length) {
          setCategories(items.map(({ key, label, collectionKey, collectionLabel, history }) => {
            const isLegacyAdministrationReport = key === "eic_administrativa";
            const belongsToTrainingPlans = isLegacyAdministrationReport || Boolean(collectionKey && trainingPlansCollectionKeys.has(collectionKey));
            return {
              key,
              label: isLegacyAdministrationReport ? "Dirección de Administración GC" : label,
              collectionKey: belongsToTrainingPlans ? "planes_de_capacitacion" : collectionKey,
              collectionLabel: belongsToTrainingPlans ? "Planes de capacitación" : collectionLabel,
              history,
            };
          }));
          setSelectedCategories((current) => current.filter((key) => items.some((item) => item.key === key)));
          const latestPeriod = items.flatMap((item) => Object.keys(item.history ?? {})).sort().at(-1);
          if (latestPeriod) {
            setYear(latestPeriod.slice(0, 4));
            setMonth(String(Number(latestPeriod.slice(5, 7))));
          }
        }
      })
      .catch(() => undefined);
  }, [studioMode]);

  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent) => {
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
    if (reportLoading || pendingReportScrollRef.current === null) return;
    const scroller = reportScrollRef.current;
    if (!scroller) return;
    const target = pendingReportScrollRef.current;
    requestAnimationFrame(() => {
      scroller.scrollTop = Math.min(target, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
      pendingReportScrollRef.current = null;
    });
  }, [reportLoading, selectedCategories]);

  useEffect(() => {
    let active = true;
    if (!selectedCategories.length) {
      return () => { active = false; };
    }
    const selectedOptions = categories.filter((category) => selectedCategories.includes(category.key));
    const combinesTrainingPlans = selectedOptions.length > 1 && selectedOptions.every((category) =>
      category.key === "eic_administrativa" || Boolean(category.collectionKey && trainingPlansCollectionKeys.has(category.collectionKey))
    );
    // A period/category change starts a new remote dashboard synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const dashboardRequest = studioMode
      ? Promise.resolve(selectedCategories.map((category) => loadStudioDemoDashboard(category, period)))
      : Promise.all(selectedCategories.map((category) => {
      const option = selectedOptions.find((item) => item.key === category);
      const latestAvailablePeriod = Object.keys(option?.history ?? {}).sort().at(-1);
      const categoryPeriod = combinesTrainingPlans && !option?.history?.[period]
        ? latestAvailablePeriod ?? period
        : period;
      return loadCategoryDashboard(category, categoryPeriod);
    }));
    dashboardRequest
      .then(async (loaded) => {
        const survey = !studioMode && loaded.length === 1 && loaded[0].dataKind === "satisfaction" ? loaded[0] : null;
        let details: SatisfactionComment[] = [];
        let detailsError = "";
        if (survey) {
          try {
            details = await loadDashboardDetails(survey);
          } catch (error) {
            detailsError = error instanceof Error ? error.message : "No se pudieron cargar los comentarios.";
          }
        }
        if (!active) return;
        setSurveyDetails(details);
        setSurveyDetailsError(detailsError);
        setDashboards(loaded);
        setLoadedRequestKey(requestKey);
        setUsingDemo(studioMode);
        setLastSyncAt(new Date());
      })
      .catch(() => {
        if (!active) return;
        setSurveyDetails([]);
        setSurveyDetailsError("");
        setDashboards([]);
        setLoadedRequestKey(requestKey);
        setUsingDemo(true);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [categories, period, requestKey, selectedCategories, studioMode]);

  const activeSurvey = dashboards.length === 1 && dashboards[0].dataKind === "satisfaction" ? dashboards[0] : null;
  const activeEicDashboards = dashboards.length > 0 && dashboards.every((dashboard) => dashboard.dataKind === "eic_administrative")
    ? dashboards
    : [];
  const activeEic = activeEicDashboards[0] ?? null;
  const tiendaChapters = useMemo(
    () => tiendaChapterKeys.map((key) => categories.find((category) => category.key === key)).filter((category): category is CategoryOption => Boolean(category)),
    [categories],
  );
  const staffChapters = useMemo(
    () => categories.filter((category) => category.key === "staff" || category.collectionKey === "staff"),
    [categories],
  );
  const trainingPlanChapters = useMemo(
    () => categories.filter((category) => category.collectionKey === "planes_de_capacitacion"),
    [categories],
  );
  const chapterKeys = useMemo(
    () => new Set([...tiendaChapters, ...staffChapters, ...trainingPlanChapters].map((category) => category.key)),
    [staffChapters, tiendaChapters, trainingPlanChapters],
  );
  const libraryReports = useMemo(() => {
    const standalone = categories.filter((category) => !chapterKeys.has(category.key));
    return [
      ...(tiendaChapters.length ? [tiendaCategory] : []),
      ...(staffChapters.length ? [staffCollectionCategory] : []),
      ...(trainingPlanChapters.length ? [trainingPlansCollectionCategory] : []),
      ...standalone,
    ];
  }, [categories, chapterKeys, staffChapters.length, tiendaChapters.length, trainingPlanChapters.length]);
  const collectionChapters = useCallback((key: string) => {
    if (key === "tienda") return tiendaChapters;
    if (key === "staff_collection") return staffChapters;
    if (key === "training_plans_collection") return trainingPlanChapters;
    return [];
  }, [staffChapters, tiendaChapters, trainingPlanChapters]);
  const displayCategoryLabel = useCallback((category: CategoryOption) => category.label, []);
  const displayCategory = useCallback(
    (category: CategoryOption) => {
      const label = displayCategoryLabel(category);
      return label === category.label ? category : { ...category, label };
    },
    [displayCategoryLabel],
  );
  const filteredReports = useMemo(() => {
    const query = textKey(reportQuery);
    return query ? libraryReports.filter((category) => {
      const family = reportFamily(category);
      const chapterLabels = collectionChapters(category.key).map(displayCategoryLabel).join(" ");
      return textKey(`${displayCategoryLabel(category)} ${category.label} ${family.label} ${family.description} ${chapterLabels}`).includes(query);
    }) : libraryReports;
  }, [collectionChapters, displayCategoryLabel, libraryReports, reportQuery]);
  const visibleCollectionChapters = useCallback((key: string) => {
    const chapters = collectionChapters(key);
    const query = textKey(reportQuery);
    return query ? chapters.filter((category) => textKey(`${displayCategoryLabel(category)} ${category.label}`).includes(query)) : chapters;
  }, [collectionChapters, displayCategoryLabel, reportQuery]);
  const selectedReportOptions = useMemo(
    () => categories.filter((item) => selectedCategories.includes(item.key)),
    [categories, selectedCategories],
  );
  const selectedCategory = selectedReportOptions[0] ?? categories[0];
  const selectedStudioDocumentKey = studioDocumentKeyFor(selectedCategory);
  useEffect(() => {
    let active = true;
    const documentKeys = [...new Set(categories.map(studioDocumentKeyFor))];
    void Promise.allSettled(documentKeys.map(loadStudioReportCopy))
      .then((results) => {
        if (!active) return;
        const remote: Record<string, string> = {};
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          for (const [field, value] of Object.entries(result.value.fields)) {
            remote[`${documentKeys[index]}:${field}`] = value;
          }
        });
        setStudioSavedDrafts(remote);
        setStudioDrafts((current) => {
          const next = { ...current };
          for (const [key, value] of Object.entries(remote)) {
            if (next[key] === undefined) next[key] = value;
          }
          window.localStorage.setItem(studioDraftsStorageKey, JSON.stringify(next));
          return next;
        });
      });
    return () => { active = false; };
  }, [categories]);

  useEffect(() => {
    const reportKey = selectedStudioDocumentKey;
    if (!reportKey) return;
    const defaultOrder: LayoutBlockKey[] = reportKey === "planes_de_capacitacion" ? eicDefaultBlockOrder : studioDefaultBlockOrder;
    const layoutSource = studioMode ? studioDrafts : studioSavedDrafts;
    const order = (layoutSource[`${reportKey}:layout.order`] ?? "").split(",")
      .filter((key): key is LayoutBlockKey => defaultOrder.includes(key as LayoutBlockKey));
    const validOrder = order.length === defaultOrder.length
      && defaultOrder.every((key) => order.includes(key));
    const hidden = (layoutSource[`${reportKey}:layout.hidden`] ?? "").split(",")
      .filter((key): key is LayoutBlockKey => defaultOrder.includes(key as LayoutBlockKey));
    // The active report owns a separate persisted layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStudioBlockOrder(validOrder ? order : defaultOrder);
    setStudioHiddenBlocks(hidden);
    setStudioSelectedBlock((current) => defaultOrder.includes(current) ? current : defaultOrder[0]);
  }, [selectedStudioDocumentKey, studioDrafts, studioMode, studioSavedDrafts]);

  useEffect(() => {
    if (!studioMode) return;
    legacyCommentOffsetsRef.current = {};
    let active = true;
    void loadStudioComments(selectedStudioDocumentKey)
      .then((comments) => { if (active) setStudioComments(comments); })
      .catch(() => { if (active) setStudioComments([]); });
    return () => { active = false; };
  }, [selectedStudioDocumentKey, studioMode]);

  useLayoutEffect(() => {
    if (!studioMode || !reportSheetRef.current) return;
    const sheet = reportSheetRef.current;
    let animationFrame = 0;
    const updatePositions = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        if (!sheet.clientWidth || !sheet.clientHeight) return;
        const next: Record<string, { x: number; y: number }> = {};
        for (const comment of studioComments) {
          if (comment.anchor === "sheet") continue;
          const anchorElement = Array.from(sheet.querySelectorAll<HTMLElement>("[data-studio-order-key]"))
            .find((element) => element.dataset.studioOrderKey === comment.anchor);
          if (!anchorElement) continue;
          let anchorLeft = 0;
          let anchorTop = 0;
          let offsetNode: HTMLElement | null = anchorElement;
          while (offsetNode && offsetNode !== sheet) {
            anchorLeft += offsetNode.offsetLeft;
            anchorTop += offsetNode.offsetTop;
            offsetNode = offsetNode.offsetParent as HTMLElement | null;
          }
          if (offsetNode !== sheet || !anchorElement.offsetWidth || !anchorElement.offsetHeight) continue;
          const legacyOffset = legacyCommentOffsetsRef.current[comment.id] ?? {
            x: Math.max(0.05, Math.min(0.95, (comment.x * sheet.clientWidth - anchorLeft) / anchorElement.offsetWidth)),
            y: Math.max(0.05, Math.min(0.95, (comment.y * sheet.clientHeight - anchorTop) / anchorElement.offsetHeight)),
          };
          if (comment.coordinateSpace !== "block") legacyCommentOffsetsRef.current[comment.id] = legacyOffset;
          const blockOffset = comment.coordinateSpace === "block" ? comment : legacyOffset;
          next[comment.id] = {
            x: (anchorLeft + blockOffset.x * anchorElement.offsetWidth) / sheet.clientWidth,
            y: (anchorTop + blockOffset.y * anchorElement.offsetHeight) / sheet.clientHeight,
          };
        }
        setStudioCommentPositions(next);
      });
    };
    updatePositions();
    const observer = new ResizeObserver(updatePositions);
    observer.observe(sheet);
    window.addEventListener("resize", updatePositions);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", updatePositions);
    };
  }, [selectedStudioDocumentKey, studioBlockOrder, studioComments, studioHiddenBlocks, studioMode]);

  const reportIsSurvey = selectedCategory?.key === "encuesta_de_satisfaccion";
  const reportIsEic = selectedReportOptions.length > 0 && selectedReportOptions.every((category) =>
    category.key === "eic_administrativa" || Boolean(category.collectionKey && trainingPlansCollectionKeys.has(category.collectionKey))
  );
  const displayEic = !reportLoading && activeEic;
  const showEicReport = reportIsEic || Boolean(displayEic);
  const eicReportTitle = selectedReportOptions.length > 1
    ? "Capacitación especializada"
    : selectedCategory?.label ?? "Planes de capacitación";
  const tiendaPeriodReady = openBook !== "tienda" || (yearFilterChosen && monthFilterChosen);
  const sourceMetrics = useMemo<MetricRow[]>(() => !selectedCategories.length
    ? []
    : dashboards.filter((item) => item.dataKind === "training").flatMap((item) => item.metrics as MetricRow[]),
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
    setRegionFilterChosen(false);
    setCourseFilterChosen(false);
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
    setStudioCommentComposer(null);
    setStudioCommentText("");
    setStudioCommentStatus("idle");
    setReportQuery("");
    if (latestPeriod) {
      setYear(latestPeriod.slice(0, 4));
      setMonth(String(Number(latestPeriod.slice(5, 7))));
    }
    setSelectedCategories(nextSelection);
    if (!switchingReport) window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openCollectionBook = (collectionKey: "tienda" | "staff" | "training_plans") => {
    const chapters = collectionKey === "tienda" ? tiendaChapters : collectionKey === "staff" ? staffChapters : trainingPlanChapters;
    const firstChapter = chapters[0];
    if (!firstChapter) return;
    resetCategoryFilters();
    setReportQuery("");
    setOpenBook(collectionKey);
    setExpandedBook(studioMode ? collectionKey === "staff" ? "staff_collection" : collectionKey === "training_plans" ? "training_plans_collection" : collectionKey : null);
    selectCategory(firstChapter.key);
  };
  const selectLibraryReport = (key: string) => {
    if (key === "tienda") openCollectionBook("tienda");
    else if (key === "staff_collection") openCollectionBook("staff");
    else if (key === "training_plans_collection") openCollectionBook("training_plans");
    else {
      setOpenBook(null);
      selectCategory(key);
    }
  };
  const returnToLibrary = () => {
    resetCategoryFilters();
    setReportQuery("");
    setDashboards([]);
    setSurveyDetails([]);
    setSurveyDetailsError("");
    setLoadedRequestKey("");
    setUsingDemo(true);
    setLoading(false);
    setSelectedCategories([]);
    setOpenBook(null);
    setExpandedBook(null);
    setReaderMode(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const togglePosition = (value: string) => {
    setPositions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const openPeopleMode = () => {
    setPositions([]);
    setRegion("all");
    setCourse("all");
    setRegionFilterChosen(false);
    setCourseFilterChosen(false);
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
      if (studioMode) {
        setPendingRows(dashboards.flatMap((dashboard) => studioDemoPendingRows(dashboard.category)));
        return;
      }
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
  }, [dashboards, positions, region, studioMode]);

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

  const selectedLabel = studioMode
    ? selectedCategory?.collectionLabel || selectedCategory?.label || "Studio"
    : selectedReportOptions.length > 2
      ? `${selectedReportOptions.length} reportes de ${reportFamily(selectedReportOptions[0]).label}`
      : selectedReportOptions.map(displayCategoryLabel).join(" + ") || "Selecciona un reporte";
  const syncState = reportLoading ? "loading" : studioMode ? "test" : usingDemo ? "empty" : "synced";
  const syncLabel = reportLoading ? "Preparando…" : studioMode ? "Datos de prueba" : usingDemo ? "Sin datos" : "Sincronizado";
  const syncTitle = reportLoading
    ? studioMode ? "Preparando información ficticia" : "Consultando Macintosh"
    : studioMode
      ? "Información ficticia aislada de los datos publicados"
    : usingDemo
      ? "No se encontraron datos publicados para los filtros seleccionados"
      : `Última sincronización: ${lastSyncAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "ahora"}`;
  const eicCutoffs = [...new Set(activeEicDashboards.map((dashboard) => dashboard.cutoffDate || dashboard.period))];
  const reportPeriodLabel = displayEic
    ? eicCutoffs.length > 1
      ? "Último corte por dirección"
      : `Corte ${eicCutoffs[0]}`
    : tiendaPeriodReady ? period : "Selecciona periodo";

  const studioCopy = (field: string, fallback: string) => (studioMode ? studioDrafts : studioSavedDrafts)[`${selectedStudioDocumentKey}:${field}`] ?? fallback;
  const selectedStudioPrefix = `${selectedStudioDocumentKey}:`;
  const selectedStudioKeys = new Set([
    ...Object.keys(studioSavedDrafts),
    ...Object.keys(studioDrafts),
    `${selectedStudioPrefix}layout.order`,
    `${selectedStudioPrefix}layout.hidden`,
  ]);
  const normalizedStudioValue = (source: Record<string, string>, key: string) => source[key]
    ?? (key.endsWith(":layout.order") ? (selectedStudioDocumentKey === "planes_de_capacitacion" ? eicDefaultBlockOrder : studioDefaultBlockOrder).join(",") : key.endsWith(":layout.hidden") ? "none" : undefined);
  const studioDirty = [...selectedStudioKeys].some((key) => key.startsWith(selectedStudioPrefix)
    && normalizedStudioValue(studioDrafts, key) !== normalizedStudioValue(studioSavedDrafts, key));
  const updateStudioDraft = (field: string, value: string) => {
    const reportKey = selectedStudioDocumentKey;
    if (!reportKey) return;
    setStudioDrafts((current) => {
      const next = { ...current, [`${reportKey}:${field}`]: value };
      window.localStorage.setItem(studioDraftsStorageKey, JSON.stringify(next));
      return next;
    });
    setStudioSaveStatus("idle");
  };
  const updateStudioCopy = (field: string, value: string) => {
    if (!value) return;
    updateStudioDraft(field, value);
  };
  const saveStudioChanges = async () => {
    const reportKey = selectedStudioDocumentKey;
    if (!reportKey || !studioDirty || studioSaveStatus === "saving") return;
    const prefix = `${reportKey}:`;
    const fields = Object.fromEntries(Object.entries(studioDrafts)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]));
    setStudioSaveStatus("saving");
    try {
      const saved = await saveStudioReportCopy(reportKey, fields);
      setStudioDrafts((current) => {
        const synchronized = { ...current };
        for (const [savedField, savedValue] of Object.entries(saved.fields)) {
          synchronized[`${reportKey}:${savedField}`] = savedValue;
        }
        window.localStorage.setItem(studioDraftsStorageKey, JSON.stringify(synchronized));
        return synchronized;
      });
      setStudioSavedDrafts((current) => {
        const synchronized = { ...current };
        for (const [savedField, savedValue] of Object.entries(saved.fields)) {
          synchronized[`${reportKey}:${savedField}`] = savedValue;
        }
        return synchronized;
      });
      setStudioSaveStatus("saved");
    } catch {
      setStudioSaveStatus("error");
    }
  };
  const openStudioCommentComposer = (event: ReactMouseEvent<HTMLElement>) => {
    if (!studioMode || !reportSheetRef.current) return;
    if ((event.target as HTMLElement).closest(".studio-comment-composer")) return;
    event.preventDefault();
    event.stopPropagation();
    const sheet = reportSheetRef.current;
    const rectangle = sheet.getBoundingClientRect();
    const target = event.target as HTMLElement;
    const anchorElement = target.closest<HTMLElement>("[data-studio-order-key]");
    const anchor = (anchorElement?.dataset.studioOrderKey ?? "sheet") as StudioComment["anchor"];
    const anchorRectangle = anchorElement?.getBoundingClientRect() ?? rectangle;
    const sheetX = Math.max(0.02, Math.min(0.98, (event.clientX - rectangle.left) / rectangle.width));
    const sheetY = Math.max(0.01, Math.min(0.99, (event.clientY - rectangle.top) / rectangle.height));
    setStudioCommentComposer({
      anchor,
      coordinateSpace: anchorElement ? "block" : "sheet",
      x: Math.max(0.02, Math.min(0.98, (event.clientX - anchorRectangle.left) / anchorRectangle.width)),
      y: Math.max(0.01, Math.min(0.99, (event.clientY - anchorRectangle.top) / anchorRectangle.height)),
      sheetX,
      sheetY,
    });
    setStudioCommentText("");
    setStudioCommentStatus("idle");
    window.requestAnimationFrame(() => studioCommentInputRef.current?.focus());
  };
  const submitStudioComment = async () => {
    const text = studioCommentText.trim();
    if (!studioCommentComposer || !text || studioCommentStatus === "saving") return;
    setStudioCommentStatus("saving");
    try {
      const comment = await createStudioComment(selectedStudioDocumentKey, {
        anchor: studioCommentComposer.anchor,
        coordinateSpace: studioCommentComposer.coordinateSpace,
        x: studioCommentComposer.x,
        y: studioCommentComposer.y,
        text,
      });
      setStudioComments((current) => [...current, comment]);
      setStudioCommentComposer(null);
      setStudioCommentText("");
      setStudioCommentStatus("idle");
    } catch {
      setStudioCommentStatus("error");
    }
  };
  const completeComment = async (comment: StudioComment) => {
    if (comment.completed || studioCommentAction) return;
    setStudioCommentAction(comment.id);
    try {
      const completed = await completeStudioComment(selectedStudioDocumentKey, comment.id);
      setStudioComments((current) => current.map((item) => item.id === comment.id ? completed : item));
    } finally {
      setStudioCommentAction(null);
    }
  };
  const removeComment = async (comment: StudioComment) => {
    if (studioCommentAction) return;
    setStudioCommentAction(comment.id);
    try {
      await deleteStudioComment(selectedStudioDocumentKey, comment.id);
      setStudioComments((current) => current.filter((item) => item.id !== comment.id));
      setActiveStudioComment(null);
    } finally {
      setStudioCommentAction(null);
    }
  };
  const studioOrder = (key: StudioBlockKey) => studioBlockOrder.indexOf(key) + 1;
  const studioBlockClass = (key: StudioBlockKey, base: string) => `${base}${studioMode ? " studio-editable-block" : ""}${studioMode && studioSelectedBlock === key ? " studio-block-selected" : ""}`;
  const studioSelectionProps = (key: StudioBlockKey) => studioMode ? {
    role: "button" as const,
    tabIndex: 0,
    onClick: () => setStudioSelectedBlock(key),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") setStudioSelectedBlock(key);
    },
  } : {};
  const prepareStudioReorderAnimation = () => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-studio-order-key]"));
    const previousPositions = elements.map((element) => ({ element, rectangle: element.getBoundingClientRect() }));
    return () => window.requestAnimationFrame(() => previousPositions.forEach(({ element, rectangle }) => {
      const nextRectangle = element.getBoundingClientRect();
      const offsetX = rectangle.left - nextRectangle.left;
      const offsetY = rectangle.top - nextRectangle.top;
      if (!offsetX && !offsetY) return;
      element.animate([
        { transform: `translate(${offsetX}px, ${offsetY}px)` },
        { transform: "translate(0, 0)" },
      ], { duration: 480, easing: "cubic-bezier(.22,.78,.22,1)" });
    }));
  };
  const moveStudioBlock = (key: LayoutBlockKey, direction: -1 | 1) => {
    const animateReorder = prepareStudioReorderAnimation();
    const index = studioBlockOrder.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= studioBlockOrder.length) return;
    const next = [...studioBlockOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setStudioBlockOrder(next);
    updateStudioDraft("layout.order", next.join(","));
    animateReorder();
  };
  const dropStudioBlock = (target: LayoutBlockKey) => {
    if (!studioDraggedBlock || studioDraggedBlock === target) return;
    const animateReorder = prepareStudioReorderAnimation();
    const sourceIndex = studioBlockOrder.indexOf(studioDraggedBlock);
    const targetIndex = studioBlockOrder.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) return;
      const next = [...studioBlockOrder];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
    setStudioBlockOrder(next);
    updateStudioDraft("layout.order", next.join(","));
    setStudioDraggedBlock(null);
    animateReorder();
  };
  const toggleStudioBlock = (key: LayoutBlockKey) => {
    const next = studioHiddenBlocks.includes(key)
      ? studioHiddenBlocks.filter((item) => item !== key)
      : [...studioHiddenBlocks, key];
    setStudioHiddenBlocks(next);
    updateStudioDraft("layout.hidden", next.length ? next.join(",") : "none");
  };
  const studioList = <StudioBlockList order={studioBlockOrder} hidden={studioHiddenBlocks} selected={studioSelectedBlock} onSelect={setStudioSelectedBlock} onMove={moveStudioBlock} onToggle={toggleStudioBlock} onDragStart={setStudioDraggedBlock} onDrop={dropStudioBlock} />;

  const downloadReportHtml = async () => {
    const sourceSheet = reportSheetRef.current;
    if (!sourceSheet) return;

    const exportSheet = sourceSheet.cloneNode(true) as HTMLElement;
    exportSheet.classList.remove("is-loading");
    exportSheet.classList.add("is-ready");
    exportSheet.querySelectorAll(".expandable-section").forEach((section) => section.classList.add("is-open"));
    exportSheet.querySelectorAll(".show-more-button, .tienda-accent-picker").forEach((element) => element.remove());

    await Promise.all(Array.from(exportSheet.querySelectorAll("img")).map(async (image) => {
      try {
        const response = await fetch(new URL(image.getAttribute("src") || "", window.location.href));
        if (response.ok) image.src = await blobToDataUrl(await response.blob());
      } catch {
        image.src = new URL(image.getAttribute("src") || "", window.location.href).href;
      }
    }));

    const styles = Array.from(document.styleSheets).map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    }).join("\n");
    const safeTitle = selectedLabel.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
    const exportCss = `
      * { box-sizing: border-box; }
      html, body { min-height: 100%; margin: 0; background: #f3f3f5; }
      body { padding: 32px; }
      .sheet { width: min(1160px, 100%); min-height: 0; margin: 0 auto; overflow: visible; }
      .expandable-section { grid-template-rows: 1fr !important; opacity: 1 !important; }
      .sheet, .report-content, .report-lead, .survey-lead, .metric-grid, .survey-kpis, .dashboard-grid, .survey-grid { animation: none !important; }
      .export-actions { position: sticky; z-index: 50; top: 18px; width: max-content; margin: 0 0 18px auto; }
      .export-actions button { padding: 11px 17px; border: 0; border-radius: 999px; background: #1d1d1f; color: #fff; font: 650 13px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.16); }
      @media print {
        @page { size: A4; margin: 10mm; }
        html, body { background: #fff !important; }
        body { padding: 0 !important; }
        .export-actions, .sheet-toolbar, .survey-toolbar { display: none !important; }
        .sheet { width: 100% !important; margin: 0 !important; padding: 12mm 10mm !important; border: 0 !important; box-shadow: none !important; }
        .panel, .metric-grid, .survey-kpis, .course-table button, .people-summary, .person-row { break-inside: avoid; }
      }
    `;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${styles}\n${exportCss}</style></head><body><div class="export-actions"><button type="button" onclick="window.print()">Guardar como PDF</button></div>${exportSheet.outerHTML}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${textKey(selectedLabel).replace(/\s+/g, "-") || "reporte"}-${period}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (studioAccessError) {
    return <main className="studio-access-denied" role="alert"><div><span>MACINTOSH STUDIO</span><h1>Enlace no disponible</h1><p>{studioAccessError}</p></div></main>;
  }

  if (!selectedCategories.length && !openBook) {
    return <div className="site-page library-page">
      <header className="site-header library-header">
        <UniversityBrand onClick={() => undefined} />
        <strong className="header-section-title">{studioMode ? "Studio" : "Reportes"}</strong>
        <span className="library-header-actions"><span className="library-count">{libraryReports.length.toLocaleString("es-MX")} reportes</span>{!studioMode && <a href="/studio" className="open-studio-button" aria-label="Abrir Macintosh Studio" title="Abrir Macintosh Studio"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.6-10.6a2.1 2.1 0 0 0 0-3L17.6 5a2.1 2.1 0 0 0-3 0L4 15.6V20Z"/><path d="m13.2 6.5 4.3 4.3"/></svg></a>}</span>
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
          const chapters = collectionChapters(category.key);
          const isCollection = category.key === "tienda" || category.key === "staff_collection" || category.key === "training_plans_collection";
          return <button className={isCollection ? "book-card collection" : "book-card"} key={category.key} onClick={() => selectLibraryReport(category.key)} style={{ animationDelay: `${index * 45}ms` }}>
            {isCollection ? <CollectionBookCover category={category} chapters={chapters} /> : <ReportCover category={displayCategory(category)} />}
            <span className="book-card-copy"><span className="report-family-tag">{studioMode ? "Plantilla" : family.label}</span><strong>{displayCategoryLabel(category)}</strong><small>{studioMode ? "Composición compartida de la colección" : family.description}</small></span>
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
        <span className={`sync-status ${syncState}`} title={syncTitle}>
          <i /> {syncLabel}
        </span>
      </header>

      <section className="page-intro">
        <button className="report-back-button" onClick={returnToLibrary}>
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 18 9 12l6-6" /></svg></span>
          {studioMode ? "Volver a Studio" : "Todos los reportes"}
        </button>
        <h1>{studioMode ? "Studio" : "Reportes"}</h1>
        <p>{studioMode ? "Edita los textos y organiza la presentación visual de cada reporte." : showEicReport ? "Consulta presupuesto, inversión, cotizaciones, capacitaciones y pagos de las áreas de la Dirección de Administración." : reportIsSurvey ? "Explora satisfacción, recomendación y desempeño por programa e instructor." : "Consulta el avance mensual, compara regiones y encuentra cursos pendientes."}</p>
      </section>

    <main className={`${readerMode ? "workspace-shell reader-mode" : "workspace-shell"}${studioMode ? " studio-workspace" : ""}`}>
      <aside className="filter-rail">
        <header className="rail-heading">
          <div><span className="eyebrow">CATÁLOGO</span><h1>{studioMode ? "Studio" : "Reportes"}</h1></div>
          <div className="rail-heading-actions">
            <button type="button" className="reader-mode-toggle" onClick={() => setReaderMode(true)} aria-label="Ocultar navegación y ampliar reporte" title="Ampliar reporte"><span className="pane-icon" aria-hidden="true" /></button>
            <span className={`data-dot ${syncState}`} title={syncTitle} />
          </div>
        </header>

        <label className="rail-search"><i aria-hidden="true">⌕</i><input value={reportQuery} onChange={(event) => setReportQuery(event.target.value)} placeholder="Buscar reporte" /></label>
        <div className="rail-section-title"><span>Reportes</span><small>{filteredReports.length}</small></div>
        <nav className="category-list" aria-label="Categorías del reporte">
          {filteredReports.map((category) => {
            const chapters = visibleCollectionChapters(category.key);
            const collectionKey = category.key === "tienda" ? "tienda" : category.key === "staff_collection" ? "staff" : category.key === "training_plans_collection" ? "training_plans" : null;
            if (collectionKey) return <div className="category-collection" key={category.key}>
              <button className="category collection-category" onClick={() => {
                const nextOpen = expandedBook === category.key ? null : category.key;
                setExpandedBook(nextOpen);
                if (studioMode && nextOpen) {
                  const template = collectionChapters(category.key)[0];
                  if (template) {
                    setOpenBook(collectionKey);
                    selectCategory(template.key);
                  }
                }
              }} aria-expanded={expandedBook === category.key}>
                <CollectionBookCover category={category} chapters={collectionChapters(category.key)} compact />
                <span className="category-copy"><span>{category.label}</span><small>{studioMode ? "1 plantilla" : `${collectionChapters(category.key).length} capítulos`}</small></span>
              </button>
              <div className={expandedBook === category.key ? "chapter-subnotes open" : "chapter-subnotes"}>
                {studioMode ? selectedCategories.some((key) => collectionChapters(category.key).some((chapter) => chapter.key === key)) && studioList : chapters.map((chapter, index) => <div className="studio-chapter-entry" key={chapter.key}>
                  <button
                    className={selectedCategories.includes(chapter.key) ? "category chapter-note active" : "category chapter-note"}
                    onClick={() => { setOpenBook(collectionKey); selectCategory(chapter.key); }}
                    onContextMenu={(event) => { event.preventDefault(); selectCategory(chapter.key, true); }}
                    aria-pressed={selectedCategories.includes(chapter.key)}
                    title="Clic izquierdo para cambiar · clic derecho para combinar"
                    style={{ "--note-color": collectionTabColors[index % collectionTabColors.length] } as CSSProperties}
                  >
                    <span className="chapter-note-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="category-copy"><span>{displayCategoryLabel(chapter)}</span><small>Capítulo de {category.label}</small></span>
                  </button>
                </div>)}
              </div>
            </div>;
            return <div className="studio-category-entry" key={category.key}><button
                className={selectedCategories.includes(category.key) ? "category active" : "category"}
                onClick={() => { setOpenBook(null); setExpandedBook(null); selectCategory(category.key); }}
                onContextMenu={studioMode ? undefined : (event) => { event.preventDefault(); selectCategory(category.key, true); }}
                aria-pressed={selectedCategories.includes(category.key)}
                title={studioMode ? "Seleccionar colección" : "Clic izquierdo para cambiar · clic derecho para combinar"}
              >
                <ReportCover category={displayCategory(category)} compact />
                <span className="category-copy"><span>{displayCategoryLabel(category)}</span><small>{studioMode ? "1 plantilla" : reportFamily(category).label}</small></span>
              </button>
              {studioMode && selectedCategories.includes(category.key) && !reportIsSurvey && studioList}</div>;
          })}
        </nav>

      </aside>

      <section className="report-space" key={selectedCategories.join("|")}>
        <header className="topbar">
          <div className="report-name"><ReportCover category={displayCategory(selectedCategory)} compact /><span><strong title={selectedLabel}>{selectedLabel}</strong><small>{studioMode ? "Plantilla de colección" : selectedReportOptions.length > 1 ? `Combinado · ${selectedReportOptions.length} reportes` : reportFamily(selectedCategory).label} · {reportPeriodLabel}</small></span></div>
          <div className="topbar-actions">
            <button type="button" className="reader-mode-toggle reader-mode-restore" onClick={() => setReaderMode(false)} aria-label="Mostrar navegación y restaurar tamaño" title="Mostrar navegación"><span className="pane-icon" aria-hidden="true" /></button>
            <span className={`status-pill ${syncState}`} title={syncTitle}>{syncLabel}</span>
            {studioMode && <button
              type="button"
              className={`studio-save-button${studioDirty ? " has-changes" : ""}${studioSaveStatus === "error" ? " has-error" : ""}`}
              disabled={!studioDirty || studioSaveStatus === "saving"}
              onClick={() => void saveStudioChanges()}
              title={studioSaveStatus === "error" ? "No se pudo guardar. Tus cambios permanecen en este navegador." : studioDirty ? "Guardar cambios" : "No hay cambios pendientes"}
            >{studioSaveStatus === "saving" ? "Guardando…" : "Guardar"}</button>}
            {!studioMode && <button
              type="button"
              className="download-report-button"
              onClick={() => void downloadReportHtml()}
              aria-label="Descargar reporte en HTML"
              title="Descargar reporte en HTML"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 19h14" /></svg>
            </button>}
          </div>
        </header>

        <div className="report-scroll" ref={reportScrollRef}>
          <article className={`${reportLoading ? "sheet is-loading" : "sheet is-ready"}${openBook === "tienda" ? " tienda-themed" : ""}${reportIsSurvey ? " survey-themed" : ""}${showEicReport ? " eic-themed" : ""}${studioMode ? " studio-comment-surface" : ""}`} ref={reportSheetRef} onContextMenu={studioMode ? openStudioCommentComposer : undefined} style={openBook === "tienda" ? { "--tienda-accent": institutionalPalette.accent, "--tienda-secondary": institutionalPalette.secondary, "--tienda-deep": institutionalPalette.deep, "--tienda-action": institutionalPalette.accent } as CSSProperties : reportIsSurvey ? { "--survey-accent": satisfactionPalette.accent, "--survey-secondary": satisfactionPalette.secondary, "--survey-deep": satisfactionPalette.deep, "--survey-action": satisfactionPalette.accent } as CSSProperties : undefined}>
            <header className={openBook === "tienda" ? "sheet-title tienda-letterhead" : reportIsSurvey ? "sheet-title tienda-letterhead survey-letterhead" : showEicReport ? "sheet-title tienda-letterhead eic-letterhead" : "sheet-title"}>
              {openBook === "tienda" && <div className="tienda-letterhead-top">
                <div className="tienda-letterhead-logo"><img src="/coppel-universidad-logo-black-v2.png" alt="Coppel Universidad Corporativa · Academia de Ventas" /></div>
              </div>}
              {reportIsSurvey && <div className="survey-letterhead-top">
                <div className="survey-letterhead-logo"><img src="/coppel-universidad-logo-black-v2.png" alt="Coppel Universidad Corporativa" /></div>
              </div>}
              {showEicReport && <div className="eic-letterhead-top">
                <div className="eic-letterhead-logo"><img src="/coppel-universidad-logo-black-v2.png" alt="Coppel Universidad Corporativa" /></div>
              </div>}
              <div className="sheet-title-copy">{openBook !== "tienda" && !reportIsSurvey && !showEicReport && <span className="eyebrow">{peopleMode ? "CURSOS PENDIENTES" : "DOCUMENTO DE RESULTADOS"}</span>}<h2>{reportIsSurvey ? "Satisfacción" : showEicReport ? eicReportTitle : peopleMode ? "Detalle por colaborador" : "Reporte de capacitación"}</h2></div>
            </header>

            {reportLoading ? <ReportSkeleton survey={reportIsSurvey} /> : <div className={!activeSurvey && !activeEic && !peopleMode ? "report-content studio-report-content" : "report-content"}>
            {!activeSurvey && !activeEic && <div className="floating-toolbar-frame"><div className={peopleMode ? "sheet-toolbar people" : "sheet-toolbar"} aria-label="Filtros del reporte">
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
                    <PopupFilter label="Región" className="region-filter" value={regionFilterChosen ? region : undefined} options={[{ value: "all", label: "Todos" }, ...availableRegions.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "people-region"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "people-region" : current === "people-region" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={(value) => { setRegionFilterChosen(true); setRegion(value); }} />
                    <PopupFilter label="Cursos" className="course-filter" value={courseFilterChosen ? course : undefined} options={[{ value: "all", label: "Todos" }, ...availableCourses.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "people-course"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "people-course" : current === "people-course" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={(value) => { setCourseFilterChosen(true); setCourse(value); }} />
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
                    <PopupFilter label="Región" className="region-filter" value={regionFilterChosen ? region : undefined} options={[{ value: "all", label: "Todos" }, ...availableRegions.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "region"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "region" : current === "region" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={(value) => { setRegionFilterChosen(true); setRegion(value); }} />
                    <PopupFilter label="Cursos" className="course-filter" value={courseFilterChosen ? course : undefined} options={[{ value: "all", label: "Todos" }, ...availableCourses.map((item) => ({ value: item, label: item }))]} open={openFilterMenu === "course"} onOpenChange={(open) => { setOpenFilterMenu((current) => open ? "course" : current === "course" ? null : current); if (open) setPositionMenuOpen(false); }} onChange={(value) => { setCourseFilterChosen(true); setCourse(value); }} />
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

            {openBook === "tienda" && !tiendaPeriodReady ? <section className="filter-empty-state"><span>PERIODO REQUERIDO</span><h3>Selecciona Año y Mes</h3><p>El reporte permanecerá vacío hasta que definas el periodo que deseas consultar.</p></section> : activeSurvey ? <SatisfactionReport key={`${activeSurvey.category}/${activeSurvey.period}`} dashboard={activeSurvey} details={surveyDetails} detailsError={surveyDetailsError} /> : activeEic ? <EicStatusReport key={`${activeEicDashboards.map((dashboard) => dashboard.category).join("+")}/${activeEic.period}`} dashboards={activeEicDashboards} layoutOrder={studioBlockOrder as EicBlockKey[]} hiddenBlocks={studioHiddenBlocks as EicBlockKey[]} studioMode={studioMode} selectedBlock={studioSelectedBlock as EicBlockKey} onSelectBlock={setStudioSelectedBlock} copy={studioCopy} onCopyChange={updateStudioCopy} /> : <>{!studioHiddenBlocks.includes("intro") && <section data-studio-order-key="intro" className={studioBlockClass("intro", "report-lead")} style={{ order: studioOrder("intro") }} onClick={studioMode ? () => setStudioSelectedBlock("intro") : undefined} onKeyDown={studioMode ? (event) => { if (event.key === "Enter" || event.key === " ") setStudioSelectedBlock("intro"); } : undefined} role={studioMode ? "button" : undefined} tabIndex={studioMode ? 0 : undefined}>
              {!studioMode && <EditableCopy value={selectedLabel} as="h3" enabled={false} onChange={() => {}} />}
              <EditableCopy value={studioCopy("intro.description", peopleMode ? "Listado de colaboradores con uno o más cursos pendientes según los filtros seleccionados." : "Concentrado mensual de avance, asignaciones y pendientes. Los indicadores se actualizan con la información publicada desde Macintosh." )} as="p" enabled={studioMode && !peopleMode} onChange={(value) => updateStudioCopy("intro.description", value)} />
              <small>{studioMode ? `Datos ficticios para edición visual · Periodo de muestra ${period}.` : usingDemo ? "Aún no hay datos sincronizados para este periodo. Publica la información desde Macintosh." : `Fecha de corte del periodo ${period}.`}</small>
            </section>}

            {!peopleMode ? (
              <>
                {!studioHiddenBlocks.includes("metrics") && <section data-studio-order-key="metrics" className={studioBlockClass("metrics", "metric-grid")} style={{ order: studioOrder("metrics") }} onClick={studioMode ? () => setStudioSelectedBlock("metrics") : undefined} onKeyDown={studioMode ? (event) => { if (event.key === "Enter" || event.key === " ") setStudioSelectedBlock("metrics"); } : undefined} role={studioMode ? "button" : undefined} tabIndex={studioMode ? 0 : undefined}>
                  <article><EditableCopy value={studioCopy("metrics.progress", "Avance total")} enabled={studioMode} onChange={(value) => updateStudioCopy("metrics.progress", value)} /><strong>{hasTrainingData ? `${totals.progress.toFixed(1)}%` : "—"}</strong><small>{hasTrainingData ? `${totals.completed.toLocaleString("es-MX")} completados` : "Sin datos"}</small></article>
                  <article><EditableCopy value={studioCopy("metrics.assigned", "Total asignado")} enabled={studioMode} onChange={(value) => updateStudioCopy("metrics.assigned", value)} /><strong>{hasTrainingData ? totals.total.toLocaleString("es-MX") : "—"}</strong><small>{hasTrainingData ? `${filteredMetrics.length.toLocaleString("es-MX")} combinaciones` : "Sin datos"}</small></article>
                  <article><EditableCopy value={studioCopy("metrics.pending", "Pendientes")} enabled={studioMode} onChange={(value) => updateStudioCopy("metrics.pending", value)} /><strong>{hasTrainingData ? totals.pending.toLocaleString("es-MX") : "—"}</strong><small>{hasTrainingData ? `${(100 - totals.progress).toFixed(1)}% del total` : "Sin datos"}</small></article>
                </section>}

                <section className="dashboard-grid studio-dashboard-grid">
                  {!studioHiddenBlocks.includes("chart") && <article data-studio-order-key="chart" className={studioBlockClass("chart", "panel chart-panel")} style={{ order: studioOrder("chart") }} {...studioSelectionProps("chart")}>
                    <div className="panel-heading"><div><EditableCopy value={studioCopy("chart.title", "Avance mensual")} enabled={studioMode} onChange={(value) => updateStudioCopy("chart.title", value)} /><EditableCopy value={studioCopy("chart.subtitle", "Comparativo del año")} as="small" enabled={studioMode} onChange={(value) => updateStudioCopy("chart.subtitle", value)} /></div><b>{hasTrainingData ? `${totals.progress.toFixed(1)}%` : "—"}</b></div>
                    {history.length ? <div className="bars" aria-label="Gráfica de avance mensual">{history.map((item) => <div className="bar-column" key={item.label}><em>{item.value}%</em><div style={{ height: `${Math.max(item.value, 4)}%` }} /><small>{item.label}</small></div>)}</div> : <p className="comments-empty">Sin datos para el periodo seleccionado.</p>}
                  </article>}
                  {!studioHiddenBlocks.includes("ranking") && <article data-studio-order-key="ranking" className={studioBlockClass("ranking", "panel ranking-panel")} style={{ order: studioOrder("ranking") }} {...studioSelectionProps("ranking")}>
                    <div className="panel-heading"><div><EditableCopy value={studioCopy("ranking.title", "Ranking regional")} enabled={studioMode} onChange={(value) => updateStudioCopy("ranking.title", value)} /><EditableCopy value={studioCopy("ranking.subtitle", "Avance promedio")} as="small" enabled={studioMode} onChange={(value) => updateStudioCopy("ranking.subtitle", value)} /></div></div>
                    {regionalRanking.length ? regionalRanking.slice(0, 5).map((item, index) => <div className="rank-row" key={item.label}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.label}</span><strong>{item.progress.toFixed(1)}%</strong></div>) : <p className="comments-empty">Sin datos para los filtros seleccionados.</p>}
                    <div className={showAllRegions ? "expandable-section is-open" : "expandable-section"}><div>{regionalRanking.slice(5).map((item, index) => <div className="rank-row" key={item.label}><b>{String(index + 6).padStart(2, "0")}</b><span>{item.label}</span><strong>{item.progress.toFixed(1)}%</strong></div>)}</div></div>
                    {regionalRanking.length > 5 && <button className="show-more-button" onClick={() => setShowAllRegions((current) => !current)}><span>{showAllRegions ? "Mostrar menos" : `Ver ${regionalRanking.length - 5} más`}</span><span className="more-icon-shell more-glyph" aria-hidden="true">{showAllRegions ? "−" : "+"}</span></button>}
                  </article>}
                  {!studioHiddenBlocks.includes("courses") && <article data-studio-order-key="courses" className={studioBlockClass("courses", "panel course-panel")} style={{ order: studioOrder("courses") }} {...studioSelectionProps("courses")}>
                    <div className="panel-heading"><div><EditableCopy value={studioCopy("courses.title", "Avance por curso")} enabled={studioMode} onChange={(value) => updateStudioCopy("courses.title", value)} /><EditableCopy value={studioCopy("courses.subtitle", "Progreso consolidado de los cursos visibles")} as="small" enabled={studioMode} onChange={(value) => updateStudioCopy("courses.subtitle", value)} /></div></div>
                    {courseProgress.length ? <div className="course-table">{courseProgress.slice(0, 7).map((item) => <button type="button" disabled key={item.label}><span><em>{item.label}</em><small>{item.completed.toLocaleString("es-MX")} de {item.total.toLocaleString("es-MX")}</small></span><i><b style={{ width: `${item.progress}%` }} /></i><strong>{item.progress.toFixed(1)}%</strong></button>)}<div className={showAllCourses ? "expandable-section is-open" : "expandable-section"}><div>{courseProgress.slice(7).map((item) => <button type="button" disabled key={item.label}><span><em>{item.label}</em><small>{item.completed.toLocaleString("es-MX")} de {item.total.toLocaleString("es-MX")}</small></span><i><b style={{ width: `${item.progress}%` }} /></i><strong>{item.progress.toFixed(1)}%</strong></button>)}</div></div></div> : <p className="comments-empty">Sin datos para los filtros seleccionados.</p>}
                    {courseProgress.length > 7 && <button className="show-more-button" onClick={() => setShowAllCourses((current) => !current)}><span>{showAllCourses ? "Mostrar menos" : `Ver ${courseProgress.length - 7} más`}</span><span className="more-icon-shell more-glyph" aria-hidden="true">{showAllCourses ? "−" : "+"}</span></button>}
                  </article>}
                </section>
              </>
            ) : (
              <section className="people-results">
                <div className={pendingError ? "people-summary error" : "people-summary"}><span>{loadingPending ? "Cargando colaboradores…" : pendingError || `${visiblePending.length.toLocaleString("es-MX")} pendientes encontrados`}</span><small>{pendingError ? "Verifica que Macintosh esté encendido." : "La búsqueda utiliza únicamente los bloques de las secciones elegidas."}</small></div>
                <div className="people-table"><div className="people-table-head"><span>Colaborador</span><span>Puesto</span><span>Región</span><span>Curso pendiente</span></div>{visiblePending.slice(0, 100).map((person, index) => <div className="person-row" key={`${person.numero_persona}-${person.curso}-${index}`}><span><b>{person.nombre}</b><small>{person.numero_persona} · Tienda {person.tienda ?? "—"}</small></span><span>{person.puesto}</span><span>{person.region}</span><span>{person.curso}</span></div>)}</div>
              </section>
            )}</>}
            {openBook === "tienda" && <footer className="tienda-confidentiality"><strong>La información contenida en la totalidad de este documento constituye un secreto de marca y/o información de Grupo Coppel; y deberá tratarse de acuerdo con las Decisiones, Políticas y Procesos vigentes en la organización.</strong></footer>}
            </div>}
            {studioMode && <div className="studio-comment-layer" aria-label="Comentarios fijados en la hoja">
              {studioComments.map((comment, index) => {
                const position = comment.anchor !== "sheet"
                  ? studioCommentPositions[comment.id]
                  : { x: comment.x, y: comment.y };
                if (!position) return null;
                return <div
                className={`studio-comment-pin${comment.completed ? " is-completed" : ""}${activeStudioComment === comment.id ? " is-open" : ""}${position.x < 0.18 ? " tooltip-align-left" : position.x > 0.82 ? " tooltip-align-right" : ""}${position.y < 0.12 ? " tooltip-below" : ""}`}
                key={comment.id}
                style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
                onContextMenu={(event) => event.stopPropagation()}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveStudioComment(null); }}
              >
                <button
                  type="button"
                  className="studio-comment-marker"
                  aria-label={`Comentario ${index + 1}: ${comment.text}`}
                  aria-expanded={activeStudioComment === comment.id}
                  onClick={(event) => { event.stopPropagation(); setActiveStudioComment((current) => current === comment.id ? null : comment.id); }}
                >{comment.completed ? <span aria-hidden="true">✓</span> : <span aria-hidden="true">{index + 1}</span>}</button>
                <aside aria-label={`Detalle del comentario ${index + 1}`}>
                  <p>{comment.text}</p>
                  <small>{comment.completed && comment.completedAt
                    ? `Completado · ${new Date(comment.completedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`
                    : comment.createdAt ? new Date(comment.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Comentario compartido"}</small>
                  <div className="studio-comment-actions">
                    {!comment.completed && <button type="button" disabled={studioCommentAction === comment.id} onClick={() => void completeComment(comment)}><span aria-hidden="true">✓</span> Completar</button>}
                    <button type="button" className="delete" disabled={studioCommentAction === comment.id} onClick={() => void removeComment(comment)} aria-label="Eliminar comentario"><span aria-hidden="true">⌫</span> Eliminar</button>
                  </div>
                </aside>
              </div>})}
              {studioCommentComposer && <form
                className={`studio-comment-composer${studioCommentComposer.sheetX > 0.68 ? " align-right" : ""}${studioCommentComposer.sheetY > 0.82 ? " align-up" : ""}`}
                style={{ left: `${studioCommentComposer.sheetX * 100}%`, top: `${studioCommentComposer.sheetY * 100}%` }}
                onSubmit={(event) => { event.preventDefault(); void submitStudioComment(); }}
              >
                <strong>Fijar comentario</strong>
                <textarea
                  ref={studioCommentInputRef}
                  maxLength={500}
                  value={studioCommentText}
                  onChange={(event) => setStudioCommentText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Escape") setStudioCommentComposer(null); }}
                  placeholder="Escribe una observación…"
                />
                {studioCommentStatus === "error" && <small>No se pudo guardar. Intenta nuevamente.</small>}
                <div><button type="button" onClick={() => setStudioCommentComposer(null)}>Cancelar</button><button type="submit" disabled={!studioCommentText.trim() || studioCommentStatus === "saving"}>{studioCommentStatus === "saving" ? "Fijando…" : "Fijar"}</button></div>
              </form>}
            </div>}
          </article>
        </div>
      </section>
    </main>
    </div>
  );
}
