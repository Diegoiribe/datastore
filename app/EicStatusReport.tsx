"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CategoryDashboard,
  EicAdministrativeRow,
  EicAdministrativeViews,
  loadAdministrativeViews,
} from "../lib/dashboard-data";
import PopupFilter from "./ToolbarPopupFilter";

function text(row: EicAdministrativeRow, key: string, fallback = "Sin especificar") {
  const value = row[key];
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function number(row: EicAdministrativeRow, key: string) {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function sum(rows: EicAdministrativeRow[], key: string) {
  return rows.reduce((total, row) => total + number(row, key), 0);
}

function optionalSum(rows: EicAdministrativeRow[], key: string) {
  return rows.some((row) => row[key] !== null && row[key] !== undefined && row[key] !== "") ? sum(rows, key) : null;
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function displayValue(value: number | null) {
  return value === null ? "—" : value.toLocaleString("es-MX");
}

function normalizeLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function modalityLabel(value: string) {
  const normalized = normalizeLabel(value);
  if (/presencial/.test(normalized)) return "Presencial";
  if (/hibrid|mixt/.test(normalized)) return "Híbrida";
  if (/online|linea|virtual|remot/.test(normalized)) return "Online";
  return value === "Sin especificar" ? "Sin modalidad" : value;
}

function statusTone(label: string) {
  const key = label.toLocaleLowerCase("es");
  if (/impartid|seleccionado|con fecha|complet|finaliz/.test(key)) return "good";
  if (/curso|proceso|espera|pendiente|seleccionar|prepar/.test(key)) return "warning";
  if (/eliminad|cancel|sin estatus/.test(key)) return "muted";
  return "neutral";
}

function groupStatus(rows: EicAdministrativeRow[], labelKey: string, valueKey: string) {
  const groups = new Map<string, number>();
  rows.forEach((row) => {
    const label = text(row, labelKey, "Sin estatus");
    groups.set(label, (groups.get(label) ?? 0) + number(row, valueKey));
  });
  return [...groups].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

type RankingColumnKey = "puesto" | "area" | "cursos" | "inversion";

const rankingColumns: Array<{ key: RankingColumnKey; label: string; numeric?: boolean }> = [
  { key: "puesto", label: "Puesto" },
  { key: "area", label: "Área" },
  { key: "cursos", label: "Cursos", numeric: true },
  { key: "inversion", label: "Inversión actual", numeric: true },
];

export default function EicStatusReport({
  dashboards,
}: {
  dashboards: CategoryDashboard[];
}) {
  const [views, setViews] = useState<EicAdministrativeViews>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cLevel, setCLevel] = useState("all");
  const [initiativeQuery, setInitiativeQuery] = useState("");
  const [initiativeStatus, setInitiativeStatus] = useState("all");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [authorizedNav, setAuthorizedNav] = useState({ back: false, forward: true });
  const [rankingColumn, setRankingColumn] = useState<RankingColumnKey>("puesto");
  const [rankingOptionalSlots, setRankingOptionalSlots] = useState(4);
  const authorizedWindowRef = useRef<HTMLDivElement>(null);
  const rankingTableRef = useRef<HTMLDivElement>(null);
  const primaryDashboard = dashboards[0];

  useEffect(() => {
    let active = true;
    Promise.all(dashboards.map(async (dashboard) => ({
      category: dashboard.category,
      views: await loadAdministrativeViews(dashboard),
    })))
      .then((loadedDashboards) => {
        if (!active) return;
        const merged = loadedDashboards.reduce<EicAdministrativeViews>((result, loaded) => {
          Object.entries(loaded.views).forEach(([view, rows]) => {
            result[view] = [
              ...(result[view] ?? []),
              ...rows.map((row) => ({ ...row, __source_category: loaded.category })),
            ];
          });
          return result;
        }, {});
        setViews(merged);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las vistas administrativas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dashboards]);

  useEffect(() => {
    const node = authorizedWindowRef.current;
    if (!node || loading) return;
    const sync = () => setAuthorizedNav({
      back: node.scrollLeft > 2,
      forward: node.scrollLeft + node.clientWidth < node.scrollWidth - 2,
    });
    const fitWholeCards = () => {
      if (!node.clientWidth) return;
      const totalCards = 9;
      const targetWidth = 94;
      const allCardsFit = node.clientWidth >= totalCards * targetWidth;
      const visibleCards = allCardsFit ? totalCards : Math.max(2, Math.floor(node.clientWidth / targetWidth));
      const cardWidth = allCardsFit ? targetWidth : node.clientWidth / visibleCards;
      const previousWidth = node.querySelector<HTMLElement>("article")?.offsetWidth || targetWidth;
      const currentCard = Math.round(node.scrollLeft / previousWidth);
      node.style.setProperty("--authorized-card-width", `${cardWidth}px`);
      node.scrollLeft = currentCard * cardWidth;
      sync();
    };
    fitWholeCards();
    const observer = new ResizeObserver(fitWholeCards);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cLevel, loading, views]);

  useEffect(() => {
    const node = rankingTableRef.current;
    if (!node || loading) return;
    const sync = () => {
      const width = node.clientWidth;
      setRankingOptionalSlots(width >= 1020 ? 4 : width >= 820 ? 3 : width >= 650 ? 2 : 1);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, views.collaborator_ranking]);

  const moveAuthorizedPlan = (direction: -1 | 1) => {
    const node = authorizedWindowRef.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("article");
    node.scrollBy({ left: direction * (card?.offsetWidth ?? 110), behavior: "smooth" });
  };

  const allDirections = useMemo(() => views.directions ?? [], [views.directions]);
  const cLevels = useMemo(() => [...new Set((views.c_level ?? []).map((row) => text(row, "direccion_c_level")))].sort(), [views.c_level]);
  const filteredDirections = useMemo(() => allDirections.filter((row) =>
    cLevel === "all" || text(row, "direccion_c_level") === cLevel
  ), [allDirections, cLevel]);

  const inScope = useCallback((row: EicAdministrativeRow) =>
    cLevel === "all" || text(row, "direccion_c_level") === cLevel, [cLevel]);
  const initiatives = useMemo(() => (views.initiatives ?? []).filter(inScope), [views.initiatives, inScope]);
  const initiativeStatuses = useMemo(() => [...new Set(initiatives.map((row) =>
    text(row, "estatus_grupo_principal", text(row, "estatus_cotizacion", "Sin estatus"))
  ))].sort(), [initiatives]);
  const effectiveInitiativeStatus = initiativeStatus === "all" || initiativeStatuses.includes(initiativeStatus) ? initiativeStatus : "all";
  const visibleInitiatives = useMemo(() => {
    const query = initiativeQuery.trim().toLocaleLowerCase("es");
    return initiatives.filter((row) => {
      const status = text(row, "estatus_grupo_principal", text(row, "estatus_cotizacion", "Sin estatus"));
      const matchesStatus = effectiveInitiativeStatus === "all" || status === effectiveInitiativeStatus;
      const matchesQuery = !query || [
        text(row, "identificador", ""),
        text(row, "nombre_iniciativa", ""),
        text(row, "direccion_c_level", ""),
        text(row, "proveedor_seleccionado", ""),
        status,
      ].join(" ").toLocaleLowerCase("es").includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [effectiveInitiativeStatus, initiativeQuery, initiatives]);
  const quotationRows = useMemo(() => (views.quotation_status ?? []).filter(inScope), [views.quotation_status, inScope]);
  const trainingRows = useMemo(() => (views.training_status ?? []).filter(inScope), [views.training_status, inScope]);
  const paymentRows = useMemo(() => (views.payment_status ?? []).filter(inScope), [views.payment_status, inScope]);
  const trainingGroups = useMemo(() => (views.training_groups ?? []).filter(inScope), [views.training_groups, inScope]);
  const collaboratorRanking = useMemo(() => (views.collaborator_ranking ?? [])
    .filter(inScope)
    .sort((a, b) => number(b, "inversion_actual_mxn") - number(a, "inversion_actual_mxn")), [views.collaborator_ranking, inScope]);
  const rankingFixedColumns = rankingColumns.slice(0, Math.max(0, rankingOptionalSlots - 1));
  const rankingSelectableColumns = rankingColumns.slice(Math.max(0, rankingOptionalSlots - 1));
  const effectiveRankingColumn = rankingSelectableColumns.some((column) => column.key === rankingColumn)
    ? rankingColumn
    : rankingSelectableColumns[0]?.key ?? "inversion";
  const rankingVisibleColumns = [
    ...rankingFixedColumns,
    ...rankingSelectableColumns.filter((column) => column.key === effectiveRankingColumn),
  ];
  const rankingGridStyle = {
    "--ranking-extra-columns": rankingVisibleColumns.length,
  } as CSSProperties;
  const quotationStatus = useMemo(() => groupStatus(quotationRows, "estatus_cotizacion", "necesidades"), [quotationRows]);
  const trainingStatus = useMemo(() => groupStatus(trainingRows, "estatus_grupo", "grupos"), [trainingRows]);
  const paymentStatus = useMemo(() => groupStatus(paymentRows, "estatus_pago", "movimientos"), [paymentRows]);

  const totals = useMemo(() => {
    if (cLevel === "all" && views.general?.length) {
      const general = views.general;
      const budget = sum(general, "presupuesto_autorizado_mxn");
      const investment = sum(general, "inversion_actual_mxn");
      const charged = sum(general, "cargado_al_centro_mxn");
      return {
        budget,
        investment,
        charged,
        remaining: budget - investment,
        budgetProgress: budget ? investment / budget : 0,
        accountingProgress: budget ? charged / budget : 0,
      };
    }
    const budget = sum(filteredDirections, "presupuesto_autorizado_mxn");
    const investment = sum(filteredDirections, "inversion_actual_mxn");
    const charged = sum(filteredDirections, "cargado_al_centro_mxn");
    return {
      budget,
      investment,
      charged,
      remaining: budget - investment,
      budgetProgress: budget ? investment / budget : 0,
      accountingProgress: budget ? charged / budget : 0,
    };
  }, [cLevel, filteredDirections, views.general]);

  const operational = useMemo(() => {
    const rows = cLevel === "all" && views.general?.length ? views.general : filteredDirections;
    return {
      needs: sum(rows, "necesidades_activas"),
      trainings: sum(rows, "capacitaciones"),
      groups: sum(rows, "grupos"),
      delivered: sum(rows, "capacitaciones_impartidas"),
      inProgress: sum(rows, "capacitaciones_en_curso"),
      projectedPeople: sum(rows, "pax_proyectados"),
      actualPeople: sum(rows, "pax_reales"),
      pendingPayment: sum(rows, "pago_pendiente_mxn"),
      executedPayment: sum(rows, "pago_ejecutado_mxn"),
    };
  }, [cLevel, filteredDirections, views.general]);

  const authorizedPlan = useMemo(() => ({
    dnc: sum(filteredDirections, "necesidades_plan"),
    extraPlan: sum(filteredDirections, "necesidades_extra_plan"),
    courses: optionalSum(filteredDirections, "cursos_plan"),
    events: optionalSum(filteredDirections, "eventos_plan"),
    executivePrograms: optionalSum(filteredDirections, "programas_ejecutivos_plan"),
    certifications: optionalSum(filteredDirections, "certificaciones_plan"),
    memberships: optionalSum(filteredDirections, "membresias_plan"),
    subscriptions: optionalSum(filteredDirections, "suscripciones_plan"),
    projectedPeople: optionalSum(filteredDirections, "pax_proyectados_tablero") ?? operational.projectedPeople,
  }), [filteredDirections, operational.projectedPeople]);

  const clusterDistribution = useMemo(() => {
    const buckets = [
      { label: "Hasta $10,000", min: 0, max: 10000, people: 0 },
      { label: "$10,001 – $25,000", min: 10000, max: 25000, people: 0 },
      { label: "$25,001 – $50,000", min: 25000, max: 50000, people: 0 },
      { label: "$50,001 – $75,000", min: 50000, max: 75000, people: 0 },
      { label: "Más de $75,000", min: 75000, max: Number.POSITIVE_INFINITY, people: 0 },
    ];
    trainingGroups.forEach((row) => {
      const price = number(row, "precio_persona_mxn");
      if (price <= 0) return;
      const people = number(row, "pax_reales");
      const bucket = buckets.find((item) => price > item.min && price <= item.max);
      if (bucket) bucket.people += people;
    });
    const total = buckets.reduce((value, item) => value + item.people, 0);
    return buckets.map((item) => ({ ...item, share: total ? item.people / total : 0 }));
  }, [trainingGroups]);

  const modalities = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    trainingGroups.forEach((row, index) => {
      const label = modalityLabel(text(row, "modalidad"));
      const id = `${text(row, "__source_category", "eic")}:${text(row, "identificador", text(row, "nombre_capacitacion", String(index)))}`;
      if (!groups.has(label)) groups.set(label, new Set());
      groups.get(label)!.add(id);
    });
    return [...groups].map(([label, ids]) => ({ label, value: ids.size })).sort((a, b) => b.value - a.value);
  }, [trainingGroups]);

  const budgetCategories = useMemo(() => {
    const groups = new Map<string, number>();
    initiatives.forEach((row) => {
      const label = text(row, "tipo", "Sin categoría");
      groups.set(label, (groups.get(label) ?? 0) + number(row, "inversion_actual_mxn"));
    });
    const total = [...groups.values()].reduce((value, item) => value + item, 0);
    return [...groups].map(([label, value]) => ({ label, value, share: total ? value / total : 0 })).sort((a, b) => b.value - a.value);
  }, [initiatives]);

  const scopeLabel = cLevel !== "all" ? cLevel : "Vista general";

  return <div className="eic-report">
    <div className="floating-toolbar-frame eic-toolbar-frame">
      <div className="sheet-toolbar eic-toolbar" aria-label="Filtros de la Dirección de Administración GC">
        <PopupFilter label="Área" className="region-filter" value={cLevel} options={[{ value: "all", label: "Todas las áreas" }, ...cLevels.map((item) => ({ value: item, label: item }))]} open={openFilter === "eic-area"} onOpenChange={(open) => setOpenFilter(open ? "eic-area" : null)} onChange={setCLevel} />
      </div>
    </div>

    <section className="report-lead eic-lead">
      <span>RESUMEN EJECUTIVO</span>
      <h3>{scopeLabel}</h3>
      <p>Lectura consolidada del presupuesto, la inversión y el avance contable de los planes de capacitación.</p>
      <small>Información consolidada al {primaryDashboard?.cutoffDate || primaryDashboard?.period}.</small>
    </section>

    {loading ? <section className="eic-loading">Preparando el resumen administrativo…</section> : error ? <section className="eic-loading error">{error}</section> : <>
      <section className="eic-kpis">
        <article><span>Presupuesto autorizado</span><strong>{money(totals.budget)}</strong><small>Base disponible para la selección</small></article>
        <article><span>Inversión actual</span><strong>{money(totals.investment)}</strong><small>{percentage(totals.budgetProgress)} del presupuesto</small></article>
        <article><span>Por ejercer</span><strong>{money(totals.remaining)}</strong><small>Saldo presupuestal estimado</small></article>
        <article><span>Cargado al centro</span><strong>{money(totals.charged)}</strong><small>{percentage(totals.accountingProgress)} de avance contable</small></article>
      </section>

      <section className="eic-financial-grid">
        <article className="eic-financial-card">
          <header><div><span>Uso del presupuesto</span><small>Inversión actual contra presupuesto autorizado</small></div><strong>{percentage(totals.budgetProgress)}</strong></header>
          <div className="eic-budget-track" aria-label={`Avance presupuestal ${percentage(totals.budgetProgress)}`}><i style={{ width: `${Math.min(totals.budgetProgress * 100, 100)}%` }} /></div>
          <div className="eic-budget-legend"><span><i className="used" />Ejercido <b>{money(totals.investment)}</b></span><span><i />Disponible <b>{money(Math.max(totals.remaining, 0))}</b></span></div>
        </article>
        <article className="eic-accounting-card">
          <span>Avance contable</span>
          <div className="eic-ring" style={{ "--ring-progress": `${Math.min(totals.accountingProgress * 360, 360)}deg` } as CSSProperties}><strong>{percentage(totals.accountingProgress)}</strong></div>
          <small>{money(totals.charged)} cargados al centro</small>
        </article>
      </section>

      <section className="eic-authorized-plan">
        <header><div><h4>Solicitados en Plan Autorizado</h4><p>Desglose de necesidades y modalidades de capacitación</p></div><div className="eic-carousel-controls" aria-label="Navegar por los indicadores"><button type="button" className="eic-carousel-arrow previous" onClick={() => moveAuthorizedPlan(-1)} disabled={!authorizedNav.back} aria-label="Ver indicador anterior" /><button type="button" className="eic-carousel-arrow next" onClick={() => moveAuthorizedPlan(1)} disabled={!authorizedNav.forward} aria-label="Ver siguiente indicador" /></div></header>
        <div ref={authorizedWindowRef} className="eic-authorized-window" role="region" aria-label="Indicadores del Plan Autorizado" onScroll={(event) => { const node = event.currentTarget; setAuthorizedNav({ back: node.scrollLeft > 2, forward: node.scrollLeft + node.clientWidth < node.scrollWidth - 2 }); }}>
          <div className="eic-authorized-grid">
            <AuthorizedMetric label="DNCs" value={authorizedPlan.dnc} />
            <AuthorizedMetric label="Extra Plan" value={authorizedPlan.extraPlan} />
            <AuthorizedMetric label="Cursos" value={authorizedPlan.courses} />
            <AuthorizedMetric label="Eventos" value={authorizedPlan.events} />
            <AuthorizedMetric label="Programas ejecutivos" value={authorizedPlan.executivePrograms} />
            <AuthorizedMetric label="Certificaciones" value={authorizedPlan.certifications} />
            <AuthorizedMetric label="Membresías" value={authorizedPlan.memberships} />
            <AuthorizedMetric label="Suscripciones" value={authorizedPlan.subscriptions} />
            <AuthorizedMetric label="Pax proyectados" value={authorizedPlan.projectedPeople} />
          </div>
        </div>
      </section>

      <section className="eic-section eic-distribution-section">
        <header className="eic-section-heading"><div><span>Distribución de capacitación</span><small>Participantes por inversión individual y cursos por modalidad</small></div></header>
        <div className="eic-distribution-grid">
          <article className="eic-clusters">
            <header><strong>Distribución por clusters</strong><small>Participantes reales por precio negociado por persona</small></header>
            <div>{clusterDistribution.map((item) => <div className="eic-cluster-row" key={item.label}>
              <span>{item.label}</span><i><b style={{ width: `${item.share * 100}%` }} /></i><strong>{percentage(item.share)}</strong><small>{item.people.toLocaleString("es-MX")} participantes</small>
            </div>)}</div>
          </article>
          <article className="eic-modalities">
            <header><strong>Cantidad de cursos por modalidad</strong><small>Cursos únicos dentro de la selección actual</small></header>
            <div>{modalities.length ? modalities.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value.toLocaleString("es-MX")}</strong></span>) : <p className="eic-empty">Sin modalidades registradas.</p>}</div>
          </article>
        </div>
      </section>

      <section className="eic-section">
        <header className="eic-section-heading"><div><span>Presupuesto por categoría</span><small>Participación de la inversión actual por tipo de capacitación</small></div></header>
        <div className="eic-category-table">
          <div className="eic-category-head"><span>Categoría</span><span>Porcentaje del total</span><span>Inversión actual</span></div>
          {budgetCategories.length ? budgetCategories.map((item) => <div className="eic-category-row" key={item.label}><strong>{item.label}</strong><span><em>{percentage(item.share)}</em><i><b style={{ width: `${item.share * 100}%` }} /></i></span><strong>{compactNumber(item.value)}</strong></div>) : <p className="eic-empty">Sin categorías registradas.</p>}
        </div>
      </section>

      <section className="eic-section">
        <header className="eic-section-heading"><div><span>Ranking de colaboradores con mayor inversión en cursos</span><small>Inversión individual acumulada por participante dentro de la selección</small></div><b>{collaboratorRanking.length.toLocaleString("es-MX")} colaboradores</b></header>
        {collaboratorRanking.length ? <div ref={rankingTableRef} className="eic-ranking-table">
          <div className="eic-ranking-head" style={rankingGridStyle}>
            <span>No.</span><span>No. colaborador</span><span>Colaborador</span>
            {rankingVisibleColumns.map((column) => column.key === effectiveRankingColumn && rankingSelectableColumns.length > 1
              ? <label className={`eic-ranking-column-picker${column.numeric ? " is-number" : ""}`} key="ranking-column-picker">
                <select value={effectiveRankingColumn} onChange={(event) => setRankingColumn(event.target.value as RankingColumnKey)} aria-label="Cambiar columna visible del ranking">
                  {rankingSelectableColumns.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </label>
              : <span className={column.numeric ? "is-number" : undefined} key={column.key}>{column.label}</span>)}
          </div>
          {collaboratorRanking.slice(0, 10).map((row, index) => <div className="eic-ranking-row" style={rankingGridStyle} key={`${text(row, "numero_colaborador")}-${text(row, "direccion_c_level")}`}>
            <span>{index + 1}.</span>
            <span>{text(row, "numero_colaborador")}</span>
            <strong title={text(row, "colaborador")}>{text(row, "colaborador")}</strong>
            {rankingVisibleColumns.map((column) => {
              if (column.key === "puesto") return <span title={text(row, "puesto")} key={column.key}>{text(row, "puesto")}</span>;
              if (column.key === "area") return <span title={text(row, "direccion_c_level")} key={column.key}>{text(row, "direccion_c_level")}</span>;
              if (column.key === "cursos") return <span className="is-number" key={column.key}>{number(row, "cursos").toLocaleString("es-MX")}</span>;
              return <strong className="is-number" key={column.key}>{money(number(row, "inversion_actual_mxn"))}</strong>;
            })}
          </div>)}
          {collaboratorRanking.length > 10 && <p className="eic-ranking-foot">Mostrando los 10 colaboradores con mayor inversión de {collaboratorRanking.length.toLocaleString("es-MX")}.</p>}
        </div> : <div className="eic-ranking-placeholder"><span>Sin participantes identificables</span><p>La selección actual no incluye el detalle de número, nombre y puesto necesario para construir el ranking.</p></div>}
      </section>

      <section className="eic-section">
        <header className="eic-section-heading"><div><span>Flujo operativo</span><small>Del requerimiento al cargo contable</small></div></header>
        <div className="eic-pipeline">
          <StatusColumn title="Cotizaciones" subtitle={`${quotationStatus.reduce((total, item) => total + item.value, 0)} necesidades`} items={quotationStatus} />
          <StatusColumn title="Capacitaciones" subtitle={`${trainingStatus.reduce((total, item) => total + item.value, 0)} grupos`} items={trainingStatus} />
          <StatusColumn title="Pagos" subtitle={money(operational.executedPayment)} items={paymentStatus} />
        </div>
        <div className="eic-payment-note"><span>Pago pendiente</span><strong>{money(operational.pendingPayment)}</strong><small>Monto todavía no ejecutado en la selección actual.</small></div>
      </section>

      <section className="eic-section">
        <header className="eic-section-heading"><div><span>Detalle por área</span><small>Lectura financiera y operativa de las direcciones y divisiones</small></div><b>{filteredDirections.filter((row) => text(row, "direccion_c_level") !== "Sin dirección").length} áreas</b></header>
        <div className="eic-direction-table">
          <div className="eic-direction-head"><span>Dirección</span><span>Capacitaciones</span><span>Presupuesto</span><span>Inversión</span><span>Avance</span></div>
          {filteredDirections.filter((row) => text(row, "direccion_c_level") !== "Sin dirección").map((row) => <button type="button" key={text(row, "direccion_c_level")} onClick={() => setCLevel(text(row, "direccion_c_level"))}>
            <span><strong>{text(row, "direccion_c_level")}</strong><small>Área de la Dirección de Administración</small></span>
            <span>{number(row, "capacitaciones").toLocaleString("es-MX")}</span>
            <span>{compactNumber(number(row, "presupuesto_autorizado_mxn"))}</span>
            <span>{compactNumber(number(row, "inversion_actual_mxn"))}</span>
            <strong>{percentage(number(row, "avance_presupuesto"))}</strong>
          </button>)}
        </div>
      </section>

      <section className="eic-section eic-initiatives-section">
        <header className="eic-section-heading eic-initiatives-heading"><div><span>Planes y capacitaciones</span><small>Seguimiento individual de las iniciativas relacionadas</small></div><b>{visibleInitiatives.length} de {initiatives.length}</b></header>
        <div className="eic-initiative-tools">
          <label className="eic-initiative-search"><i aria-hidden="true">⌕</i><input value={initiativeQuery} onChange={(event) => setInitiativeQuery(event.target.value)} placeholder="Buscar plan, capacitación, ID o proveedor" aria-label="Buscar planes y capacitaciones" /></label>
          <PopupFilter label="Estatus" className="course-filter eic-status-filter" value={effectiveInitiativeStatus} options={[{ value: "all", label: "Todos los estatus" }, ...initiativeStatuses.map((item) => ({ value: item, label: item }))]} open={openFilter === "eic-status"} onOpenChange={(open) => setOpenFilter(open ? "eic-status" : null)} onChange={setInitiativeStatus} />
        </div>
        <div className="eic-initiative-head" aria-hidden="true"><span>ID</span><span>Plan o capacitación</span><span>Estatus</span><span>Inversión</span></div>
        <div className="eic-initiative-list">
          {visibleInitiatives.map((row, index) => <article key={`${text(row, "identificador")}-${index}`}>
            <span className="eic-initiative-id">{text(row, "identificador", "S/ID")}</span>
            <div><strong>{text(row, "nombre_iniciativa", "Sin nombre")}</strong><small>{text(row, "direccion_nivel_2")} · {text(row, "proveedor_seleccionado", "Proveedor por definir")}</small></div>
            <span className={`eic-status ${statusTone(text(row, "estatus_grupo_principal", text(row, "estatus_cotizacion")))}`}>{text(row, "estatus_grupo_principal", text(row, "estatus_cotizacion"))}</span>
            <strong>{money(number(row, "inversion_actual_mxn"))}</strong>
          </article>)}
          {!visibleInitiatives.length && <p className="eic-empty">No hay iniciativas que coincidan con los filtros.</p>}
        </div>
      </section>
    </>}
  </div>;
}

function StatusColumn({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((sumValue, item) => sumValue + item.value, 0);
  return <article>
    <header><span>{title}</span><small>{subtitle}</small></header>
    <div className="eic-status-track">{items.map((item) => <i key={item.label} className={statusTone(item.label)} style={{ width: `${total ? (item.value / total) * 100 : 0}%` }} title={`${item.label}: ${item.value}`} />)}</div>
    <div className="eic-status-list">{items.slice(0, 5).map((item) => <span key={item.label}><i className={statusTone(item.label)} /><b>{item.label}</b><strong>{item.value.toLocaleString("es-MX")}</strong></span>)}</div>
  </article>;
}

function AuthorizedMetric({ label, value }: { label: string; value: number | null }) {
  return <article className={value === null ? "is-pending" : undefined}>
    <span>{label}</span>
    <strong>{displayValue(value)}</strong>
    {value === null && <small>Pendiente del nuevo SQL</small>}
  </article>;
}
