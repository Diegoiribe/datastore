import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const filename of [".env.local", ".env"]) {
  try { process.loadEnvFile(path.join(root, filename)); } catch { /* Optional local configuration. */ }
}
const isWindows = process.platform === "win32";
const vinext = path.join(root, "node_modules", ".bin", isWindows ? "vinext.cmd" : "vinext");
const ngrok = process.env.NGROK_BIN || (isWindows ? "ngrok.exe" : "ngrok");
const macintoshApi = new URL(process.env.MACINTOSH_API_URL || "http://127.0.0.1:8010");
const studioToken = process.env.MACINTOSH_STUDIO_TOKEN || "";
const trafficPolicy = path.join(root, "ngrok-traffic-policy.yml");
const children = new Set();
let gateway;
let closing = false;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitFor(url, timeout = 45_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if ((response.statusCode || 500) < 500) resolve();
        else retry();
      });
      request.on("error", retry);
    };
    const retry = () => {
      if (Date.now() - startedAt >= timeout) reject(new Error("Macintosh Studio tardó demasiado en iniciar."));
      else setTimeout(check, 350);
    };
    check();
  });
}

async function existingStudioPort() {
  try {
    const lock = JSON.parse(await readFile(path.join(root, ".vinext", "dev", "lock.json"), "utf8"));
    const port = Number(lock.port);
    if (path.resolve(String(lock.cwd || "")) !== root || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    await waitFor(`http://127.0.0.1:${port}/studio`, 2_500);
    return port;
  } catch {
    return null;
  }
}

function proxyRequest(request, response, appPort) {
  const url = new URL(request.url || "/", "http://studio.local");
  const isMacintoshApi = url.pathname === "/api/macintosh" || url.pathname.startsWith("/api/macintosh/");
  if (isMacintoshApi) {
    const apiPath = `${url.pathname.slice("/api/macintosh".length) || "/"}${url.search}`;
    const studioCopy = /^\/api\/studio\/reports\/[a-z0-9_]+\/copy$/.test(apiPath.split("?")[0]);
    const allowed = (request.method === "GET" || request.method === "PUT") && studioCopy;
    if (!allowed) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ detail: "Esta operación no está disponible desde Studio." }));
      return;
    }
    if (request.method === "PUT" && !studioToken) {
      response.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ detail: "Configura la clave privada compartida antes de editar mediante el enlace." }));
      return;
    }
    const upstreamHeaders = {
      accept: "application/json",
      ...(request.headers["content-type"] ? { "content-type": request.headers["content-type"] } : {}),
      ...(request.headers["content-length"] ? { "content-length": request.headers["content-length"] } : {}),
      ...(request.method === "PUT" ? { "x-macintosh-studio-token": studioToken } : {}),
      host: macintoshApi.host,
    };
    const upstream = http.request({
      hostname: macintoshApi.hostname,
      port: macintoshApi.port || 80,
      path: apiPath,
      method: request.method,
      headers: upstreamHeaders,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ detail: "Macintosh no está disponible." }));
    });
    request.pipe(upstream);
    return;
  }
  const acceptsHtml = String(request.headers.accept || "").includes("text/html");
  if (url.pathname === "/") {
    response.writeHead(302, { location: "/studio", "cache-control": "no-store" });
    response.end();
    return;
  }
  if (acceptsHtml && url.pathname !== "/studio" && !url.pathname.startsWith("/studio/")) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Este acceso comparte únicamente Macintosh Studio.");
    return;
  }

  const upstream = http.request({
    hostname: "127.0.0.1",
    port: appPort,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `127.0.0.1:${appPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Macintosh Studio no está disponible.");
  });
  request.pipe(upstream);
}

function writeNgrokOutput(stream, chunk) {
  const safe = String(chunk).replace(/(Your authtoken:\s*)\S+/gi, "$1[REDACTED]");
  stream.write(safe);
}

async function close(exitCode = 0) {
  if (closing) return;
  closing = true;
  gateway?.close();
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(exitCode), 250).unref();
}

process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());

try {
  const runningStudioPort = await existingStudioPort();
  const appPort = runningStudioPort ?? await freePort();
  const gatewayPort = await freePort();
  try {
    await waitFor(new URL("/api/health", macintoshApi).toString(), 5_000);
  } catch {
    throw new Error("Inicia Macintosh antes de compartir Studio; Macintosh es ahora su fuente de datos.");
  }
  if (runningStudioPort) {
    console.log(`Reutilizando Macintosh Studio en http://127.0.0.1:${appPort}.`);
  } else {
    const app = spawn(vinext, ["dev", "--host", "127.0.0.1", "--port", String(appPort)], {
      cwd: root,
      env: { ...process.env, BROWSER: "none", NEXT_PUBLIC_MACINTOSH_API_URL: "/api/macintosh" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(app);
    app.stdout.on("data", (chunk) => process.stdout.write(chunk));
    app.stderr.on("data", (chunk) => process.stderr.write(chunk));
    app.once("exit", (code) => {
      children.delete(app);
      if (!closing) {
        console.error("\nMacintosh Studio se cerró antes que el enlace compartido.");
        void close(code || 1);
      }
    });
    await waitFor(`http://127.0.0.1:${appPort}/studio`);
  }
  gateway = http.createServer((request, response) => proxyRequest(request, response, appPort));
  await new Promise((resolve, reject) => {
    gateway.once("error", reject);
    gateway.listen(gatewayPort, "127.0.0.1", resolve);
  });

  console.log(`\nMacintosh Studio local: http://127.0.0.1:${gatewayPort}/studio`);
  console.log("Abriendo enlace temporal de Studio. Ctrl+C cierra el enlace y el editor.\n");

  const tunnel = spawn(ngrok, ["http", `http://127.0.0.1:${gatewayPort}`, "--traffic-policy-file", trafficPolicy], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(tunnel);
  tunnel.stdout.on("data", (chunk) => writeNgrokOutput(process.stdout, chunk));
  tunnel.stderr.on("data", (chunk) => writeNgrokOutput(process.stderr, chunk));
  tunnel.once("error", (error) => {
    console.error(`No pudimos iniciar ngrok: ${error.message}`);
    console.error("Instala ngrok, autoriza tu cuenta y vuelve a ejecutar npm run studio:share.");
    void close(1);
  });
  tunnel.once("exit", (code) => {
    children.delete(tunnel);
    if (!closing) void close(code || 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await close(1);
}
