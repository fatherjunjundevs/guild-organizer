// Owned HTTP dependent only. No CLI discovery, network creation, image pulls or builds.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { ownedDocker, inspectOwnedContainer, localTarget, verifyTarget, recoverIsolatedCluster, safeError } from "./isolated-postgres-test-cluster.mjs";
import { httpImagePins } from "./postgrest-http-image.mjs";
import { verifyHttpPins, verifyHttpRecord, verifyHttpContainer, httpLabels, runtimeTmpfs, httpFail, exactKeys } from "./postgrest-http-contract.mjs";

export function httpSourceHash() {
  const hash = createHash("sha256");
  for (const name of ["docker/postgrest-http/Dockerfile", "docker/postgrest-http/harness.mjs", "postgrest-http-contract.mjs"]) {
    hash.update(name + "\0"); hash.update(readFileSync(new URL(name, import.meta.url))); hash.update("\0");
  }
  return hash.digest("hex");
}
/** @param {import('./postgrest-http-contract.mjs').HttpPins|null} pins */
export function verifyLocalHttpImage(pins = httpImagePins) {
  verifyHttpPins(pins);
  const target = localTarget();
  if (pins.sourceSha256 !== httpSourceHash()) httpFail("HTTP harness source differs from reviewed image provenance");
  const info = JSON.parse(ownedDocker(["image", "inspect", pins.imageDigest, "--format", '{"id":{{json .Id}},"digests":{{json .RepoDigests}},"labels":{{json .Config.Labels}}}']));
  // A locally built harness may be addressed by its immutable image config ID;
  // official base images still require registry manifest digest references.
  if (info.id !== pins.imageId || (pins.imageDigest!==pins.imageId && !info.digests?.includes(pins.imageDigest))
    || info.labels?.["go.http.source"] !== pins.sourceSha256
    || info.labels?.["go.http.postgrest.version"] !== pins.postgrestVersion
    || info.labels?.["go.http.postgrest.sha256"] !== pins.postgrestSha256
    || info.labels?.["go.http.postgrest.image"] !== pins.postgrestImage
    || info.labels?.["go.http.node.image"] !== pins.nodeImage) httpFail("HTTP image provenance mismatch; no fallback attempted");
  return target;
}
export function httpCreateArgs(parent) {
  const h = verifyHttpRecord(parent);
  return ["create", "--name", h.containerName, ...Object.entries(httpLabels(parent)).flatMap(([k,v]) => ["--label",`${k}=${v}`]),
    "--network", `container:${h.pgContainerId}`, "--restart", "no", "--ipc", "private", "--read-only",
    "--user", "10001:10001", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--memory", "512m", "--cpus", "1", "--pids-limit", "64", "--log-driver", "none",
    "--tmpfs", `/run/go-http:${runtimeTmpfs}`, "--interactive", h.pins.imageDigest];
}
export function reconcileHttpCreation(cluster) {
  const h = verifyHttpRecord(cluster.record);
  if (h.containerId) return;
  if (h.phase !== "submitted") httpFail("HTTP creation reconciliation lacks submission intent");
  cluster.verifyDatabase();
  const ids = ownedDocker(["ps", "-a", "--no-trunc", "--filter", `label=go.test.run=${cluster.record.runId}`,
    "--filter", "label=go.test.kind=isolated-postgrest-v1", "--format", "{{.ID}}"])
    .trim().split(/\s+/).filter(Boolean);
  if (ids.length !== 1) httpFail("HTTP creation remains missing or ambiguous; evidence retained");
  const c = verifyHttpContainer(cluster.record, inspectOwnedContainer(ids[0]));
  cluster.update({http:{...h,containerId:c.id,createdAt:c.created,phase:"created"}});
}
export async function cleanupHttpDependent(cluster) {
  const h = verifyHttpRecord(cluster.record);
  if (h.phase === "planned") {
    cluster.update({http:{...h,phase:"removed"}}); return;
  }
  if (h.phase === "removed") {
    if (h.containerId && inspectOwnedContainer(h.containerId)) httpFail("Removed HTTP dependent still exists");
    return;
  }
  reconcileHttpCreation(cluster);
  const next = cluster.record.http;
  const c = inspectOwnedContainer(next.containerId);
  if (!c) {
    if (next.phase !== "removing") httpFail("HTTP container disappeared without removal intent");
    cluster.update({http:{...next,phase:"removed"}}); return;
  }
  // Verify parent identity even during interrupted removal, while it still exists.
  cluster.verifyDatabase();
  verifyHttpContainer(cluster.record,c);
  if (cluster.httpService) {
    try { await cluster.httpService.close(); }
    catch { /* Exact verified Docker stop below must still prove closure. */ }
  }
  cluster.update({http:{...cluster.record.http,phase:"removing"}});
  cluster.verifyDatabase();
  verifyHttpContainer(cluster.record,inspectOwnedContainer(next.containerId));
  // Stop closes all owned requests/processes even when the coordinator was killed.
  ownedDocker(["stop","--time","5",next.containerId],undefined,false,15_000);
  const stopped=verifyHttpContainer(cluster.record,inspectOwnedContainer(next.containerId));
  if(!["created","exited"].includes(stopped.state))httpFail("HTTP process closure could not be verified");
  if (cluster.httpService) cluster.httpService.removeContainer();
  else ownedDocker(["rm",next.containerId],undefined,false,15_000);
  if (inspectOwnedContainer(next.containerId)) httpFail("HTTP removal could not be verified");
  cluster.update({http:{...cluster.record.http,phase:"removed"}});
  cluster.httpService = null;
}

export class HttpService {
  constructor(cluster) { this.cluster=cluster; this.child=null; this.pending=new Map(); this.buffer=""; this.bytes=0; this.closed=false; }
  verify() {
    this.cluster.verifyDatabase();
    verifyTarget(this.cluster.record.target,verifyLocalHttpImage(this.cluster.record.http.pins));
    return verifyHttpContainer(this.cluster.record,inspectOwnedContainer(this.cluster.record.http.containerId));
  }
  rejectPending() {
    for (const {reject,timer} of this.pending.values()) { clearTimeout(timer); reject(new Error("HTTP harness transport failed; diagnostics suppressed")); }
    this.pending.clear();
  }
  consume(chunk) {
    this.bytes += chunk.length;
    if (this.bytes > 1024*1024 || this.buffer.length + chunk.length > 65536) { this.rejectPending(); this.child.kill(); return; }
    this.buffer += chunk.toString("utf8");
    while (this.buffer.includes("\n")) {
      const end=this.buffer.indexOf("\n"), line=this.buffer.slice(0,end); this.buffer=this.buffer.slice(end+1);
      let row;
      try { row=JSON.parse(line); } catch { this.rejectPending(); this.child.kill(); return; }
      const pending=row && typeof row==="object" ? this.pending.get(row.id) : null;
      if (!exactKeys(row,["id","ok","result"]) || !/^[a-f0-9]{32}$/.test(row.id) || typeof row.ok !== "boolean" || !pending
        || (row.ok && (!exactKeys(row.result,["status","code","backendPid"]) || !Number.isInteger(row.result.status)
          || row.result.status < 0 || row.result.status > 599 || (row.result.code !== null && !/^(42501|PGRST\d{3})$/.test(row.result.code))
          || (row.result.backendPid !== null && (!Number.isInteger(row.result.backendPid) || row.result.backendPid < 1))))) {
        this.rejectPending(); this.child.kill(); return;
      }
      clearTimeout(pending.timer); this.pending.delete(row.id);
      if (row.ok) pending.resolve(row.result); else pending.reject(new Error("HTTP harness assertion failed; sensitive details suppressed"));
    }
  }
  command(command, timeout=15_000) {
    if (!this.child || this.closed || this.pending.size >= 32) return Promise.reject(new Error("HTTP harness is unavailable or at its request bound"));
    const id=randomBytes(16).toString("hex");
    const line=JSON.stringify({...command,id})+"\n";
    if (Buffer.byteLength(line)>65536) return Promise.reject(new Error("HTTP command exceeds its bound"));
    return new Promise((resolve,reject) => {
      const timer=setTimeout(() => { this.pending.delete(id); reject(new Error("HTTP harness command deadline exceeded")); },timeout);
      this.pending.set(id,{resolve,reject,timer});
      this.child.stdin.write(line,error => { if (error) this.rejectPending(); });
    });
  }
  async start(credentials) {
    this.verify();
    this.cluster.update({http:{...this.cluster.record.http,phase:"starting"}});
    this.child=spawn("docker",["start","--attach","--interactive",this.cluster.record.http.containerId],
      {stdio:["pipe","pipe","pipe"],windowsHide:true});
    this.child.stdout.on("data",chunk=>this.consume(chunk));
    // Docker stderr and raw child diagnostics never become console/artifacts.
    let errorBytes=0;
    this.child.stderr.on("data",chunk=>{ errorBytes+=chunk.length; if(errorBytes>65536) {this.rejectPending();this.child.kill();} });
    this.child.on("error",()=>this.rejectPending()); this.child.on("exit",()=>this.rejectPending());
    this.child.stdin.on("error",()=>this.rejectPending());
    await this.command({op:"init",database:this.cluster.record.database,pins:this.cluster.record.http.pins,...credentials},60_000);
    this.verify(); this.cluster.update({http:{...this.cluster.record.http,phase:"ready"}});
    return this;
  }
  request(command) { this.verify(); return this.command({op:"request",...command}); }
  requestBatch(commands) {
    this.verify();
    if(!Array.isArray(commands)||commands.length<1||commands.length>16)httpFail("Invalid bounded HTTP batch");
    // Verify once, then dispatch together. Repeated synchronous Docker inspection
    // between commands would serialize what is meant to exercise the pool.
    return Promise.all(commands.map(command=>this.command({op:"request",...command})));
  }
  async restart() { this.verify(); return this.command({op:"restart"},60_000); }
  removeContainer() {
    this.cluster.verifyDatabase();
    verifyHttpContainer(this.cluster.record,inspectOwnedContainer(this.cluster.record.http.containerId));
    ownedDocker(["rm",this.cluster.record.http.containerId],undefined,false,15_000);
  }
  async close() {
    if (!this.child || this.closed) return;
    try { await this.command({op:"stop"},10_000); }
    finally { this.closed=true; this.child.stdin.end(); this.child.kill(); this.rejectPending(); }
  }
}
export async function createHttpService(cluster) {
  const target=verifyLocalHttpImage();
  cluster.verifyDatabase(); verifyTarget(cluster.record.target,target);
  if (cluster.record.version!==1 || cluster.record.phase!=="ready" || cluster.record.startupProfile!=="http-private-v1") httpFail("HTTP registration requires a ready privacy-profile cluster without dependents");
  cluster.update({version:2,http:{phase:"planned",containerName:`go-security-http-${cluster.record.runId}`,containerId:null,createdAt:null,
    intentAt:new Date().toISOString(),pgContainerId:cluster.record.containerId,identity:{...cluster.record.identity},pins:{...httpImagePins}}});
  const names=ownedDocker(["ps","-a","--format","{{.Names}}"]);
  if(names.trim().split(/\s+/).includes(cluster.record.http.containerName)) httpFail("HTTP container name collision; no adoption permitted");
  cluster.update({http:{...cluster.record.http,phase:"submitted"}});
  cluster.verifyDatabase();
  const id=ownedDocker(httpCreateArgs(cluster.record)).trim();
  const c=verifyHttpContainer(cluster.record,inspectOwnedContainer(id));
  cluster.update({http:{...cluster.record.http,containerId:c.id,createdAt:c.created,phase:"created"}});
  const service=new HttpService(cluster); cluster.httpService=service; return service;
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if(process.argv.length!==4 || process.argv[2]!=="recover") httpFail("Usage: HTTP recovery requires one exact run ID");
    // Parent recovery is the coordinator for both manifest versions and orders cleanup.
    await recoverIsolatedCluster(process.argv[3]); console.log("Verified exact isolated run removed");
  } catch(error) {console.error(safeError(error));process.exitCode=1;}
}
