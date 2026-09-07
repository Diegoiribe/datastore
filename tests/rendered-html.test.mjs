import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Macintosh Studio report library", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Macintosh Studio · Reportes<\/title>/i);
  assert.match(html, /Todos los reportes/);
  assert.match(html, /Buscar un reporte/);
  assert.match(html, /Universidad Corporativa Coppel/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("renders the Macintosh Studio editor", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("studio-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/studio", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Studio · Macintosh Studio/);
  assert.match(html, /header-section-title[^>]*>Studio</);
  assert.match(html, /Todos los reportes/);
  assert.match(html, /Buscar un reporte/);
  assert.doesNotMatch(html, /Abrir plantilla/);
});
