import type { CategoryDashboard, EicAdministrativeViews, MetricRow, PendingRow, PeriodSummary } from "./dashboard-data";

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
  eic_demo: "Planes de capacitación",
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
  { key: "almacenista", label: demoLabels.almacenista, collectionKey: "tienda", collectionLabel: "Tienda", history: historyFor(1) },
  { key: "asesor", label: demoLabels.asesor, collectionKey: "tienda", collectionLabel: "Tienda", history: historyFor(2) },
  { key: "cajero", label: demoLabels.cajero, collectionKey: "tienda", collectionLabel: "Tienda", history: historyFor(3) },
  { key: "gerente", label: demoLabels.gerente, collectionKey: "tienda", collectionLabel: "Tienda", history: historyFor(4) },
  { key: "gerente_zona", label: demoLabels.gerente_zona, collectionKey: "tienda", collectionLabel: "Tienda", history: historyFor(5) },
  { key: "staff", label: demoLabels.staff, collectionKey: "staff", collectionLabel: "Staff", history: historyFor(6) },
  { key: "cobranza", label: demoLabels.cobranza, collectionKey: "cobranza", collectionLabel: "Cobranza", history: historyFor(7) },
  { key: "eic_demo", label: demoLabels.eic_demo, collectionKey: "planes_de_capacitacion", collectionLabel: "Capacitación especializada", history: historyFor(8) },
];

const eicDirections = [
  { direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Estrategia · Demo", necesidades_plan: 14, necesidades_extra_plan: 3, cursos_plan: 8, eventos_plan: 2, programas_ejecutivos_plan: 1, certificaciones_plan: 2, membresias_plan: 1, suscripciones_plan: 0, pax_proyectados_tablero: 180, necesidades: 17, necesidades_activas: 15, capacitaciones: 11, grupos: 14, capacitaciones_impartidas: 7, capacitaciones_en_curso: 2, capacitaciones_en_preparacion: 2, pax_proyectados: 165, pax_reales: 142, presupuesto_autorizado_mxn: 2400000, inversion_actual_mxn: 1560000, presupuesto_por_ejercer_mxn: 840000, cargado_al_centro_mxn: 1180000, pago_ejecutado_mxn: 1320000, pago_pendiente_mxn: 240000 },
  { direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Operación · Demo", necesidades_plan: 11, necesidades_extra_plan: 2, cursos_plan: 6, eventos_plan: 2, programas_ejecutivos_plan: 1, certificaciones_plan: 1, membresias_plan: 1, suscripciones_plan: 0, pax_proyectados_tablero: 140, necesidades: 13, necesidades_activas: 12, capacitaciones: 9, grupos: 11, capacitaciones_impartidas: 5, capacitaciones_en_curso: 2, capacitaciones_en_preparacion: 2, pax_proyectados: 128, pax_reales: 103, presupuesto_autorizado_mxn: 1800000, inversion_actual_mxn: 990000, presupuesto_por_ejercer_mxn: 810000, cargado_al_centro_mxn: 760000, pago_ejecutado_mxn: 840000, pago_pendiente_mxn: 150000 },
];

const studioDemoEicViews: EicAdministrativeViews = {
  general: [{ presupuesto_autorizado_mxn: 4200000, inversion_actual_mxn: 2550000, presupuesto_por_ejercer_mxn: 1650000, cargado_al_centro_mxn: 1940000, avance_presupuesto: 0.6071, avance_contable: 0.4619, necesidades: 30, necesidades_activas: 27, capacitaciones: 20, grupos: 25, capacitaciones_impartidas: 12, capacitaciones_en_curso: 4, capacitaciones_en_preparacion: 4, pax_proyectados: 293, pax_reales: 245, pago_ejecutado_mxn: 2160000, pago_pendiente_mxn: 390000 }],
  c_level: [{ direccion_c_level: "Dirección corporativa · Demo", presupuesto_autorizado_mxn: 4200000, inversion_actual_mxn: 2550000 }],
  directions: eicDirections,
  initiatives: [
    { identificador: "DEMO-EIC-01", nombre_iniciativa: "Liderazgo aplicado · Demo", direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Estrategia · Demo", tipo: "Programa", proveedor_seleccionado: "Proveedor Alfa · Demo", estatus_grupo_principal: "Impartido", inversion_actual_mxn: 680000 },
    { identificador: "DEMO-EIC-02", nombre_iniciativa: "Analítica para decisiones · Demo", direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Operación · Demo", tipo: "Curso", proveedor_seleccionado: "Proveedor Beta · Demo", estatus_grupo_principal: "Capacitación en curso", inversion_actual_mxn: 430000 },
    { identificador: "DEMO-EIC-03", nombre_iniciativa: "Certificación especializada · Demo", direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Estrategia · Demo", tipo: "Certificación", proveedor_seleccionado: "Proveedor Gamma · Demo", estatus_grupo_principal: "Por impartir", inversion_actual_mxn: 520000 },
  ],
  quotation_status: [
    { direccion_c_level: "Dirección corporativa · Demo", estatus_cotizacion: "Proveedor Seleccionado", necesidades: 18 },
    { direccion_c_level: "Dirección corporativa · Demo", estatus_cotizacion: "En proceso de cotización", necesidades: 9 },
  ],
  training_status: [
    { direccion_c_level: "Dirección corporativa · Demo", estatus_grupo: "Impartido", grupos: 12 },
    { direccion_c_level: "Dirección corporativa · Demo", estatus_grupo: "Capacitación en curso", grupos: 5 },
    { direccion_c_level: "Dirección corporativa · Demo", estatus_grupo: "Por impartir", grupos: 8 },
  ],
  payment_status: [
    { direccion_c_level: "Dirección corporativa · Demo", estatus_pago: "Pagado - con fecha de cargo al centro", movimientos: 14 },
    { direccion_c_level: "Dirección corporativa · Demo", estatus_pago: "Pendiente de pago", movimientos: 6 },
  ],
  training_groups: [
    { identificador: "DEMO-EIC-01", direccion_c_level: "Dirección corporativa · Demo", modalidad: "Presencial", estatus_contratacion: "Elaborando Orden de Servicios", pax_reales: 92, precio_persona_mxn: 8500 },
    { identificador: "DEMO-EIC-02", direccion_c_level: "Dirección corporativa · Demo", modalidad: "Online", estatus_contratacion: "Realizando Alta de Proveedores", pax_reales: 78, precio_persona_mxn: 16500 },
    { identificador: "DEMO-EIC-03", direccion_c_level: "Dirección corporativa · Demo", modalidad: "Híbrida", estatus_contratacion: "Elaborando Contrato Marco", pax_reales: 75, precio_persona_mxn: 32000 },
    { identificador: "DEMO-EIC-04", direccion_c_level: "Dirección corporativa · Demo", modalidad: "Presencial", estatus_contratacion: "N/A", pax_reales: 18, precio_persona_mxn: 12000 },
  ],
  participants: [],
  authorized_plan: eicDirections,
  cluster_distribution: [],
  modality_distribution: [],
  budget_categories: [],
  collaborator_ranking: [
    { numero_colaborador: "DEMO-001", colaborador: "Persona de prueba 01", puesto: "Puesto demo", direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Estrategia · Demo", cursos: 3, inversion_actual_mxn: 124000 },
    { numero_colaborador: "DEMO-002", colaborador: "Persona de prueba 02", puesto: "Puesto demo", direccion_c_level: "Dirección corporativa · Demo", direccion_nivel_2: "Operación · Demo", cursos: 2, inversion_actual_mxn: 88000 },
  ],
  payments: [],
  controls: [{ control: "Datos de demostración", valor: 0, esperado: 0, estatus: "PASS" }],
};

function seedFor(category: string) {
  return [...category].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

export function loadStudioDemoDashboard(category: string, period: string): CategoryDashboard {
  if (category === "eic_demo") {
    return {
      category, label: demoLabels[category], period, cutoffDate: `${period}-28`,
      metrics: [], positions: [], regions: ["Dirección corporativa · Demo"], courses: [],
      pendingSections: [], history: historyFor(8), dataKind: "eic_administrative",
      programs: [], instructors: [], responseCount: 0, isa: 0, nps: 0,
      scoreFiveResponses: 0, npsScaleStatus: "demo", publicationRevision: 0,
      administrativeViews: studioDemoEicViews,
    };
  }
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
