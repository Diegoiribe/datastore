import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

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
const pendingCache = new Map<string, Promise<PendingRow[]>>();

function decodeRows(snapshot: { data(): Record<string, unknown> }) {
  const data = snapshot.data();
  const columns = (data.columns ?? []) as string[];
  const rows = (data.rows ?? []) as unknown[][];
  return rows.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
}

export async function listCategories() {
  const snapshot = await getDocs(collection(db, "dashboard_categories"));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        key: item.id,
        label: String(data.category_label ?? item.id),
        history: (data.periods ?? {}) as Record<string, PeriodSummary>,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function loadCategoryDashboard(category: string, period: string) {
  const cacheKey = `${category}/${period}`;
  if (!dashboardCache.has(cacheKey)) {
    dashboardCache.set(cacheKey, fetchCategoryDashboard(category, period));
  }
  return dashboardCache.get(cacheKey)!;
}

async function fetchCategoryDashboard(category: string, period: string) {
  const categoryRef = doc(db, "periods", period, "categories", category);
  const [metadataSnapshot, historySnapshot, cubeSnapshot] = await Promise.all([
    getDoc(categoryRef),
    getDoc(doc(db, "dashboard_categories", category)),
    getDocs(
      query(collection(categoryRef, "view_chunks"), where("view", "==", "cube")),
    ),
  ]);
  if (!metadataSnapshot.exists()) {
    throw new Error(`No hay datos publicados para ${category} en ${period}.`);
  }
  const metadata = metadataSnapshot.data();
  const history = historySnapshot.exists() ? historySnapshot.data() : {};
  const metricDocs = [...cubeSnapshot.docs].sort(
    (a, b) => Number(a.data().index ?? 0) - Number(b.data().index ?? 0),
  );
  return {
    category,
    label: String(metadata.category_label ?? category),
    period,
    cutoffDate: String(metadata.cutoff_date ?? ""),
    metrics: metricDocs.flatMap((item) => decodeRows(item)) as MetricRow[],
    positions: (metadata.positions ?? []) as string[],
    regions: (metadata.regions ?? []) as string[],
    courses: (metadata.courses ?? []) as string[],
    pendingSections: (metadata.pending_sections ?? []) as PendingSection[],
    history: (history.periods ?? {}) as Record<string, PeriodSummary>,
  } satisfies CategoryDashboard;
}

export function loadPendingSection(
  dashboard: CategoryDashboard,
  section: PendingSection,
) {
  const cacheKey = `${dashboard.category}/${dashboard.period}/${section.section_key}`;
  if (!pendingCache.has(cacheKey)) {
    pendingCache.set(cacheKey, fetchPendingSection(dashboard, section));
  }
  return pendingCache.get(cacheKey)!;
}

async function fetchPendingSection(
  dashboard: CategoryDashboard,
  section: PendingSection,
) {
  const categoryRef = doc(
    db,
    "periods",
    dashboard.period,
    "categories",
    dashboard.category,
  );
  const snapshot = await getDocs(
    query(
      collection(categoryRef, "pending_chunks"),
      where("section_key", "==", section.section_key),
    ),
  );
  return [...snapshot.docs]
    .sort((a, b) => Number(a.data().index ?? 0) - Number(b.data().index ?? 0))
    .flatMap((item) =>
      decodeRows(item).map((row) => ({
        ...row,
        region: section.region,
        puesto: section.position,
      })),
    ) as PendingRow[];
}
