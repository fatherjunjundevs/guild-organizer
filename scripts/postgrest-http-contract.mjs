// Pure, test-only contracts shared by the host coordinator and container harness.
import { createHmac } from "node:crypto";

export const runtimeTmpfs = "rw,noexec,nosuid,nodev,size=16777216,uid=10001,gid=10001,mode=0700";
export const httpStages = ["planned", "submitted", "created", "starting", "ready", "removing", "removed"];
export function httpFail(message) { const error = new Error(message); error.safe = true; throw error; }
export function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
const sha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const digest = value => typeof value === "string" && /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(value);
/** @typedef {{imageDigest:string,imageId:string,postgrestImage:string,nodeImage:string,postgrestVersion:string,postgrestSha256:string,sourceSha256:string}} HttpPins */
export function verifyHttpPins(pins) {
  if (!exactKeys(pins, ["imageDigest", "imageId", "postgrestImage", "nodeImage", "postgrestVersion", "postgrestSha256", "sourceSha256"])
    || !(digest(pins.imageDigest) || pins.imageDigest === pins.imageId) || !/^sha256:[a-f0-9]{64}$/.test(pins.imageId)
    || !digest(pins.postgrestImage) || !digest(pins.nodeImage)
    || !/^\d{1,2}\.\d{1,3}$/.test(pins.postgrestVersion)
    || !sha(pins.postgrestSha256) || !sha(pins.sourceSha256)) {
    httpFail("Verified PostgREST image/binary provenance unavailable; no HTTP resources created");
  }
  return pins;
}
export function verifyHttpRecord(parent) {
  const h = parent.http;
  if (!exactKeys(h, ["phase", "containerName", "containerId", "createdAt", "intentAt", "pgContainerId", "identity", "pins"])
    || !httpStages.includes(h.phase) || h.containerName !== `go-security-http-${parent.runId}`
    || !sha(h.pgContainerId) || h.pgContainerId !== parent.containerId
    || !Number.isFinite(Date.parse(h.intentAt))
    || (h.containerId !== null && !sha(h.containerId))
    || (h.createdAt !== null && !Number.isFinite(Date.parse(h.createdAt)))
    || ((h.containerId === null) !== (h.createdAt === null))
    || (["planned","submitted"].includes(h.phase) && h.containerId !== null)
    || !exactKeys(h.identity, ["systemId", "databaseOid"])
    || h.identity.systemId !== parent.identity?.systemId || h.identity.databaseOid !== parent.identity?.databaseOid
    || (!['planned', 'submitted', 'removed'].includes(h.phase) && (!h.containerId || !h.createdAt))) {
    httpFail("Invalid HTTP dependent ownership evidence; PostgreSQL cleanup refused");
  }
  verifyHttpPins(h.pins);
  return h;
}
export function httpLabels(parent) {
  const h = verifyHttpRecord(parent);
  return { "go.test.kind": "isolated-postgrest-v1", "go.test.run": parent.runId,
    "go.test.repo": parent.repoId, "go.test.intent": h.intentAt, "go.test.parent": h.pgContainerId };
}
export function verifyHttpContainer(parent, c) {
  const h = verifyHttpRecord(parent), host = c?.host;
  if (!c || !sha(c.id) || c.name !== `/${h.containerName}`
    || (h.containerId && c.id !== h.containerId) || (h.createdAt && c.created !== h.createdAt)
    || !Number.isFinite(Date.parse(c.created)) || Date.parse(c.created) < Date.parse(h.intentAt) - 1000
    || c.image !== h.pins.imageId || c.configImage !== h.pins.imageDigest
    || !c.labels || Object.keys(c.labels).some(k => k.startsWith('com.supabase.cli.'))
    || Object.entries(httpLabels(parent)).some(([k,v]) => c.labels[k] !== v)
    || c.user !== "10001:10001" || c.workingDir !== "/opt/go-http"
    || JSON.stringify(c.entrypoint) !== JSON.stringify(["node", "/opt/go-http/scripts/docker/postgrest-http/harness.mjs"])
    || (c.cmd?.length ?? 0) !== 0 || !c.openStdin || c.tty
    || !Array.isArray(c.env) || c.env.some(e => !/^(PATH|NODE_VERSION|YARN_VERSION)=/.test(e))
    || !host || host.NetworkMode !== `container:${h.pgContainerId}` || host.Privileged || host.AutoRemove
    || !host.ReadonlyRootfs || host.PidMode || host.IpcMode !== "private" || host.RestartPolicy?.Name !== "no"
    || host.Memory !== 512 * 1024 ** 2 || host.NanoCpus !== 10 ** 9 || host.PidsLimit !== 64
    || host.LogConfig?.Type !== "none" || Object.keys(host.LogConfig.Config ?? {}).length !== 0
    || JSON.stringify(host.CapDrop) !== JSON.stringify(["ALL"]) || (host.CapAdd?.length ?? 0) !== 0
    || !["no-new-privileges", "no-new-privileges:true"].some(o => JSON.stringify(host.SecurityOpt) === JSON.stringify([o]))
    || (host.Binds?.length ?? 0) !== 0 || (host.Mounts?.length ?? 0) !== 0
    || (host.Devices?.length ?? 0) !== 0 || (host.DeviceRequests?.length ?? 0) !== 0
    || Object.keys(host.PortBindings ?? {}).length !== 0 || Object.values(c.ports ?? {}).some(v => v !== null)
    || Object.keys(host.Tmpfs ?? {}).length !== 1 || host.Tmpfs["/run/go-http"] !== runtimeTmpfs
    || (c.mounts ?? []).some(m => m.Type !== "tmpfs" || m.Destination !== "/run/go-http")) {
    httpFail("HTTP container ownership/isolation mismatch; operation refused");
  }
  return c;
}
/** @param {Buffer} key @param {string} role @param {string|null} sub @param {number} now */
export function signTestJwt(key, role, sub = null, now = Math.floor(Date.now()/1000)) {
  if (!Buffer.isBuffer(key) || key.length !== 32 || !["anon", "authenticated", "service_role", "go_event_share_resolver"].includes(role)
    || (sub !== null && !/^[a-f0-9-]{36}$/.test(sub)) || !Number.isSafeInteger(now)) httpFail("Invalid synthetic JWT input");
  const head = Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
  const body = Buffer.from(JSON.stringify({role, ...(sub ? {sub} : {}), aud:"go-http-test",iat:now,nbf:now-1,exp:now+120})).toString("base64url");
  const data = `${head}.${body}`;
  return `${data}.${createHmac("sha256",key).update(data).digest("base64url")}`;
}
export function assertNoSensitiveOutput(text, values) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 1024 * 1024) httpFail("HTTP diagnostic output exceeds its bound");
  for (const value of values) {
    if (typeof value !== "string" || value.length < 8) continue;
    const variants = [value, encodeURIComponent(value), Buffer.from(value).toString("base64"), Buffer.from(value).toString("hex")];
    if (variants.some(v => text.includes(v))) httpFail("Sensitive HTTP diagnostic output suppressed");
  }
}
export function assertHttpResponse(response, expected) {
  // Never throw assertion-library diffs containing response bodies or input tokens.
  const { status, headers, body } = response;
  if (status !== expected.status || typeof body !== "string" || Buffer.byteLength(body) > 65536) httpFail("Unexpected HTTP status/body boundary");
  const code = headers["proxy-status"]?.match(/^PostgREST; error=([A-Z0-9]+)$/)?.[1] ?? null;
  if (expected.kind === "denied") {
    if (code !== "42501") httpFail("HTTP denial lacks PostgreSQL permission evidence");
    if (expected.method === "HEAD") {
      if (body !== "") httpFail("HEAD denial returned a body");
    } else {
      let value; try { value = JSON.parse(body); } catch { httpFail("HTTP denial is not a PostgreSQL JSON error"); }
      if (value.code !== "42501" || value.message !== "permission denied for function resolve_event_share_link"
        || value.details != null || value.hint != null) httpFail("HTTP denial did not originate from resolver EXECUTE permissions");
    }
  } else if (expected.kind === "error") {
    if (code !== expected.code) httpFail("Unexpected parser/authentication error classification");
  } else if (expected.kind === "identity") {
    let rows; try { rows = JSON.parse(body); } catch { httpFail("Identity control is not JSON"); }
    if (!Array.isArray(rows) || rows.length !== 1) httpFail("Identity control row count mismatch");
    const r = rows[0];
    if (!exactKeys(r,["session_user", "request_role", "uid", "backend_pid", "logging_safe"])
      || r.session_user !== "authenticator" || r.request_role !== expected.role || r.uid !== expected.uid
      || !Number.isInteger(r.backend_pid) || r.backend_pid < 1 || r.logging_safe !== true) httpFail("Pooled HTTP role/claim/logging control failed");
    return {status, code:null, backendPid:r.backend_pid};
  } else if (expected.kind === "projection") {
    if (expected.method === "HEAD") { if (body !== "") httpFail("HEAD control returned a body"); }
    else {
      let rows; try { rows=JSON.parse(body); } catch { httpFail("Resolver control is not JSON"); }
      if (!Array.isArray(rows) || rows.length !== 1 || !exactKeys(rows[0],["event_name","event_type_name","version_number","published_at"])
        || rows[0].event_name !== expected.eventName || rows[0].event_type_name !== "HTTP League" || rows[0].version_number !== expected.version
        || !Number.isFinite(Date.parse(rows[0].published_at))) httpFail("Resolver projection/privacy control failed");
    }
  } else if (expected.kind === "empty") {
    if (body !== "[]") httpFail("Unavailable resolver control returned data");
  } else if (expected.kind === "cache") {
    if (body !== String(expected.generation)) httpFail("Schema cache generation control failed");
  } else if (expected.kind === "management") {
    let rows; try { rows=JSON.parse(body); } catch { httpFail("Management control is not JSON"); }
    if (!Array.isArray(rows) || rows.length!==1 || !exactKeys(rows[0],["state","link_id","created_at","available"])
      || rows[0].state!==expected.state || rows[0].link_id!==null || rows[0].created_at!==null || rows[0].available!==false) httpFail("Management authorization/state control failed");
  } else httpFail("Unregistered HTTP response assertion");
  return {status,code,backendPid:null};
}
