// Executes only in the verified, network-isolated reviewed Node sidecar.
// Secrets arrive on stdin; responses contain allowlisted boolean/count evidence.
import { createServer as httpServer, request as httpRequest } from "node:http";
import { createServer as tcpServer } from "node:net";
import { createInterface } from "node:readline";
import { Pool } from "pg";
import { assertNoSensitiveOutput } from "./postgrest-http-contract.mjs";

let route, config, server, mode = "allowed", secrets = [], logs = "";
const pools = new Set(), sockets = new Set();
let identities = 0, projections = 0, assertions = 0, sqlDenials = 0, statementTimeouts = 0;
const originalConnect = Pool.prototype.connect;
Pool.prototype.connect = async function (...args) {
  pools.add(this);
  const client = await originalConnect.apply(this, args);
  if (!client.goInspected) {
    client.goInspected = true; const query = client.query;
    client.query = function (text, ...values) {
      if (typeof text === "string" && text.includes(" as safe") && text.includes("connection_private()")) identities++;
      if (typeof text === "string" && text.includes("resolve_lineup($1")) projections++;
      return query.call(this, text, ...values).catch(error => {
        if (error.code === "42501") sqlDenials++;
        if (error.code === "57014") statementTimeouts++;
        throw error;
      });
    };
  }
  return client;
};
for (const name of ["log", "error", "warn", "info", "debug"]) console[name] = (...values) => {
  logs += values.map(String).join(" ") + "\n";
  if (Buffer.byteLength(logs) > 65536) throw new Error("Log bound");
};
function check(value) { assertions++; if (!value) throw new Error("Assertion failed"); }
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) !== "https://admission.invalid") throw new Error("Unexpected network destination");
  const body = String(options.body); check(!secrets.some(s => s.length > 8 && body.includes(s)));
  if (mode === "failure") throw new Error("PRIVATE_TRANSPORT_ERROR");
  return Response.json({ result: mode === "limited" ? 0 : mode === "unknown" ? "1" : 1 });
};
async function request(command) {
  const body = JSON.stringify({ token: command.token, version: command.version ?? null, page: command.page ?? 0, search: command.search ?? "",
    ...(command.guildId ? { guildId: command.guildId } : {}) });
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port: 3100, path: command.query ? "/api/share/event?token=redacted" : "/api/share/event",
      method: command.method ?? "POST", headers: { origin: config.origin, "sec-fetch-site": "same-origin", "content-type": "application/json",
        "x-go-proxy-key": command.untrusted ? "0".repeat(64) : config.proxyKey().toString("hex"), "x-go-client-ip": "127.0.0.1" } }, res => {
      let data = ""; res.on("data", chunk => { data += chunk; if (Buffer.byteLength(data) > 262144) req.destroy(); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on("error", () => command.cancel ? resolve({ cancelled: true }) : reject(new Error("HTTP transport failed")));
    req.setTimeout(10000, () => req.destroy());
    if (["GET", "HEAD"].includes(command.method)) req.end(); else req.end(body);
    if (command.cancel) setTimeout(() => req.destroy(), 250);
  });
}
async function initialize(command) {
  secrets = command.secrets;
  Object.assign(process.env, command.env);
  const { readPublicEventConfig } = await import("../src/features/events/public-event-config.js");
  config = readPublicEventConfig(); check(Boolean(config));
  route = await import("../src/app/api/share/event/route.js");
  check(route.runtime === "nodejs" && route.dynamic === "force-dynamic");
  server = httpServer(async (req, res) => {
    const abort = new AbortController(); req.on("aborted", () => abort.abort());
    res.on("close", () => { if (!res.writableEnded) abort.abort(); });
    try {
      const request = new Request(config.origin + req.url, { method: req.method, headers: req.headers,
        ...(req.method !== "GET" && req.method !== "HEAD" ? { body: req, duplex: "half" } : {}), signal: abort.signal });
      const response = await route[req.method](request);
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(503); res.end(); }
  });
  await new Promise(resolve => server.listen(3100, "127.0.0.1", resolve));
  return { ready: true };
}
async function execute(command) {
  if (command.op === "init") return initialize(command);
  if (!route) throw new Error("Missing initialization");
  if (command.op === "http") {
    mode = command.admission ?? "allowed";
    const before = projections;
    const response = await request(command);
    if (command.cancel) { check(response.cancelled === true); return { cancelled: true }; }
    check(response.status === command.status);
    if (command.noDatabase) check(projections === before);
    check(response.headers["cache-control"] === "no-store, max-age=0" && response.headers["referrer-policy"] === "no-referrer"
      && response.headers["x-robots-tag"].includes("noindex"));
    if (command.method !== "HEAD") {
      assertNoSensitiveOutput(response.data, secrets);
      const data = JSON.parse(response.data);
      if (command.display) {
        check(data.status === command.display);
        if (command.display === "ready") {
          check(data.eventName === command.eventName && data.version === command.versionExpected
            && (command.empty ? data.cards.length === 0 : data.cards[0].slots[0].ign === "Published Hero"));
          if (!command.empty) check(!response.data.includes("Unrelated"));
        }
      } else check(data.status === "unavailable");
    }
    return { status: response.status };
  }
  if (command.op === "parallel") {
    mode = "allowed";
    const results = await Promise.all([request(command), request(command)]);
    check(results.every(r => r.status === 200)); return { backends: pools.size, responses: 2 };
  }
  if (command.op === "transport") {
    const { PublicEventConfig, publicPoolOptions } = await import("../src/features/events/public-event-config.js");
    let failure = false, elapsed = 0, listener;
    const options = publicPoolOptions(config);
    if (command.kind === "connect") {
      listener = tcpServer(socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
      await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve)); options.port = listener.address().port;
    } else if (command.kind === "tls") options.ssl = publicPoolOptions(new PublicEventConfig(config.origin, config.host, config.port,
      config.database, undefined, undefined, config.redisUrl, config.databasePassword(), config.admissionCredential(), config.proxyKey(), config.admissionKey())).ssl;
    else if (command.kind === "password") options.password = "0".repeat(64);
    const pool = new Pool(options); pool.on("error", () => {});
    let client; const start = performance.now();
    try { client = await pool.connect();
      if (command.kind === "query") { await client.query("set statement_timeout=0"); await client.query("select pg_catalog.pg_sleep(10)"); }
    } catch (error) {
      elapsed = performance.now() - start;
      if (command.kind === "password") failure = error.code === "28P01";
      if (command.kind === "tls") failure = ["ERR_TLS_CERT_ALTNAME_INVALID", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT",
        "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(error.code) || error.message === "The server does not support SSL connections";
      if (command.kind === "connect") failure = ["Connection terminated due to connection timeout", "timeout exceeded when trying to connect"].includes(error.message);
      if (command.kind === "query") failure = error.message === "Query read timeout";
    }
    finally { client?.release(true); await pool.end(); for (const socket of sockets) socket.destroy(); if (listener) await new Promise(resolve => listener.close(resolve)); }
    check(failure);
    if (command.kind === "connect") check(elapsed >= 1700 && elapsed < 5000);
    if (command.kind === "query") check(elapsed >= 2700 && elapsed < 6000);
    return { rejected: true };
  }
  if (command.op === "end") {
    await new Promise(resolve => server.close(resolve));
    await Promise.all([...pools].filter(pool => !pool.ending).map(pool => pool.end()));
    check(identities >= projections && projections > 0 && sqlDenials >= 1 && statementTimeouts >= 1); assertNoSensitiveOutput(logs, secrets);
    check(logs.length === 0); globalThis.fetch = fetchOriginal;
    return { assertions, identities, projections, sqlDenials, statementTimeouts, logBytes: Buffer.byteLength(logs) };
  }
  throw new Error("Unknown operation");
}
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  let command;
  try {
    if (Buffer.byteLength(line) > 16384) throw new Error("Input bound"); command = JSON.parse(line);
    const result = await execute(command); process.stdout.write(JSON.stringify({ id: command.id, ok: true, result }) + "\n");
    if (command.op === "end") break;
  } catch (error) {
    const category = ["TypeError", "SyntaxError", "ReferenceError"].includes(error?.name) ? error.name : "assertion-or-runtime";
    process.stdout.write(JSON.stringify({ id: command?.id, ok: false, assertion: assertions, category }) + "\n"); process.exitCode = 1; break;
  }
}
