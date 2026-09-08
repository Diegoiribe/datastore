import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const allowedFields = new Set([
  "intro.description", "metrics.progress", "metrics.assigned",
  "metrics.pending", "chart.title", "chart.subtitle", "ranking.title",
  "ranking.subtitle", "courses.title", "courses.subtitle", "layout.order",
  "layout.hidden", "eic.intro.description", "eic.metrics.budget",
  "eic.metrics.investment", "eic.metrics.remaining", "eic.metrics.charged",
  "eic.budget.title", "eic.budget.subtitle", "eic.accounting.title",
  "eic.authorized.title", "eic.authorized.subtitle", "eic.distribution.title",
  "eic.distribution.subtitle", "eic.clusters.title", "eic.clusters.subtitle",
  "eic.modalities.title", "eic.modalities.subtitle", "eic.categories.title",
  "eic.categories.subtitle", "eic.ranking.title", "eic.ranking.subtitle",
  "eic.flow.title", "eic.flow.subtitle", "eic.areas.title", "eic.areas.subtitle",
  "eic.initiatives.title", "eic.initiatives.subtitle",
]);
const collectionDocumentKeys = ["tienda", "staff", "cobranza", "planes_de_capacitacion"];
const commentAnchors = new Set([
  "sheet", "intro", "metrics", "chart", "ranking", "courses", "budget",
  "authorized", "distribution", "categories", "flow", "areas", "initiatives",
]);

export class StudioAccessError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

function database() {
  const rawCredential = process.env.MACINTOSH_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawCredential) throw new StudioAccessError("Studio no tiene configurada su conexión editorial.", 503);
  let credential: { project_id?: string; client_email?: string; private_key?: string };
  try {
    credential = JSON.parse(rawCredential);
  } catch {
    throw new StudioAccessError("La conexión editorial de Studio no tiene un formato válido.", 503);
  }
  if (!credential.project_id || !credential.client_email || !credential.private_key) {
    throw new StudioAccessError("La conexión editorial de Studio está incompleta.", 503);
  }
  const app = getApps().find((candidate) => candidate.name === "macintosh-studio-vercel")
    ?? initializeApp({ credential: cert(credential as Parameters<typeof cert>[0]) }, "macintosh-studio-vercel");
  return getFirestore(app);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function equalHash(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function requireStudioShare(request: Request, reportKey?: string) {
  const match = /^(all|tienda|staff|cobranza|especializada)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(bearerToken(request));
  if (!match) throw new StudioAccessError("El enlace de Studio no es válido.");
  const [, tokenScope, shareId, secret] = match;
  const snapshot = await database().collection("macintosh_studio_shares").doc(shareId).get();
  const data = snapshot.exists ? snapshot.data() ?? {} : {};
  const secretHash = createHash("sha256").update(secret).digest("hex");
  if (!snapshot.exists || !data.active || data.scope !== tokenScope
      || typeof data.secret_hash !== "string" || !equalHash(secretHash, data.secret_hash)) {
    throw new StudioAccessError("El enlace de Studio fue revocado o no es válido.");
  }
  const expiresAt = String(data.expires_at ?? "");
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
    throw new StudioAccessError("El enlace de Studio ya venció.");
  }
  const allowedReportKeys = Array.isArray(data.allowed_report_keys)
    ? data.allowed_report_keys.filter((key): key is string => typeof key === "string")
    : [];
  const scopedCollectionKeys = tokenScope === "all"
    ? collectionDocumentKeys
    : [tokenScope === "especializada" ? "planes_de_capacitacion" : tokenScope];
  if (reportKey && !allowedReportKeys.includes(reportKey) && !scopedCollectionKeys.includes(reportKey)) {
    throw new StudioAccessError("Este enlace no permite abrir ese reporte.", 404);
  }
  return { scope: tokenScope, allowedReportKeys, expiresAt };
}

function validateStudioComment(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new StudioAccessError("El comentario no tiene un formato válido.", 400);
  }
  const candidate = input as Record<string, unknown>;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const anchor = typeof candidate.anchor === "string" ? candidate.anchor.trim().toLowerCase() : "sheet";
  const coordinateSpace = candidate.coordinateSpace === "block" ? "block" : "sheet";
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  if (!text || text.length > 500) {
    throw new StudioAccessError("El comentario debe tener entre 1 y 500 caracteres.", 400);
  }
  if (!commentAnchors.has(anchor) || (coordinateSpace === "block" && anchor === "sheet")
      || !Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || x > 1 || y < 0 || y > 1) {
    throw new StudioAccessError("La posición del comentario no es válida.", 400);
  }
  return { text, anchor, x, y, coordinateSpace };
}

export function validateStudioFields(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new StudioAccessError("Los textos de Studio no tienen un formato válido.", 400);
  }
  const validated: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedFields.has(key) || typeof value !== "string") {
      throw new StudioAccessError(`El campo editorial ${key} no está permitido.`, 400);
    }
    const cleaned = value.trim();
    if (!cleaned || cleaned.length > 1200) {
      throw new StudioAccessError(`El campo editorial ${key} no tiene una longitud válida.`, 400);
    }
    validated[key] = cleaned;
  }
  return validated;
}

function storedStudioFields(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).flatMap(([key, value]) => {
    if (!allowedFields.has(key) || typeof value !== "string") return [];
    const cleaned = value.trim();
    return cleaned && cleaned.length <= 1200 ? [[key, cleaned]] : [];
  }));
}

export async function readStudioCopy(reportKey: string) {
  const snapshot = await database().collection("macintosh_studio_reports").doc(reportKey).get();
  const data = snapshot.exists ? snapshot.data() ?? {} : {};
  return {
    reportKey,
    fields: storedStudioFields(data.fields ?? {}),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
  };
}

export async function writeStudioCopy(reportKey: string, input: unknown) {
  const fields = validateStudioFields(input);
  const updatedAt = new Date().toISOString();
  const db = database();
  const reference = db.collection("macintosh_studio_reports").doc(reportKey);
  const savedFields = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? snapshot.data() ?? {} : {};
    const merged = { ...storedStudioFields(current.fields ?? {}), ...fields };
    transaction.set(reference, {
      fields: merged,
      updated_at: updatedAt,
      updated_by: "macintosh-studio-vercel",
      schema_version: 1,
    });
    return merged;
  });
  return { reportKey, fields: savedFields, updatedAt };
}

export async function readStudioComments(reportKey: string) {
  const snapshots = await database().collection("macintosh_studio_reports").doc(reportKey)
    .collection("comments").orderBy("created_at", "asc").get();
  return snapshots.docs.flatMap((snapshot) => {
    try {
      const data = snapshot.data();
      return [{
        id: snapshot.id,
        ...validateStudioComment(data),
        createdAt: typeof data.created_at === "string" ? data.created_at : "",
        completed: Boolean(data.completed),
        completedAt: typeof data.completed_at === "string" ? data.completed_at : "",
      }];
    } catch {
      return [];
    }
  });
}

export async function writeStudioComment(reportKey: string, input: unknown) {
  const comment = validateStudioComment(input);
  const createdAt = new Date().toISOString();
  const reference = database().collection("macintosh_studio_reports").doc(reportKey)
    .collection("comments").doc();
  await reference.set({
    ...comment,
    created_at: createdAt,
    created_by: "macintosh-studio-vercel",
    completed: false,
    schema_version: 1,
  });
  return { id: reference.id, ...comment, createdAt, completed: false, completedAt: "" };
}

export async function completeStudioComment(reportKey: string, commentId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(commentId)) {
    throw new StudioAccessError("El comentario no es válido.", 400);
  }
  const reference = database().collection("macintosh_studio_reports").doc(reportKey)
    .collection("comments").doc(commentId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new StudioAccessError("El comentario ya no existe.", 404);
  const data = snapshot.data() ?? {};
  const completedAt = new Date().toISOString();
  await reference.update({ completed: true, completed_at: completedAt });
  return {
    id: reference.id, ...validateStudioComment(data),
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
    completed: true, completedAt,
  };
}

export async function deleteStudioComment(reportKey: string, commentId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(commentId)) {
    throw new StudioAccessError("El comentario no es válido.", 400);
  }
  const reference = database().collection("macintosh_studio_reports").doc(reportKey)
    .collection("comments").doc(commentId);
  if (!(await reference.get()).exists) {
    throw new StudioAccessError("El comentario ya no existe.", 404);
  }
  await reference.delete();
  return { id: commentId, deleted: true };
}

export function studioErrorResponse(error: unknown) {
  const status = error instanceof StudioAccessError ? error.status : 500;
  const detail = error instanceof StudioAccessError
    ? error.message
    : "Studio no pudo consultar su configuración editorial.";
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}
