export type MetricRow = {
  puesto: string;
  region: string;
  curso: string;
  total: number;
  completados: number;
  pendientes: number;
  avance: number;
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
  metrics: MetricRow[];
  positions: string[];
  regions: string[];
  courses: string[];
  pendingSections: PendingSection[];
  history: Record<string, PeriodSummary>;
};

const dashboardCache = new Map<string, Promise<CategoryDashboard>>();
const pendingDashboardCache = new Map<string, Promise<PendingRow[]>>();
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
