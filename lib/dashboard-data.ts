export type MetricRow = {
  puesto: string;
  region: string;
  curso: string;
  total: number;
  completados: number;
  pendientes: number;
  avance: number;
};

export type SatisfactionMetricRow = {
  mes: string;
  programa: string;
  curso: string;
  instructor: string;
  region: string;
  respuestas: number;
  dominio_suma: number;
  dominio_n: number;
  comunicacion_suma: number;
  comunicacion_n: number;
  interes_suma: number;
  interes_n: number;
  participacion_suma: number;
  participacion_n: number;
  resolucion_suma: number;
  resolucion_n: number;
  nps_validas: number;
  promotores: number;
  pasivos: number;
  detractores: number;
  respuestas_cinco: number;
  nps_maximas?: number;
  primera_respuesta: string;
  ultima_respuesta: string;
};

export type SatisfactionComment = {
  record_type: "comment" | "theme";
  fecha: string | null;
  mes: string;
  programa: string;
  curso: string;
  instructor: string;
  region: string;
  recomendacion: number | null;
  sentiment: "positive" | "negative" | "neutral";
  theme: string;
  count: number;
  comentario: string | null;
  example: string;
};

export type PendingRow = {
  numero_persona: string;
  nombre: string;
  tienda: string | null;
  curso: string;
  region: string;
  puesto: string;
};

export type PeriodSummary = {
  cutoff_date: string;
  year: number;
  month: number;
  total: number;
  completed: number;
  pending: number;
  progress_percentage: number;
  pending_percentage: number;
};

export type PendingSection = {
  region: string;
  position: string;
  section_key: string;
  chunks: number;
};

export type CategoryDashboard = {
  category: string;
  label: string;
  period: string;
  cutoffDate: string;
  metrics: Array<MetricRow | SatisfactionMetricRow>;
  positions: string[];
  regions: string[];
  courses: string[];
  pendingSections: PendingSection[];
  history: Record<string, PeriodSummary>;
  dataKind: "training" | "satisfaction" | "eic_administrative";
  programs: string[];
  instructors: string[];
  responseCount: number;
  isa: number;
  nps: number;
  scoreFiveResponses: number;
  npsScaleStatus: string;
};

export type EicAdministrativeRow = Record<string, string | number | boolean | null>;
export type EicAdministrativeViews = Record<string, EicAdministrativeRow[]>;

const dashboardCache = new Map<string, Promise<CategoryDashboard>>();
const pendingDashboardCache = new Map<string, Promise<PendingRow[]>>();
const detailDashboardCache = new Map<string, Promise<SatisfactionComment[]>>();
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_RUNSQL_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      String(payload.detail ?? `RunSQL respondió ${response.status}.`),
    );
  }
  return response.json() as Promise<T>;
}

export async function listCategories() {
  return requestJson<
    Array<{
      key: string;
      label: string;
      collectionKey: string | null;
      collectionLabel: string | null;
      history: Record<string, PeriodSummary>;
    }>
  >("/api/dashboard/categories");
}

export function loadCategoryDashboard(category: string, period: string) {
  const cacheKey = `${category}/${period}`;
  if (!dashboardCache.has(cacheKey)) {
    const request = fetchCategoryDashboard(category, period).catch((error) => {
      dashboardCache.delete(cacheKey);
      throw error;
    });
    dashboardCache.set(cacheKey, request);
  }
  return dashboardCache.get(cacheKey)!;
}

async function fetchCategoryDashboard(category: string, period: string) {
  return requestJson<CategoryDashboard>(
    `/api/dashboard/${encodeURIComponent(period)}/${encodeURIComponent(category)}`,
  );
}

export function loadPendingSection(
  dashboard: CategoryDashboard,
  section: PendingSection,
) {
  const cacheKey = `${dashboard.category}/${dashboard.period}`;
  if (!pendingDashboardCache.has(cacheKey)) {
    const request = fetchPendingDashboard(dashboard).catch((error) => {
      pendingDashboardCache.delete(cacheKey);
      throw error;
    });
    pendingDashboardCache.set(cacheKey, request);
  }
  return pendingDashboardCache.get(cacheKey)!.then((rows) =>
    rows.filter(
      (row) => row.region === section.region && row.puesto === section.position,
    ),
  );
}

async function fetchPendingDashboard(dashboard: CategoryDashboard) {
  return requestJson<PendingRow[]>(
    `/api/dashboard/${encodeURIComponent(dashboard.period)}/${encodeURIComponent(dashboard.category)}/pending`,
  );
}

export function loadDashboardDetails(dashboard: CategoryDashboard) {
  const cacheKey = `${dashboard.category}/${dashboard.period}`;
  if (!detailDashboardCache.has(cacheKey)) {
    const request = requestJson<SatisfactionComment[]>(
      `/api/dashboard/${encodeURIComponent(dashboard.period)}/${encodeURIComponent(dashboard.category)}/details`,
    ).catch((error) => {
      detailDashboardCache.delete(cacheKey);
      throw error;
    });
    detailDashboardCache.set(cacheKey, request);
  }
  return detailDashboardCache.get(cacheKey)!;
}

export function loadAdministrativeViews(dashboard: CategoryDashboard) {
  return requestJson<EicAdministrativeViews>(
    `/api/dashboard/${encodeURIComponent(dashboard.period)}/${encodeURIComponent(dashboard.category)}/views`,
  );
}
