"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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

export default function EicStatusReport({
  dashboard,
}: {
  dashboard: CategoryDashboard;
}) {
  const [views, setViews] = useState<EicAdministrativeViews>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cLevel, setCLevel] = useState("all");
  const [initiativeQuery, setInitiativeQuery] = useState("");
  const [initiativeStatus, setInitiativeStatus] = useState("all");
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadAdministrativeViews(dashboard)
      .then((loaded) => { if (active) setViews(loaded); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las vistas administrativas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dashboard]);

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
  const quotationStatus = useMemo(() => groupStatus(quotationRows, "estatus_cotizacion", "necesidades"), [quotationRows]);
  const trainingStatus = useMemo(() => groupStatus(trainingRows, "estatus_grupo", "grupos"), [trainingRows]);
  const paymentStatus = useMemo(() => groupStatus(paymentRows, "estatus_pago", "movimientos"), [paymentRows]);

  const totals = useMemo(() => {
    if (cLevel === "all" && views.general?.[0]) {
      const general = views.general[0];
      return {
        budget: number(general, "presupuesto_autorizado_mxn"),
        investment: number(general, "inversion_actual_mxn"),
        charged: number(general, "cargado_al_centro_mxn"),
        remaining: number(general, "presupuesto_por_ejercer_mxn"),
        budgetProgress: number(general, "avance_presupuesto"),
        accountingProgress: number(general, "avance_contable"),
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
    const rows = cLevel === "all" && views.general?.[0] ? [views.general[0]] : filteredDirections;
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

  const cLevelComparison = useMemo(() => {
    const rows = cLevel === "all" ? (views.c_level ?? []) : (views.c_level ?? []).filter((row) => text(row, "direccion_c_level") === cLevel);
    return rows.map((row) => ({
      label: text(row, "direccion_c_level"),
      budget: number(row, "presupuesto_autorizado_mxn"),
      investment: number(row, "inversion_actual_mxn"),
      progress: number(row, "avance_presupuesto"),
      trainings: number(row, "capacitaciones"),
    })).sort((a, b) => b.budget - a.budget);
  }, [cLevel, views.c_level]);

  const scopeLabel = cLevel !== "all" ? cLevel : "Vista general";

  return <div className="eic-report">
    <div className="floating-toolbar-frame eic-toolbar-frame">
      <div className="sheet-toolbar eic-toolbar" aria-label="Filtros del estatus de planes de capacitación">
        <PopupFilter label="C-Level" className="region-filter" value={cLevel} options={[{ value: "all", label: "Todas las direcciones C-Level" }, ...cLevels.map((item) => ({ value: item, label: item }))]} open={openFilter === "eic-c-level"} onOpenChange={(open) => setOpenFilter(open ? "eic-c-level" : null)} onChange={setCLevel} />
      </div>
    </div>

    <section className="report-lead eic-lead">
      <span>RESUMEN EJECUTIVO</span>
      <h3>{scopeLabel}</h3>
      <p>Lectura consolidada del presupuesto, la inversión y el avance contable de los planes de capacitación.</p>
      <small>Información consolidada al {dashboard.cutoffDate || dashboard.period}.</small>
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

      <section className="eic-section">
        <header className="eic-section-heading"><div><span>Panorama por C-Level</span><small>Presupuesto, inversión y número de capacitaciones</small></div><b>{cLevelComparison.length} {cLevelComparison.length === 1 ? "dirección" : "direcciones"}</b></header>
        <div className="eic-c-level-list">
          {cLevelComparison.length ? cLevelComparison.map((item) => <button type="button" key={item.label} onClick={() => setCLevel(item.label)}>
            <span><strong>{item.label}</strong><small>{item.trainings.toLocaleString("es-MX")} capacitaciones</small></span>
            <i><b style={{ width: `${Math.min(item.progress * 100, 100)}%` }} /></i>
            <span className="eic-c-level-money"><strong>{money(item.investment)}</strong><small>de {money(item.budget)}</small></span>
            <em>{percentage(item.progress)}</em>
          </button>) : <p className="eic-empty">No hay información C-Level para esta selección.</p>}
        </div>
      </section>

      <section className="eic-operation-summary">
        <article><span>Necesidades activas</span><strong>{operational.needs.toLocaleString("es-MX")}</strong><small>Con seguimiento vigente</small></article>
        <article><span>Capacitaciones</span><strong>{operational.trainings.toLocaleString("es-MX")}</strong><small>{operational.groups.toLocaleString("es-MX")} grupos registrados</small></article>
        <article><span>Impartidas</span><strong>{operational.delivered.toLocaleString("es-MX")}</strong><small>{operational.inProgress.toLocaleString("es-MX")} actualmente en curso</small></article>
        <article><span>Participantes</span><strong>{operational.actualPeople.toLocaleString("es-MX")}</strong><small>de {operational.projectedPeople.toLocaleString("es-MX")} proyectados</small></article>
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
        <header className="eic-section-heading"><div><span>Detalle por dirección C-Level</span><small>Lectura financiera y operativa de las siete direcciones</small></div><b>{filteredDirections.filter((row) => text(row, "direccion_c_level") !== "Sin dirección").length}</b></header>
        <div className="eic-direction-table">
          <div className="eic-direction-head"><span>Dirección</span><span>Capacitaciones</span><span>Presupuesto</span><span>Inversión</span><span>Avance</span></div>
          {filteredDirections.filter((row) => text(row, "direccion_c_level") !== "Sin dirección").map((row) => <button type="button" key={text(row, "direccion_c_level")} onClick={() => setCLevel(text(row, "direccion_c_level"))}>
            <span><strong>{text(row, "direccion_c_level")}</strong><small>Dirección C-Level</small></span>
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
