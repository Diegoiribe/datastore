import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function builtPage(filename) {
  return readFile(new URL(`../.next/server/app/${filename}`, import.meta.url), "utf8");
}

test("builds the Macintosh Studio report library", async () => {
  const html = await builtPage("index.html");
  assert.match(html, /<title>Macintosh Studio · Reportes<\/title>/i);
  assert.match(html, /Todos los reportes/);
  assert.match(html, /Buscar un reporte/);
  assert.match(html, /Universidad Corporativa Coppel/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("builds the collection-scoped Macintosh Studio editor", async () => {
  const html = await builtPage("studio.html");
  assert.match(html, /Studio · Macintosh Studio/);
  assert.match(html, /header-section-title[^>]*>Studio/);
  assert.match(html, /Todos los reportes/);
  assert.match(html, /Buscar un reporte/);
  assert.match(html, />Plantilla</i);
  assert.match(html, /Composición compartida de la colección/i);
  assert.match(html, /Capacitación especializada/i);
  assert.doesNotMatch(html, /5 capítulos/i);
  assert.doesNotMatch(html, /Abrir plantilla/);
});
