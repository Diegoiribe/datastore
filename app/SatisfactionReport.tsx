"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CategoryDashboard,
  SatisfactionComment,
  SatisfactionMetricRow,
  loadDashboardDetails,
} from "../lib/dashboard-data";
import PopupFilter from "./ToolbarPopupFilter";

type Totals = {
  respuestas: number; scoreSum: number; scoreCount: number; npsValid: number;
  promoters: number; passives: number; detractors: number;
};

const rubricFields = [
  ["Dominio del tema", "dominio_suma", "dominio_n"],
  ["Comunicación", "comunicacion_suma", "comunicacion_n"],
  ["Interés y compromiso", "interes_suma", "interes_n"],
  ["Ambiente y participación", "participacion_suma", "participacion_n"],
  ["Resolución de dudas", "resolucion_suma", "resolucion_n"],
] as const;
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function aggregate(rows: SatisfactionMetricRow[]): Totals {
  return rows.reduce<Totals>((total, row) => {
    total.respuestas += Number(row.respuestas || 0);
    rubricFields.forEach(([, sumField, countField]) => {
      total.scoreSum += Number(row[sumField] || 0);
      total.scoreCount += Number(row[countField] || 0);
    });
    total.npsValid += Number(row.nps_validas || 0);
    total.promoters += Number(row.promotores || 0);
    total.passives += Number(row.pasivos || 0);
    total.detractors += Number(row.detractores || 0);
    return total;
  }, { respuestas: 0, scoreSum: 0, scoreCount: 0, npsValid: 0, promoters: 0, passives: 0, detractors: 0 });
}
function isa(total: Totals) { return total.scoreCount ? (total.scoreSum / (total.scoreCount * 5)) * 100 : 0; }
function nps(total: Totals) { return total.npsValid ? ((total.promoters - total.detractors) / total.npsValid) * 100 : 0; }
function metricTone(value: number) { return value >= 90 ? "good" : value >= 80 ? "warning" : "critical"; }
function textKey(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim(); }
function instructorName(value: string) { return String(value || "").trim() || "Sin instructor"; }
function instructorKey(value: string) { return textKey(instructorName(value)); }
function unique(rows: SatisfactionMetricRow[], field: "mes" | "programa" | "curso" | "instructor" | "region") {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function MoreButton({ open, count, onClick }: { open: boolean; count: number; onClick(): void }) {
  return <button className="show-more-button" onClick={onClick}><span>{open ? "Mostrar menos" : `Ver ${count} más`}</span><span className="more-icon-shell more-glyph" aria-hidden="true">{open ? "−" : "+"}</span></button>;
}

function SmoothList({ open, visible, className, children }: { open: boolean; visible: number; className: string; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const update = () => { const items = Array.from(content.children) as HTMLElement[]; const lastVisible = items[Math.min(visible, items.length) - 1]; const styles = getComputedStyle(content); const margins = (parseFloat(styles.marginTop) || 0) + (parseFloat(styles.marginBottom) || 0); setHeight((open ? content.scrollHeight : lastVisible ? lastVisible.getBoundingClientRect().bottom - content.getBoundingClientRect().top : 0) + margins + 2); };
    update();
    const observer = new ResizeObserver(update); observer.observe(content);
    return () => observer.disconnect();
  }, [open, visible]);
  return <div className="smooth-list-shell" style={height === undefined ? undefined : { height: `${height}px` }}><div className={className} ref={contentRef}>{children}</div></div>;
}

function normalizeComment(item: SatisfactionComment): SatisfactionComment {
  const raw = item as SatisfactionComment & { record_type?: "comment" | "theme"; sentiment?: "positive" | "negative" | "neutral"; theme?: string; count?: number; mes?: string; example?: string };
  const text = String(raw.comentario ?? raw.example ?? "");
  const normalized = textKey(text);
  const positiveScore = ["excelente", "bueno", "buen ", "muy bien", "claro", "dinamic", "practic", "gracias", "recomiendo", "util", "ameno", "amena", "participativo", "participativa", "gran talento", "ideal", "conocedor", "dominio", "atento", "atenta", "entusiasmad", "me agrado", "agradec", "carisma", "inspira", "confianza"].filter((word) => normalized.includes(word)).length;
  const negativeScore = [/\bfalta(?:n|ba)?\b/, /\bhace falta\b/, /\bdeb(?:e|en|eria|erian) (?:mejorar|tener|agregar|incluir|cambiar)\b/, /\bse deb(?:e|eria) (?:mejorar|agregar|incluir|cambiar)\b/, /\bnecesita(?:n|mos)?\b/, /\bno (?:fue|es|esta|estuvo|me parecio )?(?:bueno|claro|util|dinamic[oa]|practic[oa]|ameno|amena)\b/, /\bno (?:explica|comunica|funciona|ayuda|resuelve|cumple)\b/, /\bnunca (?:explica|comunica|resuelve|contesta|ayuda)\b/, /\bmal estado\b/, /\bproblema(?:s)?\b/, /\bdeficiente\b/, /\bconfus[oa]\b/, /\bdificil de (?:entender|seguir|comprender)\b/, /\b(?:demasiado|excesivamente) (?:rapido|lento)\b/, /\b(?:explica|habla|avanza|va|ritmo) muy (?:rapido|lento)\b/, /\bpoco tiempo\b/, /\bmas practica\b/, /\bpuede(?:n)? mejorar\b/, /\bpodria(?:n)? mejorar\b/, /\bmas equipos?\b/, /\bmejorar (?:el|la|los|las) (?:equipo|equipos|material|materiales|instalacion|instalaciones|contenido|curso|audio|computadora|computadoras)\b/].filter((pattern) => pattern.test(normalized)).length;
  const inferredSentiment = negativeScore > 0 ? "negative" : positiveScore > 0 ? "positive" : "neutral";
  const positive = inferredSentiment === "positive";
  const negative = inferredSentiment === "negative";
  const theme = raw.theme || (normalized.match(/equipo|material|herramient|computadora/) ? "Equipo y materiales" : normalized.match(/clar|explica|comprend|comunic/) ? "Explicación clara" : normalized.match(/dominio|conocimiento|preparad/) ? "Dominio del tema" : normalized.match(/dinamic|particip|actividad|practic/) ? "Dinámica y participación" : normalized.match(/duda|atencion|apoyo|amable/) ? "Atención y dudas" : normalized.match(/tiempo|duracion|ritmo/) ? "Duración y ritmo" : positive ? "Valoración positiva" : negative ? "Mejora general" : "Comentario general");
  const sentiment = raw.record_type === "theme" ? raw.sentiment ?? inferredSentiment : inferredSentiment;
  return { ...item, record_type: raw.record_type ?? "comment", mes: raw.mes ?? String(raw.fecha ?? "").slice(0, 7), sentiment, theme, count: Number(raw.count ?? 1), example: raw.example ?? text };
}

function TrendChart({ items, months, onMonthsChange }: { items: Array<{ label: string; responses: number; isa: number }>; months: number; onMonthsChange(value: number): void }) {
  if (!items.length) return <p className="comments-empty">No hay periodos para esta selección.</p>;
  const maxResponses = Math.max(...items.map((item) => item.responses), 1);
  return <div className="trend-chart horizontal">
    <div className="chart-tools">
      <label className="temporality-filter"><select aria-label="Temporalidad en meses" value={months} onChange={(event) => onMonthsChange(Number(event.target.value))}><option value={4}>4</option><option value={6}>6</option><option value={12}>12</option></select><span>meses</span></label>
      <div className="chart-legend"><span><i className="line-key" /> ISA</span><span><i className="volume-key" /> Encuestas</span></div>
    </div>
    <div className="horizontal-chart" role="img" aria-label="Evolución mensual horizontal de ISA y encuestas">
    {items.map((item) => { const [itemYear, itemMonth] = item.label.split("-"); const volumeWidth = Math.max(2, (item.responses / maxResponses) * 100); return <div className="horizontal-chart-row" key={item.label}><span className="horizontal-period"><strong>{monthNames[Number(itemMonth) - 1].slice(0, 3)}</strong><small>{itemYear}</small></span><div className="horizontal-metrics"><div><span>ISA</span><i className="metric-track"><b className="isa-fill" style={{ width: `${item.isa}%` }} /></i></div><div><span>Encuestas</span><i className="metric-track"><b className="volume-fill" style={{ width: `${volumeWidth}%` }} /></i></div></div><span className="horizontal-values"><strong>{item.isa.toFixed(1)}%</strong><small>{item.responses.toLocaleString("es-MX")} encuestas</small></span></div>; })}
  </div><p className="chart-reading"><strong>Cómo leerla:</strong> cada dato usa su propia fila: ISA se mide sobre 100 y Encuestas se compara contra el mes con mayor volumen.</p></div>;
}

export default function SatisfactionReport({ dashboard }: { dashboard: CategoryDashboard }) {
  const rows = dashboard.metrics as SatisfactionMetricRow[];
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [program, setProgram] = useState("");
  const [region, setRegion] = useState("all");
  const [instructorMode, setInstructorMode] = useState(false);
  const [selectedInstructorKeys, setSelectedInstructorKeys] = useState<string[]>([]);
  const [instructorSearch, setInstructorSearch] = useState("");
  const [instructorSearchOpen, setInstructorSearchOpen] = useState(false);
  const [commentTone, setCommentTone] = useState<"all" | "positive" | "negative">("all");
  const [comments, setComments] = useState<SatisfactionComment[]>([]);
  const [commentsError, setCommentsError] = useState("");
  const [showAllRubrics, setShowAllRubrics] = useState(false);
  const [showAllInstructors, setShowAllInstructors] = useState(false);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [insightView, setInsightView] = useState<"trend" | "rubrics">("trend");
  const [trendMonths, setTrendMonths] = useState(4);
  const [expandedInstructorKey, setExpandedInstructorKey] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedInstructorCourse, setExpandedInstructorCourse] = useState<string | null>(null);
  const [openFilterMenu, setOpenFilterMenu] = useState<string | null>(null);
  const insightContentRef = useRef<HTMLDivElement>(null);
  const [insightHeight, setInsightHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = insightContentRef.current;
    if (!content) return;
    const updateHeight = () => setInsightHeight(content.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [insightView, showAllRubrics, trendMonths]);

  useEffect(() => {
    let active = true;
    loadDashboardDetails(dashboard)
      .then((items) => { if (active) setComments(items.map(normalizeComment)); })
      .catch((error: Error) => { if (active) setCommentsError(error.message); });
    return () => { active = false; };
  }, [dashboard]);

  const instructorLabels = useMemo(() => {
    const groups = new Map<string, Map<string, number>>();
    rows.forEach((row) => { const label = instructorName(row.instructor); const key = instructorKey(label); const labels = groups.get(key) ?? new Map<string, number>(); labels.set(label, (labels.get(label) ?? 0) + Number(row.respuestas || 0)); groups.set(key, labels); });
    return new Map([...groups].map(([key, labels]) => [key, [...labels].sort((a, b) => b[1] - a[1])[0][0]]));
  }, [rows]);
  const years = [...new Set(rows.map((row) => row.mes.slice(0, 4)))].sort();
  const monthOptions = [...new Set(rows.filter((row) => year === "all" || row.mes.startsWith(year)).map((row) => row.mes.slice(5, 7)))].sort().map((value) => ({ value, label: monthNames[Number(value) - 1] }));
  const matchesPeriod = (row: SatisfactionMetricRow) => (year === "all" || row.mes.startsWith(year)) && (month === "all" || row.mes.slice(5, 7) === month);
  const matchesDimensions = (row: SatisfactionMetricRow) => (program === "all" || row.programa === program) && (region === "all" || row.region === region);
  const prefiltered = rows.filter((row) => matchesPeriod(row) && matchesDimensions(row));
  const filtered = prefiltered.filter((row) => !selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(row.instructor)));
  const totals = aggregate(filtered);
  const isaValue = isa(totals);
  const npsValue = nps(totals);
  const instructorCount = new Set(filtered.map((row) => instructorKey(row.instructor))).size;
  const evaluatedCourseCount = new Set(filtered.map((row) => row.curso).filter(Boolean)).size;
  const periodReady = year !== "all" && month !== "all";
  const selectionReady = periodReady && (instructorMode ? selectedInstructorKeys.length > 0 : program !== "");
  const selectedCourses = unique(filtered, "curso");
  const courseTitle = selectedCourses.length === 0 ? "Curso" : selectedCourses.length <= 3 ? selectedCourses.join(" · ") : `${selectedCourses[0]} y ${selectedCourses.length - 1} cursos más`;
  const rubricRows = rubricFields.map(([label, sumField, countField]) => { const sum = filtered.reduce((value, row) => value + Number(row[sumField] || 0), 0); const count = filtered.reduce((value, row) => value + Number(row[countField] || 0), 0); return { label, count, value: count ? (sum / (count * 5)) * 100 : 0 }; }).filter((item) => item.count).sort((a, b) => b.value - a.value);
  const selectedPeriod = year !== "all" && month !== "all" ? `${year}-${month}` : null;
  const trendBase = rows.filter((row) => matchesDimensions(row) && (year === "all" || row.mes.startsWith(year)) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(row.instructor))) && (!selectedPeriod || row.mes <= selectedPeriod));
  const trend = unique(trendBase, "mes").map((label) => { const value = aggregate(trendBase.filter((row) => row.mes === label)); return { label, responses: value.respuestas, isa: isa(value) }; }).slice(-12);
  const instructorRanking = [...new Set(prefiltered.map((row) => instructorKey(row.instructor)))].map((key) => { const instructorRows = prefiltered.filter((row) => instructorKey(row.instructor) === key); const value = aggregate(instructorRows); const programs = unique(instructorRows, "programa"); return { key, label: instructorLabels.get(key) ?? key, responses: value.respuestas, isa: isa(value), nps: nps(value), programLabel: programs.length === 1 ? programs[0] : `${programs.length} programas` }; }).filter((item) => item.responses >= 1).sort((a, b) => b.isa - a.isa || a.label.localeCompare(b.label, "es"));
  const programBase = rows.filter((row) => matchesPeriod(row) && (region === "all" || row.region === region) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(row.instructor))));
  const programRows = unique(rows, "programa").map((label) => { const value = aggregate(programBase.filter((row) => row.programa === label)); return { label, responses: value.respuestas, isa: isa(value), nps: nps(value) }; }).sort((a, b) => Number(b.responses > 0) - Number(a.responses > 0) || b.responses - a.responses || a.label.localeCompare(b.label, "es"));
  const initiallyVisiblePrograms = Math.min(5, programRows.filter((item) => item.responses > 0).length);
  const instructorOptions = [...new Set(prefiltered.map((row) => instructorKey(row.instructor)))].map((value) => ({ value, label: instructorLabels.get(value) ?? value, responses: aggregate(prefiltered.filter((row) => instructorKey(row.instructor) === value)).respuestas })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  const instructorQuery = textKey(instructorSearch);
  const instructorQueryParts = instructorQuery.split(" ").filter(Boolean);
  const instructorMatches = instructorQuery ? instructorOptions.filter((item) => !selectedInstructorKeys.includes(item.value) && instructorQueryParts.every((part) => textKey(item.label).includes(part))).slice(0, 8) : [];

  const detailMatches = (item: SatisfactionComment) => (year === "all" || item.mes.startsWith(year)) && (month === "all" || item.mes.slice(5, 7) === month) && (program === "all" || item.programa === program) && (region === "all" || item.region === region) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(item.instructor)));
  const programDetailMatches = (item: SatisfactionComment, label: string) => (year === "all" || item.mes.startsWith(year)) && (month === "all" || item.mes.slice(5, 7) === month) && item.programa === label && (region === "all" || item.region === region) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(item.instructor)));
  const trendDetailMatches = (item: SatisfactionComment) => (program === "all" || item.programa === program) && (region === "all" || item.region === region) && (year === "all" || item.mes.startsWith(year)) && (!selectedPeriod || item.mes <= selectedPeriod) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(item.instructor)));
  const matchingDetails = comments.filter(detailMatches);
  const recentComments = matchingDetails.filter((item) => item.record_type === "comment" && (commentTone === "all" || item.sentiment === commentTone) && item.comentario && !/^(ningun[oa]|no|n\/?a|sin comentarios?)[.! ]*$/i.test(item.comentario.trim()));
  const matchingThemes = matchingDetails.filter((item) => item.record_type === "theme" && (commentTone === "all" || item.sentiment === commentTone));
  const voiceTotal = matchingThemes.reduce((total, item) => total + Number(item.count || 1), 0) || recentComments.length;
  const representativeComments = matchingThemes.filter((item) => item.example).map((item) => ({ ...item, comentario: item.example }));
  const visibleVoiceComments = recentComments.length ? recentComments : representativeComments;
  const instructorCourseBase = filtered;
  const instructorCourseDetails = matchingDetails;
  const instructorCourses = unique(instructorCourseBase, "curso").map((label) => {
    const courseRows = instructorCourseBase.filter((row) => row.curso === label);
    const value = aggregate(courseRows);
    const programs = unique(courseRows, "programa");
    const contributorKeys = [...new Set(courseRows.map((row) => instructorKey(row.instructor)))];
    const exactDetails = instructorCourseDetails.filter((item) => textKey(item.curso) === textKey(label));
    const scopedDetails = exactDetails.length ? exactDetails : instructorCourseDetails.filter((item) => programs.includes(item.programa));
    const recentCommentCount = scopedDetails.filter((item) => item.record_type === "comment" && item.comentario).length;
    const themeCommentCount = scopedDetails.filter((item) => item.record_type === "theme" && item.example).reduce((total, item) => total + Number(item.count || 1), 0);
    const commentCount = themeCommentCount || recentCommentCount;
    return { label, programs, programLabel: programs.join(" · "), responses: value.respuestas, commentCount, isa: isa(value), nps: nps(value), contributorCount: contributorKeys.length, isTeam: contributorKeys.length > 1 };
  }).filter((item) => item.responses > 0).sort((a, b) => b.responses - a.responses || a.label.localeCompare(b.label, "es"));
  const selectedInstructorNames = selectedInstructorKeys.map((key) => instructorLabels.get(key) ?? key);
  const focusActive = instructorMode && selectedInstructorKeys.length > 0;
  const instructorAnalysisTitle = selectedInstructorNames.length === 0 ? "Todos los instructores" : selectedInstructorNames.length === 1 ? selectedInstructorNames[0] : `Equipo de ${selectedInstructorNames.length} instructores`;

  const toggleInstructor = (key: string) => setSelectedInstructorKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const addInstructor = (key: string) => { setSelectedInstructorKeys((current) => current.includes(key) ? current : [...current, key]); setInstructorSearch(""); setInstructorSearchOpen(false); };
  const closeInstructorMode = () => { setInstructorMode(false); setProgram(""); setSelectedInstructorKeys([]); setInstructorSearch(""); setInstructorSearchOpen(false); setCommentTone("all"); };
  const programHistoryRows = (label: string) => rows.filter((row) => row.programa === label && (year === "all" || row.mes.startsWith(year)) && (region === "all" || row.region === region) && (!selectedPeriod || row.mes <= selectedPeriod) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(row.instructor))));
  const programHistoryDetails = (label: string) => comments.filter((item) => item.programa === label && (year === "all" || item.mes.startsWith(year)) && (region === "all" || item.region === region) && (!selectedPeriod || item.mes <= selectedPeriod) && (!selectedInstructorKeys.length || selectedInstructorKeys.includes(instructorKey(item.instructor))));

  const inlineInsight = (title: string, insightRows: SatisfactionMetricRow[], insightDetails: SatisfactionComment[], historyRows = insightRows, historyDetails = insightDetails, detailType: "instructor" | "program" | "program-default" | "instructor-summary" = "instructor") => {
    const value = aggregate(insightRows);
    const programRubricCards = [rubricFields[0], rubricFields[1], rubricFields[3], rubricFields[4]].map(([label, sumField, countField]) => { const sum = insightRows.reduce((total, row) => total + Number(row[sumField] || 0), 0); const count = insightRows.reduce((total, row) => total + Number(row[countField] || 0), 0); return { label: label === "Ambiente y participación" ? "Participación e interacción" : label, score: count ? sum / count : null, count }; });
    const detailSource = insightDetails.some((item) => item.record_type === "theme") ? insightDetails.filter((item) => item.record_type === "theme") : insightDetails.filter((item) => item.record_type === "comment");
    const historyDetailSource = historyDetails.some((item) => item.record_type === "theme") ? historyDetails.filter((item) => item.record_type === "theme") : historyDetails.filter((item) => item.record_type === "comment");
    const periods = [...new Set(historyDetailSource.map((item) => item.mes).filter(Boolean))].sort();
    const latestPeriod = periods.at(-1); const previousPeriod = periods.at(-2);
    const commentTopics = [...detailSource.reduce((groups, item) => { const current = groups.get(item.theme) ?? { label: item.theme, count: 0, example: item.example }; current.count += Number(item.count || 1); if (!current.example && item.example) current.example = item.example; groups.set(item.theme, current); return groups; }, new Map<string, { label: string; count: number; example: string }>()).values()].sort((a, b) => b.count - a.count).slice(0, 5).map((item) => { const countAt = (period?: string, theme?: string) => historyDetailSource.filter((row) => row.mes === period && (!theme || row.theme === theme)).reduce((total, row) => total + Number(row.count || 1), 0); const currentTotal = countAt(latestPeriod); const previousTotal = countAt(previousPeriod); const currentShare = currentTotal ? (countAt(latestPeriod, item.label) / currentTotal) * 100 : 0; const previousShare = previousTotal ? (countAt(previousPeriod, item.label) / previousTotal) * 100 : 0; return { ...item, trend: previousPeriod && currentTotal && previousTotal ? Number((currentShare - previousShare).toFixed(1)) : null, unit: " pp" }; });
    const rowPeriods = unique(historyRows, "mes"); const latestRowPeriod = rowPeriods.at(-1); const previousRowPeriod = rowPeriods.at(-2);
    const rubricTopics = rubricFields.map(([label, sumField, countField]) => { const selected = insightRows.reduce((total, row) => total + Number(row[countField] || 0), 0); const periodScore = (period?: string) => { const periodRows = historyRows.filter((row) => row.mes === period); const sum = periodRows.reduce((total, row) => total + Number(row[sumField] || 0), 0); const count = periodRows.reduce((total, row) => total + Number(row[countField] || 0), 0); return count ? (sum / (count * 5)) * 100 : null; }; const current = periodScore(latestRowPeriod); const previous = periodScore(previousRowPeriod); return { label, count: selected, trend: current !== null && previous !== null ? Number((current - previous).toFixed(1)) : null, unit: " pp", example: "" }; }).filter((item) => item.count).sort((a, b) => b.count - a.count);
    const hasCommentTopics = commentTopics.length > 0; const topics = hasCommentTopics ? commentTopics : rubricTopics;
    const mentionTotal = detailSource.reduce((total, item) => total + Number(item.count || 1), 0);
    return <section className="inline-insight">
      <header><div><small>{detailType === "instructor-summary" ? "RESUMEN" : "DETALLE DE LA SELECCIÓN"}</small><h5>{title}</h5></div><span>{value.respuestas.toLocaleString("es-MX")} encuestas</span></header>
      <div className={`inline-metrics${detailType === "program" || detailType === "instructor-summary" ? " rubric-metrics" : ""}`}>
        {detailType === "program" || detailType === "instructor-summary" ? programRubricCards.map((item) => <article key={item.label}>
          <span>{item.label}</span><strong>{item.score === null ? "—" : item.score.toFixed(2)}</strong>
          {item.score !== null && <span className="star-rating" title={`${item.score.toFixed(2)} de 5`} aria-label={`${item.score.toFixed(2)} de 5 estrellas`}><span className="stars-base" aria-hidden="true">★★★★★</span><span className="stars-fill" aria-hidden="true" style={{ width: `${(item.score / 5) * 100}%` }}>★★★★★</span></span>}
          <small>{item.score === null ? "Sin respuestas" : `${item.count.toLocaleString("es-MX")} respuestas`}</small>
        </article>) : <>
          <article><span>ISA</span><strong>{isa(value).toFixed(1)}%</strong><small>Promedio de los rubros</small></article>
          <article><span>NPS</span><strong>{nps(value).toFixed(1)}</strong><small>{value.npsValid.toLocaleString("es-MX")} respuestas válidas</small></article>
          <article><span>Encuestas</span><strong>{value.respuestas.toLocaleString("es-MX")}</strong><small>En el periodo seleccionado</small></article>
        </>}
      </div>
      <section className="topic-summary"><div className="topic-heading"><div><span>{hasCommentTopics ? "Temas mencionados" : "Rubros evaluados"}</span><small>{hasCommentTopics ? "Frecuencia y cambio contra el periodo anterior" : "Evaluaciones y variación de puntaje contra el periodo anterior"}</small></div><b>{hasCommentTopics ? `${mentionTotal.toLocaleString("es-MX")} menciones` : `${value.respuestas.toLocaleString("es-MX")} encuestas`}</b></div><div className="topic-table"><div className="topic-table-head"><span>{hasCommentTopics ? "Tema" : "Rubro"}</span><span>{hasCommentTopics ? "Menciones" : "Evaluaciones"}</span><span>Tendencia</span></div>{topics.map((item) => <div className="topic-row" key={item.label}><strong>{item.label}</strong><span>{item.count.toLocaleString("es-MX")}</span><span className={item.trend === null ? "up" : item.trend === 0 ? "steady" : item.trend > 0 ? "up" : "down"}>{item.trend === null ? "↑ Nuevo" : item.trend === 0 ? "— Estable" : `${item.trend > 0 ? "↑" : "↓"} ${Math.abs(item.trend)}${item.unit}`}</span></div>)}</div>{hasCommentTopics && commentTopics[0]?.example && <p className="topic-example"><strong>Comentario representativo:</strong> “{commentTopics[0].example}”</p>}</section>
    </section>;
  };

  const instructorCourseVoice = (courseLabel: string, coursePrograms: string[]) => {
    const exactCourseDetails = instructorCourseDetails.filter((item) => textKey(item.curso) === textKey(courseLabel));
    const programDetails = instructorCourseDetails.filter((item) => coursePrograms.includes(item.programa));
    const scopedDetails = exactCourseDetails.length ? exactCourseDetails : programDetails;
    const recentCourseComments = scopedDetails.filter((item) => item.record_type === "comment" && item.comentario && !/^(ningun[oa]|no|n\/?a|sin comentarios?)[.! ]*$/i.test(item.comentario.trim()));
    const representativeThemes = scopedDetails.filter((item) => item.record_type === "theme" && item.example).map((item) => ({ ...item, comentario: item.example }));
    const usesRepresentativeComments = recentCourseComments.length === 0 && representativeThemes.length > 0;
    const allCourseComments = usesRepresentativeComments ? representativeThemes : recentCourseComments;
    const themeCount = scopedDetails.filter((item) => item.record_type === "theme").reduce((total, item) => total + Number(item.count || 1), 0);
    const voiceCount = themeCount || recentCourseComments.length;
    const commentScope = usesRepresentativeComments ? "Comentarios representativos de los temas del curso" : exactCourseDetails.length ? "Comentarios recibidos en este curso" : programDetails.length ? "Comentarios asociados al programa de este curso" : "Comentarios recibidos en este curso";
    const courseComments = allCourseComments.filter((item) => commentTone === "all" || item.sentiment === commentTone);
    return <section className="course-voice"><div className="course-voice-heading"><div><span>Voz del participante</span><small>{commentScope}</small></div><b>{voiceCount.toLocaleString("es-MX")}</b></div><div className="tone-tabs" role="group" aria-label={`Filtrar comentarios de ${courseLabel}`}><button className={commentTone === "all" ? "active" : ""} onClick={() => setCommentTone("all")}>Todos</button><button className={commentTone === "positive" ? "active" : ""} onClick={() => setCommentTone("positive")}>Positivos</button><button className={commentTone === "negative" ? "active" : ""} onClick={() => setCommentTone("negative")}>Negativos</button></div>{commentsError ? <p className="comments-empty">{commentsError}</p> : courseComments.length ? <><SmoothList open={showAllComments} visible={4} className="comment-list course-comment-list">{courseComments.slice(0, 16).map((item, index) => <blockquote key={`${item.fecha ?? item.theme}-${index}`}><span className={`comment-tone ${item.sentiment}`}>{item.sentiment === "negative" ? "Oportunidad" : item.sentiment === "positive" ? "Positivo" : "Comentario"}</span><p>{item.comentario}</p><footer>Comentario anónimo{item.fecha && <span>{item.fecha}</span>}</footer></blockquote>)}</SmoothList>{courseComments.length > 4 && <MoreButton open={showAllComments} count={Math.min(12, courseComments.length - 4)} onClick={() => setShowAllComments((current) => !current)} />}</> : <p className="comments-empty">No hay comentarios escritos para este curso o programa.</p>}</section>;
  };

  return <>
    <div className="floating-toolbar-frame"><div className={instructorMode ? "survey-toolbar people custom-filters" : "survey-toolbar custom-filters"} aria-label="Filtros de satisfacción">
      {instructorMode ? <>
        <div className="instructor-period-filters"><PopupFilter label="Año" value={year === "all" ? undefined : year} options={years.map((value) => ({ value, label: value }))} open={openFilterMenu === "instructor-year"} onOpenChange={(open) => setOpenFilterMenu((current) => open ? "instructor-year" : current === "instructor-year" ? null : current)} onChange={(value) => { setYear(value); setMonth("all"); setExpandedInstructorCourse(null); }} /><PopupFilter label="Mes" className="month-filter" value={month === "all" ? undefined : month} options={monthOptions} open={openFilterMenu === "instructor-month"} onOpenChange={(open) => setOpenFilterMenu((current) => open ? "instructor-month" : current === "instructor-month" ? null : current)} onChange={(value) => { setMonth(value); setExpandedInstructorCourse(null); }} /></div>
        <div className="instructor-picker">
          <label className="toolbar-search survey-search"><span>Buscar</span><i>⌕</i><input value={instructorSearch} onFocus={() => setInstructorSearchOpen(true)} onBlur={() => setInstructorSearchOpen(false)} onChange={(event) => { setInstructorSearch(event.target.value); setInstructorSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && instructorMatches[0]) { event.preventDefault(); addInstructor(instructorMatches[0].value); } if (event.key === "Escape") setInstructorSearchOpen(false); }} placeholder={selectedInstructorKeys.length ? "Agregar otro instructor" : "Buscar instructor"} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(instructorQuery && instructorSearchOpen)} aria-controls="instructor-suggestions" /></label>
          {instructorQuery && instructorSearchOpen && <div className="instructor-suggestions" id="instructor-suggestions" role="listbox">{instructorMatches.length ? instructorMatches.map((item) => <button key={item.value} onMouseDown={(event) => { event.preventDefault(); addInstructor(item.value); }} role="option" aria-selected={selectedInstructorKeys.includes(item.value)}><span>{item.label}</span><small>{item.responses.toLocaleString("es-MX")} encuestas</small><b aria-hidden="true">+</b></button>) : <p>No encontramos instructores con esa búsqueda.</p>}</div>}
          {selectedInstructorKeys.length > 0 && <div className="instructor-selection"><span className="selection-mode">{selectedInstructorKeys.length === 1 ? "Individual" : `Equipo · ${selectedInstructorKeys.length}`}</span>{selectedInstructorKeys.slice(0, 1).map((key) => <button key={key} onClick={() => toggleInstructor(key)} title={`Quitar ${instructorLabels.get(key) ?? key}`}><span>{instructorLabels.get(key) ?? key}</span><b aria-hidden="true">×</b></button>)}{selectedInstructorKeys.length > 1 && <div className="selected-instructors-overflow"><button className="overflow-trigger" type="button" aria-label={`Mostrar ${selectedInstructorKeys.length - 1} instructores más`}>+{selectedInstructorKeys.length - 1} más</button><div>{selectedInstructorKeys.slice(1).map((key) => <button key={key} onClick={() => toggleInstructor(key)} title={`Quitar ${instructorLabels.get(key) ?? key}`}><span>{instructorLabels.get(key) ?? key}</span><b aria-hidden="true">×</b></button>)}</div></div>}</div>}
        </div>
        <button className="toolbar-people active" onClick={closeInstructorMode} aria-label="Volver al reporte" title="Volver al reporte"><span className="close-icon" aria-hidden="true" /></button>
      </> : <>
        <PopupFilter label="Año" value={year === "all" ? undefined : year} options={years.map((value) => ({ value, label: value }))} open={openFilterMenu === "year"} onOpenChange={(open) => setOpenFilterMenu((current) => open ? "year" : current === "year" ? null : current)} onChange={(value) => { setYear(value); setMonth("all"); setProgram(""); setExpandedProgram(null); }} />
        <PopupFilter label="Mes" className="month-filter" value={month === "all" ? undefined : month} options={monthOptions} open={openFilterMenu === "month"} onOpenChange={(open) => setOpenFilterMenu((current) => open ? "month" : current === "month" ? null : current)} onChange={setMonth} />
        <PopupFilter label="Programa" className="program-filter" value={program || undefined} options={[{ value: "all", label: "Todos" }, ...unique(rows, "programa").map((value) => ({ value, label: value }))]} open={openFilterMenu === "program"} onOpenChange={(open) => setOpenFilterMenu((current) => open ? "program" : current === "program" ? null : current)} onChange={(value) => { setProgram(value); setExpandedProgram(value === "all" ? null : value); }} />
        <PopupFilter label="Región" value={region === "all" ? undefined : region} options={unique(rows, "region").map((value) => ({ value, label: value }))} open={openFilterMenu === "region"} onOpenChange={(open) => setOpenFilterMenu((current) => open ? "region" : current === "region" ? null : current)} onChange={setRegion} />
        <button className="toolbar-people" disabled={!periodReady} onClick={() => { setProgram("all"); setRegion("all"); setExpandedProgram(null); setOpenFilterMenu(null); setInstructorMode(true); }} aria-label="Analizar instructores" title={periodReady ? "Analizar instructores" : "Selecciona año y mes primero"}>◎</button>
      </>}
    </div></div>

    {!periodReady ? <section className="filter-empty-state survey-filter-empty"><span>PERIODO REQUERIDO</span><h3>Selecciona año y mes</h3><p>Define el periodo para consultar la experiencia, recomendación y desempeño de los cursos.</p></section> : !selectionReady ? <section className="filter-empty-state survey-filter-empty"><span>{instructorMode ? "INSTRUCTOR REQUERIDO" : "PROGRAMA REQUERIDO"}</span><h3>{instructorMode ? "Selecciona un instructor" : "Selecciona un programa"}</h3><p>{instructorMode ? "Busca y agrega al menos un instructor para mostrar su información." : "El reporte permanecerá vacío hasta que definas el programa que deseas consultar."}</p></section> : <>
    <section className="report-lead survey-lead"><h3>{instructorMode ? "Análisis de instructores" : courseTitle}</h3><p>{instructorMode ? "Selecciona uno o varios instructores para comparar calificaciones, temas recurrentes y oportunidades." : "Una lectura unificada de satisfacción, recomendación y desempeño. Programa agrupa internamente todos sus cursos."}</p><small>Información consolidada hasta el {dashboard.cutoffDate || dashboard.period}.</small></section>

    <section className="survey-kpis"><article className={`metric-status ${metricTone(isaValue)}`} title="Semáforo ISA: verde ≥ 90%, naranja 80–89.9%, rojo < 80%"><span>ISA</span><strong>{isaValue.toFixed(1)}%</strong><small>Promedio de rubros evaluados</small></article><article className={`metric-status ${metricTone(npsValue)}`} title="NPS = porcentaje de promotores menos porcentaje de detractores"><span>NPS</span><strong>{npsValue.toFixed(1)}</strong><small>Promotores menos detractores</small></article><article><span>Encuestas</span><strong>{totals.respuestas.toLocaleString("es-MX")}</strong><small>En la selección actual</small></article><article><span>Instructores</span><strong>{instructorCount.toLocaleString("es-MX")}</strong><small>{evaluatedCourseCount.toLocaleString("es-MX")} cursos evaluados</small></article></section>

    {focusActive && <section className="instructor-focus-detail">{inlineInsight(instructorAnalysisTitle, filtered, matchingDetails, trendBase, comments.filter(trendDetailMatches), "instructor-summary")}</section>}

    <section className={program && program !== "all" ? "survey-grid program-focused" : "survey-grid"}>
      <article className="panel survey-panel insight-panel"><div className="panel-heading insight-heading"><div><span>{insightView === "trend" ? "Evolución mensual" : "Puntaje por rubro"}</span><small>{insightView === "trend" ? `Últimos ${trendMonths} periodos hasta la selección` : "Ordenado de mayor a menor · sobre 100"}</small></div><div className="panel-switch" role="group" aria-label="Cambiar visualización"><button className={insightView === "trend" ? "active" : ""} onClick={() => setInsightView("trend")} aria-label="Ver evolución" title="Evolución">Evolución</button><button className={insightView === "rubrics" ? "active" : ""} onClick={() => setInsightView("rubrics")} aria-label="Ver tabla de rubros" title="Tabla de rubros">Rubros</button></div></div><div className="insight-body" style={insightHeight ? { height: `${insightHeight}px` } : undefined}><div className="insight-view" key={insightView} ref={insightContentRef}>{insightView === "trend" ? <TrendChart items={trend.slice(-trendMonths)} months={trendMonths} onMonthsChange={setTrendMonths} /> : <><SmoothList open={showAllRubrics} visible={3} className="rubric-list">{rubricRows.map((item) => <div key={item.label}><span>{item.label}<small>{item.count.toLocaleString("es-MX")} respuestas</small></span><i><b style={{ width: `${item.value}%` }} /></i><strong>{item.value.toFixed(1)}%</strong></div>)}</SmoothList>{rubricRows.length > 3 && <MoreButton open={showAllRubrics} count={rubricRows.length - 3} onClick={() => setShowAllRubrics((current) => !current)} />}</>}</div></div></article>

      {!instructorMode && <article className="panel survey-panel instructor-panel"><div className="panel-heading"><div><span>Instructores destacados</span><small>{instructorRanking.length.toLocaleString("es-MX")} con encuesta en la selección · ranking por ISA</small></div></div><SmoothList open={showAllInstructors} visible={5} className="compact-ranking">{instructorRanking.map((item, index) => <div className="expandable-row" key={item.key}><button className={expandedInstructorKey === item.key ? "selected" : ""} onClick={() => setExpandedInstructorKey((current) => current === item.key ? null : item.key)} aria-expanded={expandedInstructorKey === item.key}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.label}<small>{item.programLabel} · {item.responses.toLocaleString("es-MX")} encuestas · NPS {item.nps.toFixed(1)}</small></span><strong>{item.isa.toFixed(1)}%</strong></button>{expandedInstructorKey === item.key && inlineInsight(item.label, prefiltered.filter((row) => instructorKey(row.instructor) === item.key), comments.filter((detail) => detailMatches(detail) && instructorKey(detail.instructor) === item.key), trendBase.filter((row) => instructorKey(row.instructor) === item.key), comments.filter((detail) => trendDetailMatches(detail) && instructorKey(detail.instructor) === item.key))}</div>)}</SmoothList>{instructorRanking.length > 5 && <MoreButton open={showAllInstructors} count={instructorRanking.length - 5} onClick={() => setShowAllInstructors((current) => !current)} />}</article>}

      {!instructorMode && <article className="panel survey-panel program-panel"><div className="panel-heading"><div><span>Programas</span><small>Toca uno para abrir su información sin ocultar los demás</small></div></div><SmoothList open={showAllPrograms} visible={initiallyVisiblePrograms} className="program-table">{programRows.map((item) => <div className={`expandable-row${item.responses ? "" : " no-data"}`} key={item.label}><button className={expandedProgram === item.label ? "selected" : ""} onClick={() => item.responses && setExpandedProgram((current) => current === item.label ? null : item.label)} aria-expanded={expandedProgram === item.label} aria-disabled={!item.responses}><span>{item.label}<small>{item.responses ? `${item.responses.toLocaleString("es-MX")} encuestas` : "Sin encuestas en la selección"}</small></span><i><b style={{ width: `${item.isa}%` }} /></i><strong>{item.responses ? `${item.isa.toFixed(1)}%` : "—"}</strong><em>{item.responses ? `NPS ${item.nps.toFixed(1)}` : "Sin datos"}</em></button>{expandedProgram === item.label && item.responses > 0 && inlineInsight(item.label, programBase.filter((row) => row.programa === item.label), comments.filter((detail) => programDetailMatches(detail, item.label)), programHistoryRows(item.label), programHistoryDetails(item.label), program === item.label ? "program" : "program-default")}</div>)}</SmoothList>{programRows.length > initiallyVisiblePrograms && <MoreButton open={showAllPrograms} count={programRows.length - initiallyVisiblePrograms} onClick={() => setShowAllPrograms((current) => !current)} />}</article>}

      {instructorMode && selectedInstructorKeys.length > 0 && <article className="panel survey-panel instructor-courses-panel"><div className="panel-heading"><div><span>Cursos y voz del participante</span><small>Cursos del periodo y filtros seleccionados</small></div><b>{instructorCourses.length.toLocaleString("es-MX")}</b></div><div className="program-table instructor-course-table">{instructorCourses.map((item) => <div className="expandable-row" key={item.label}><button className={expandedInstructorCourse === item.label ? "selected" : ""} onClick={() => { setExpandedInstructorCourse((current) => current === item.label ? null : item.label); setCommentTone("all"); setShowAllComments(false); }} aria-expanded={expandedInstructorCourse === item.label}><span className="course-heading"><span className="course-label">{item.label}</span>{item.isTeam && <mark className="course-team-tag" title={`Resultado ponderado de ${item.contributorCount} instructores`}>Equipo</mark>}</span><i><b style={{ width: `${item.isa}%` }} /></i><strong>{item.isa.toFixed(1)}%</strong><em>NPS {item.nps.toFixed(1)}</em><small className="course-meta">{item.programLabel} · {item.responses.toLocaleString("es-MX")} encuestas · {item.commentCount ? `${item.commentCount.toLocaleString("es-MX")} comentarios` : "sin comentarios escritos"}{item.isTeam ? ` · ponderado por ${item.responses.toLocaleString("es-MX")} respuestas de ${item.contributorCount} instructores` : ""}</small></button>{expandedInstructorCourse === item.label && instructorCourseVoice(item.label, item.programs)}</div>)}</div></article>}

      {!instructorMode && <article className="panel survey-panel comments-panel"><div className="panel-heading"><div><span>Voz del participante</span><small>Temas repetidos y comentarios según la selección</small></div><b>{voiceTotal.toLocaleString("es-MX")}</b></div><div className="tone-tabs" role="group" aria-label="Filtrar comentarios"><button className={commentTone === "all" ? "active" : ""} onClick={() => setCommentTone("all")}>Todos</button><button className={commentTone === "positive" ? "active" : ""} onClick={() => setCommentTone("positive")}>Positivos</button><button className={commentTone === "negative" ? "active" : ""} onClick={() => setCommentTone("negative")}>Oportunidades</button></div>
        {commentsError ? <p className="comments-empty">{commentsError}</p> : visibleVoiceComments.length ? <><SmoothList open={showAllComments} visible={6} className="comment-list">{visibleVoiceComments.slice(0, 18).map((item, index) => <blockquote key={`${item.fecha ?? item.theme}-${index}`}><span className={`comment-tone ${item.sentiment}`}>{item.sentiment === "negative" ? "Oportunidad" : item.sentiment === "positive" ? "Positivo" : "Comentario"}</span><p>{item.comentario}</p><footer>{item.programa}<span>{item.fecha || "Comentario representativo"}</span></footer></blockquote>)}</SmoothList>{visibleVoiceComments.length > 6 && <MoreButton open={showAllComments} count={Math.min(12, visibleVoiceComments.length - 6)} onClick={() => setShowAllComments((current) => !current)} />}</> : <p className="comments-empty">No hay comentarios para esta selección.</p>}
      </article>}
    </section>
    </>}
  </>;
}
