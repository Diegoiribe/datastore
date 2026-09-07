import type { CategoryDashboard, MetricRow, PendingRow, PeriodSummary } from "./dashboard-data";

type StudioDemoCategory = {
  key: string;
  label: string;
  collectionKey?: string | null;
  collectionLabel?: string | null;
  history: Record<string, PeriodSummary>;
};

const demoPeriods = ["2026-07", "2026-08"];
const demoLabels: Record<string, string> = {
  almacenista: "Almacenista",
  asesor: "Asesor",
  cajero: "Cajero",
  gerente: "Gerente",
  gerente_zona: "Gerente zona",
  staff: "STAFF",
  cobranza: "Cobranza",
};

function historyFor(seed: number): Record<string, PeriodSummary> {
  return Object.fromEntries(demoPeriods.map((period, index) => {
    const total = 720 + seed * 37 + index * 42;
    const progress = 62 + ((seed * 7 + index * 6) % 25);
    const completed = Math.round(total * progress / 100);
    return [period, {
      cutoff_date: `${period}-${period.endsWith("07") ? "31" : "31"}`,
      year: Number(period.slice(0, 4)),
      month: Number(period.slice(5, 7)),
      total,
      completed,
      pending: total - completed,
      progress_percentage: progress,
      pending_percentage: 100 - progress,
    }];
  }));
}

export const studioDemoCategories: StudioDemoCategory[] = [
  { key: "almacenista", label: demoLabels.almacenista, history: historyFor(1) },
  { key: "asesor", label: demoLabels.asesor, history: historyFor(2) },
  { key: "cajero", label: demoLabels.cajero, history: historyFor(3) },
  { key: "gerente", label: demoLabels.gerente, history: historyFor(4) },
  { key: "gerente_zona", label: demoLabels.gerente_zona, history: historyFor(5) },
  { key: "staff", label: demoLabels.staff, collectionKey: "staff", collectionLabel: "Staff", history: historyFor(6) },
  { key: "cobranza", label: demoLabels.cobranza, history: historyFor(7) },
];

function seedFor(category: string) {
  return [...category].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

export function loadStudioDemoDashboard(category: string, period: string): CategoryDashboard {
  const seed = seedFor(category);
  const positions = [`Puesto ${demoLabels[category] ?? "Demo"}`];
  const regions = ["Región Norte · Demo", "Región Centro · Demo", "Región Sur · Demo"];
  const courses = ["Curso de introducción · Demo", "Curso de servicio · Demo", "Curso de operación · Demo"];
  const metrics: MetricRow[] = regions.flatMap((region, regionIndex) => courses.map((curso, courseIndex) => {
    const total = 70 + ((seed + regionIndex * 17 + courseIndex * 11) % 55);
    const progress = 58 + ((seed + regionIndex * 9 + courseIndex * 13) % 35);
    const completados = Math.round(total * progress / 100);
    return {
      puesto: positions[0],
      region,
      curso,
      total,
      completados,
      pendientes: total - completados,
      avance: Math.round(completados / total * 1000) / 10,
    };
  }));
  const categoryIndex = Math.max(1, Object.keys(demoLabels).indexOf(category) + 1);
  return {
    category,
    label: demoLabels[category] ?? "Reporte de prueba",
    period,
    cutoffDate: `${period}-28`,
    metrics,
    positions,
    regions,
    courses,
    pendingSections: [],
    history: historyFor(categoryIndex),
    dataKind: "training",
    programs: [],
    instructors: [],
    responseCount: 0,
    isa: 0,
    nps: 0,
    scoreFiveResponses: 0,
    npsScaleStatus: "demo",
    publicationRevision: 0,
  };
}

export function studioDemoPendingRows(category: string): PendingRow[] {
  const label = demoLabels[category] ?? "Demo";
  return Array.from({ length: 6 }, (_, index) => ({
    numero_persona: `DEMO-${String(index + 1).padStart(3, "0")}`,
    nombre: `Persona de prueba ${String(index + 1).padStart(2, "0")}`,
    tienda: `D${String(index + 1).padStart(2, "0")}`,
    curso: ["Curso de introducción · Demo", "Curso de servicio · Demo", "Curso de operación · Demo"][index % 3],
    region: ["Región Norte · Demo", "Región Centro · Demo", "Región Sur · Demo"][index % 3],
    puesto: `Puesto ${label}`,
  }));
}
