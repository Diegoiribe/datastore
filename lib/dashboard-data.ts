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
  comentarios?: number;
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
  proposal?: string | null;
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
  publicationRevision: number;
  administrativeViews?: EicAdministrativeViews;
};

export type EicAdministrativeRow = Record<string, string | number | boolean | null>;
export type EicAdministrativeViews = Record<string, EicAdministrativeRow[]>;

const pendingDashboardCache = new Map<string, Promise<PendingRow[]>>();
const detailDashboardCache = new Map<string, Promise<SatisfactionComment[]>>();
function studioShareToken() {
  return typeof window === "undefined"
    ? ""
    : new URLSearchParams(window.location.search).get("share") ?? "";
}

function apiBaseUrl() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_MACINTOSH_API_URL ?? "http://localhost:8010";
  if (studioShareToken()) return "";
  const remote = !["localhost", "127.0.0.1"].includes(window.location.hostname);
  return remote ? "/api/macintosh" : process.env.NEXT_PUBLIC_MACINTOSH_API_URL ?? "http://localhost:8010";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const shareToken = studioShareToken();
  if (shareToken) headers.set("Authorization", `Bearer ${shareToken}`);
  const response = await fetch(`${apiBaseUrl().replace(/\/$/, "")}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      String(payload.detail ?? `Macintosh respondió ${response.status}.`),
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
  // La misma categoría y periodo se reemplazan al volver a publicar. Siempre
  // consulta la cabecera para conocer la revisión vigente.
  return fetchCategoryDashboard(category, period);
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
  const cacheKey = `${dashboard.category}/${dashboard.period}/${dashboard.publicationRevision}`;
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
  const cacheKey = `${dashboard.category}/${dashboard.period}/${dashboard.publicationRevision}`;
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
  if (dashboard.administrativeViews) return Promise.resolve(dashboard.administrativeViews);
  return requestJson<EicAdministrativeViews>(
    `/api/dashboard/${encodeURIComponent(dashboard.period)}/${encodeURIComponent(dashboard.category)}/views`,
  );
}

export type StudioReportCopy = {
  reportKey: string;
  fields: Record<string, string>;
  updatedAt: string | null;
};

export type StudioShareSession = {
  scope: "all" | "tienda" | "staff" | "cobranza" | "especializada";
  allowedReportKeys: string[];
  expiresAt: string;
};

export type StudioComment = {
  id: string;
  text: string;
  anchor: "sheet" | "intro" | "metrics" | "chart" | "ranking" | "courses" | "budget" | "authorized" | "distribution" | "categories" | "flow" | "areas" | "initiatives";
  x: number;
  y: number;
  coordinateSpace: "sheet" | "block";
  createdAt: string;
  completed: boolean;
  completedAt: string;
};

export function loadStudioShareSession() {
  return requestJson<StudioShareSession>("/api/studio/share/session");
}

export function loadStudioReportCopy(reportKey: string) {
  return requestJson<StudioReportCopy>(
    `/api/studio/reports/${encodeURIComponent(reportKey)}/copy`,
  );
}

export function saveStudioReportCopy(reportKey: string, fields: Record<string, string>) {
  return requestJson<StudioReportCopy>(
    `/api/studio/reports/${encodeURIComponent(reportKey)}/copy`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  );
}

export function loadStudioComments(reportKey: string) {
  return requestJson<StudioComment[]>(
    `/api/studio/reports/${encodeURIComponent(reportKey)}/comments`,
  );
}

export function createStudioComment(
  reportKey: string,
  comment: Pick<StudioComment, "text" | "anchor" | "x" | "y" | "coordinateSpace">,
) {
  return requestJson<StudioComment>(
    `/api/studio/reports/${encodeURIComponent(reportKey)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(comment),
    },
  );
}

export function completeStudioComment(reportKey: string, id: string) {
  return requestJson<StudioComment>(
    `/api/studio/reports/${encodeURIComponent(reportKey)}/comments`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
}

export function deleteStudioComment(reportKey: string, id: string) {
  return requestJson<{ id: string; deleted: boolean }>(
    `/api/studio/reports/${encodeURIComponent(reportKey)}/comments`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
}
