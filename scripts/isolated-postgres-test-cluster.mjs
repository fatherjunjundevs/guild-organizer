// Local test infrastructure only. No Supabase CLI discovery, shared databases,
// application credentials, legacy manifests, or arbitrary Docker targets.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, realpathSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync,
  renameSync, unlinkSync, existsSync, lstatSync } from "node:fs";
import { createServer, createConnection } from "node:net";
import { homedir } from "node:os";
import { resolve, join, dirname, relative, isAbsolute, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const imageDigest = "public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9";
export const imageId = "sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9";
export const repositoryRoot = realpathSync(resolve(import.meta.dirname, ".."));
const repoId = createHash("sha256").update(repositoryRoot).digest("hex");
const stages = ["planned", "submitted", "created", "starting", "started", "ready", "removing", "removed"];
const sensitiveLogging = "set log_statement='none'; set log_min_error_statement='panic'; set log_parameter_max_length=0; set log_parameter_max_length_on_error=0;\n";
export const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
export function safeError(error) {
  // Never return raw Docker/psql stderr: it can echo SQL, credentials or tokens.
  return error?.safe === true ? error.message : "Isolated test operation failed; sensitive diagnostic details suppressed";
}
function fail(message) { const error = new Error(message); error.safe = true; throw error; }
function docker(args, input, allowFailure = false, timeout = 180_000) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true });
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    fail(`Isolated Docker ${args[0]} failed (details suppressed)`);
  }
  return result.stdout;
}
function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value, key));
}
export function verifyManifest(record) {
  if (!exactKeys(record, ["version", "runId", "repoRoot", "repoId", "target", "containerName", "containerId",
    "intentAt", "createdAt", "phase", "pid", "leasePort", "database", "marker", "identity"])
    || record.version !== 1 || !/^[a-f0-9]{32}$/.test(record.runId)
    || record.repoRoot !== repositoryRoot || record.repoId !== repoId
    || record.containerName !== `go-security-pg-${record.runId}`
    || record.database !== `go_share_test_${record.runId}` || record.marker !== `go-disposable:${record.runId}`
    || !stages.includes(record.phase) || !Number.isSafeInteger(record.pid) || record.pid < 1
    || !Number.isInteger(record.leasePort) || record.leasePort < 1 || record.leasePort > 65535
    || !Number.isFinite(Date.parse(record.intentAt))
    || (record.containerId !== null && !/^[a-f0-9]{64}$/.test(record.containerId))
    || (record.createdAt !== null && !Number.isFinite(Date.parse(record.createdAt)))
    || !exactKeys(record.target, ["context", "endpoint", "daemonId", "imageId", "imageDigest"])
    || !record.target.daemonId || record.target.imageId !== imageId || record.target.imageDigest !== imageDigest
    || (record.identity !== null && (!exactKeys(record.identity, ["systemId", "databaseOid"])
      || !/^[0-9]+$/.test(record.identity.systemId) || !/^[0-9]+$/.test(record.identity.databaseOid)))) {
    fail("Invalid isolated-cluster ownership manifest; recovery refused");
  }
  if (!["planned", "submitted", "removed"].includes(record.phase) && (!record.containerId || !record.createdAt)) {
    fail("Missing exact container creation evidence");
  }
  if (record.phase === "ready" && !record.identity) fail("Missing database identity");
  return record;
}
export function verifyTarget(expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) fail("Docker daemon/image identity changed; operation refused");
}
export function ownershipLabels(record) {
  return { "go.test.kind": "isolated-postgres-v1", "go.test.run": record.runId,
    "go.test.repo": record.repoId, "go.test.intent": record.intentAt };
}
export function verifyContainer(record, container) {
  verifyManifest(record);
  const labels = ownershipLabels(record);
  const host = container?.host;
  if (!container || !/^[a-f0-9]{64}$/.test(container.id) || container.name !== `/${record.containerName}`
    || (record.containerId && container.id !== record.containerId)
    || (record.createdAt && container.created !== record.createdAt)
    || Date.parse(container.created) < Date.parse(record.intentAt) - 1000
    || container.image !== imageId || container.configImage !== imageDigest
    || !container.labels || Object.keys(container.labels).some(key => key.startsWith("com.supabase.cli."))
    || Object.entries(labels).some(([key, value]) => container.labels[key] !== value)
    || !host || host.NetworkMode !== "none" || host.Privileged || host.AutoRemove
    || host.PidMode || host.IpcMode !== "private" || host.RestartPolicy?.Name !== "no"
    || host.Memory !== 2 * 1024 ** 3 || host.NanoCpus !== 2 * 10 ** 9
    || host.ShmSize !== 128 * 1024 ** 2 || (host.Binds?.length ?? 0) !== 0
    || Object.keys(host.PortBindings ?? {}).length !== 0 || (host.Mounts?.length ?? 0) !== 0
    || Object.keys(host.Tmpfs ?? {}).length !== 1
    || host.Tmpfs["/var/lib/postgresql/data"] !== "rw,noexec,nosuid,nodev,size=1073741824"
    || (container.mounts ?? []).some(m => m.Type !== "tmpfs" || m.Destination !== "/var/lib/postgresql/data")
    || Object.values(container.ports ?? {}).some(value => value !== null)) {
    fail("Container ownership/isolation mismatch; operation refused");
  }
  return container;
}
const inspectFormat = '{"id":{{json .Id}},"name":{{json .Name}},"created":{{json .Created}},"image":{{json .Image}},"configImage":{{json .Config.Image}},"labels":{{json .Config.Labels}},"host":{{json .HostConfig}},"mounts":{{json .Mounts}},"ports":{{json .NetworkSettings.Ports}},"state":{{json .State.Status}}}';
function inspect(id) {
  const output = docker(["inspect", "--type", "container", "--format", inspectFormat, id], undefined, true);
  if (output === null) {
    // An inspect failure is not proof of absence; require a successful exact-ID listing.
    const all = docker(["ps", "-a", "--no-trunc", "--format", "{{.ID}}"]);
    if (all.trim().split(/\s+/).includes(id)) fail("Owned container inspection failed");
    return null;
  }
  return JSON.parse(output);
}
export function localTarget() {
  if (["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"].some(name => process.env[name])) {
    fail("Docker environment overrides are unsupported; no resources created");
  }
  if (JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")).name !== "guild-organizer"
    || !/^project_id\s*=\s*"guild-organizer"/m.test(readFileSync(join(repositoryRoot, "supabase/config.toml"), "utf8"))) {
    fail("Repository identity mismatch");
  }
  const context = docker(["context", "show"]).trim();
  const endpoint = docker(["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"]).trim();
  if (!(endpoint === "npipe:////./pipe/dockerDesktopLinuxEngine" || endpoint === "unix:///var/run/docker.sock"
    || /^unix:\/\/\/[^\r\n]+\/\.docker\/desktop\/docker.sock$/.test(endpoint))) fail("Unsupported/nonlocal Docker endpoint");
  const info = JSON.parse(docker(["info", "--format", '{"ID":{{json .ID}},"OSType":{{json .OSType}}}']));
  if (info.OSType !== "linux" || !info.ID) fail("A local Linux Docker environment is required");
  const image = JSON.parse(docker(["image", "inspect", imageDigest, "--format", '{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']));
  if (image.id !== imageId || !image.digests.includes(imageDigest)) fail("Pinned PostgreSQL image is unavailable or incompatible; no fallback/pull attempted");
  return { context, endpoint, daemonId: info.ID, imageId, imageDigest };
}
export function verifyManifestDestination(base) {
  const actual = realpathSync(base);
  const inside = relative(repositoryRoot, actual);
  if (!inside || (!isAbsolute(inside) && inside !== ".." && !inside.startsWith(".." + sep))) fail("Manifest destination inside repository refused");
  if (actual.startsWith("\\\\")) fail("Nonlocal manifest destination refused");
  for (let directory = actual; ; directory = dirname(directory)) {
    if (existsSync(join(directory, ".git")) || (existsSync(join(directory, "HEAD")) && existsSync(join(directory, "objects")))) {
      fail("Manifest destination inside a Git checkout/bare repository refused");
    }
    if (dirname(directory) === directory) break;
  }
  return actual;
}
function protectedDirectory() {
  const base = process.platform === "win32" ? process.env.LOCALAPPDATA : join(homedir(), ".local", "state");
  if (!base) fail("Protected local manifest destination unavailable");
  const parent = join(verifyManifestDestination(base), "guild-organizer-isolated-postgres");
  const directory = join(parent, repoId);
  for (const path of [parent, directory]) {
    const fresh = !existsSync(path);
    if (fresh) mkdirSync(path, { mode: 0o700 });
    if (lstatSync(path).isSymbolicLink() || realpathSync(path) !== resolve(path)) fail("Manifest directory link refused");
    if (process.platform === "win32") {
      const user = spawnSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true });
      const sid = user.stdout?.match(/S-1-5-[0-9-]+/)?.[0];
      if (!sid) fail("Cannot verify manifest-directory owner");
      if (fresh) {
        const acl = spawnSync("icacls", [path, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { encoding: "utf8", windowsHide: true });
        if (acl.status !== 0) fail("Cannot protect manifest directory; no Docker creation permitted");
      }
      const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command",
        "$a=Get-Acl -LiteralPath $env:GO_TEST_MANIFEST_DIRECTORY; $s=[System.Security.Principal.SecurityIdentifier]; @{'owner'=([System.Security.Principal.NTAccount]$a.Owner).Translate($s).Value;'protected'=$a.AreAccessRulesProtected;'allow'=@($a.Access | Where-Object AccessControlType -eq Allow | ForEach-Object { $_.IdentityReference.Translate($s).Value })} | ConvertTo-Json -Compress"],
      { encoding: "utf8", windowsHide: true, env: { ...process.env, GO_TEST_MANIFEST_DIRECTORY: path } });
      if (result.status !== 0) fail("Manifest directory ACL verification failed");
      const acl = JSON.parse(result.stdout);
      if (acl.owner !== sid || !acl.protected || acl.allow.some(value => ![sid, "S-1-5-18", "S-1-5-32-544"].includes(value))) {
        fail("Manifest directory has unexpected access; operation refused");
      }
    } else if ((lstatSync(path).mode & 0o077) !== 0 || lstatSync(path).uid !== process.getuid()) {
      fail("Manifest directory must be owned and private");
    }
  }
  return directory;
}
export function persistManifest(path, record, initial = false) {
  verifyManifest(record);
  const destination = initial ? path : `${path}.${randomBytes(8).toString("hex")}.tmp`;
  const fd = openSync(destination, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(record)); fsyncSync(fd); } finally { closeSync(fd); }
  if (!initial) renameSync(destination, path);
  // Also fsync the directory where supported; Windows rejects directory handles.
  if (process.platform !== "win32") {
    const directory = openSync(resolve(path, ".."), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  }
}
export function readManifest(path) {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || lstatSync(path).size > 16_384) fail("Missing/unsafe manifest; recovery refused");
  try { return verifyManifest(JSON.parse(readFileSync(path, "utf8"))); }
  catch { fail("Corrupted or incompatible manifest; recovery refused"); }
}
async function lease() {
  const server = createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return server;
}
export async function assertInactive(record) {
  try { process.kill(record.pid, 0); fail("Run process remains active or its PID has been reused; recovery refused"); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
  await new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: record.leasePort });
    socket.setTimeout(1500);
    socket.once("connect", () => { socket.destroy(); reject(new Error("Run lease remains active; recovery refused")); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error("Cannot establish lease inactivity")); });
    socket.once("error", error => { if (error.code === "ECONNREFUSED") resolve(); else reject(new Error("Cannot establish lease inactivity")); });
  });
}
class IsolatedCluster {
  constructor(record, path, liveLease = null) { this.record = record; this.path = path; this.liveLease = liveLease; this.password = null; }
  update(changes) { const next = { ...this.record, ...changes }; persistManifest(this.path, next); this.record = next; }
  verify() {
    const disk = readManifest(this.path);
    if (JSON.stringify(disk) !== JSON.stringify(this.record)) fail("Ownership manifest changed during run");
    verifyTarget(this.record.target, localTarget());
    const container = inspect(this.record.containerId);
    if (!container) fail("Owned container disappeared");
    return verifyContainer(this.record, container);
  }
  rawSql(database, input, user = "supabase_admin", allowFailure = false) {
    this.verify();
    if (!["postgres", this.record.database].includes(database) || !["postgres", "supabase_admin"].includes(user)) fail("Unregistered SQL target/authority refused");
    return docker(["exec", "-i", this.record.containerId, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database], input, allowFailure);
  }
  verifyDatabase() {
    const actual = JSON.parse(this.rawSql("postgres", `select json_build_object('systemId',(pg_control_system()).system_identifier::text,'databaseOid',(select oid::text from pg_database where datname=${literal(this.record.database)}),'owner',(select pg_get_userbyid(datdba) from pg_database where datname=${literal(this.record.database)}),'marker',(select shobj_description(oid,'pg_database') from pg_database where datname=${literal(this.record.database)}));`));
    if (!this.record.identity || actual.systemId !== this.record.identity.systemId
      || actual.databaseOid !== this.record.identity.databaseOid || actual.owner !== "postgres" || actual.marker !== this.record.marker) fail("Database identity mismatch; execution refused");
  }
  sql(database, input, user = "postgres", allowFailure = false) {
    if (this.record.phase !== "ready" || database !== this.record.database) fail("SQL requires the registered ready test database");
    this.verifyDatabase();
    return this.rawSql(database, input, user, allowFailure);
  }
  dumpAuth() {
    this.verifyDatabase();
    return docker(["exec", "-i", this.record.containerId, "pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--schema=auth", "--no-owner", "--no-privileges"]);
  }
  async start() {
    this.verify(); this.update({ phase: "starting" });
    docker(["start", this.record.containerId]); this.update({ phase: "started" });
    const deadline = Date.now() + 120_000;
    while (true) {
      this.verify();
      if (docker(["exec", this.record.containerId, "pg_isready", "-U", "supabase_admin", "-d", "postgres"], undefined, true, 5000) !== null) {
        const ready = this.rawSql("postgres", "select to_regclass('auth.users') is not null and exists(select 1 from pg_roles where rolname='postgres' and not rolsuper);", "supabase_admin", true);
        if (ready?.trim() === "t") break;
      }
      if (Date.now() > deadline) fail("Isolated PostgreSQL bootstrap readiness timed out");
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    this.rawSql("postgres", readFileSync(new URL("./sql/isolated-postgres-test-bootstrap.sql", import.meta.url), "utf8"));
    this.password = randomBytes(32).toString("hex");
    this.rawSql("postgres", sensitiveLogging + `set password_encryption='scram-sha-256'; alter role postgres password ${literal(this.password)};`);
    // Bootstrap trust is restricted by network=none. Replace final TCP HBA with
    // SCRAM before any dblink sessions; Unix sockets remain trusted for docker exec.
    this.verify();
    docker(["exec", "-i", this.record.containerId, "sh", "-c", "cat > /etc/postgresql/pg_hba.conf"],
      "local all all trust\nhost all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n");
    this.rawSql("postgres", "select pg_reload_conf();");
    const hba = this.rawSql("postgres", "select count(*) from pg_hba_file_rules where error is not null or (type='host' and auth_method not in ('scram-sha-256','reject')); select count(*) from pg_hba_file_rules where type='host' and address='127.0.0.1' and auth_method='scram-sha-256';").trim();
    if (hba !== "0\n1" && hba !== "0\r\n1") fail("Password-authenticated loopback configuration verification failed");
    // Real password login, both denial and acceptance, without CLI/env secrets.
    this.verify();
    const tcp = pass => docker(["exec", "-i", this.record.containerId, "sh", "-c", "IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -qAt -w -h 127.0.0.1 -U postgres -d postgres -c 'select current_user'"], pass + "\n", true);
    if (tcp(randomBytes(32).toString("hex")) !== null || tcp(this.password)?.trim() !== "postgres") fail("Real SCRAM authentication probe failed");
    this.rawSql("postgres", `create database ${this.record.database} template template0 owner postgres; comment on database ${this.record.database} is ${literal(this.record.marker)};`);
    const identity = JSON.parse(this.rawSql("postgres", `select json_build_object('systemId',(pg_control_system()).system_identifier::text,'databaseOid',(select oid::text from pg_database where datname=${literal(this.record.database)}));`));
    this.update({ phase: "ready", identity });
    return this;
  }
  reconcileCreation() {
    if (this.record.containerId) return;
    if (this.record.phase !== "submitted") fail("Creation outcome cannot be reconciled from this stage");
    const ids = docker(["ps", "-a", "--no-trunc", "--filter", `label=go.test.run=${this.record.runId}`, "--format", "{{.ID}}"])
      .trim().split(/\s+/).filter(Boolean);
    if (ids.length !== 1) fail("Uncertain container creation remains missing or ambiguous; evidence retained");
    const candidate = verifyContainer(this.record, inspect(ids[0]));
    this.update({ containerId: candidate.id, createdAt: candidate.created, phase: "created" });
  }
  removeContainer() { docker(["rm", "--force", this.record.containerId]); }
  async cleanup() {
    const lock = `${this.path}.cleanup-lock`;
    let fd;
    try {
      fd = openSync(lock, "wx", 0o600);
      writeFileSync(fd, JSON.stringify({ runId: this.record.runId, pid: process.pid })); fsyncSync(fd);
      const disk = readManifest(this.path);
      if (JSON.stringify(disk) !== JSON.stringify(this.record)) fail("Cleanup ownership manifest changed");
      verifyTarget(this.record.target, localTarget());
      if (this.record.phase === "planned") {
        this.update({ phase: "removed" }); // No creation request was submitted.
      } else if (this.record.phase !== "removed") {
        this.reconcileCreation();
        const container = inspect(this.record.containerId);
        if (container) {
          verifyContainer(this.record, container);
          if (this.record.identity && container.state === "running" && this.record.phase !== "removing") this.verifyDatabase();
          this.update({ phase: "removing" });
          this.verify();
          // The exact owned container is the entire cleanup boundary. Killing it
          // closes all owned psql/dblink sessions; no shared-cluster DROP ROLE.
          this.removeContainer();
          if (inspect(this.record.containerId)) fail("Owned container removal was not verified");
        } else if (this.record.phase !== "removing") fail("Container missing without recorded removal intent");
        this.update({ phase: "removed" });
      }
      if (this.record.containerId && inspect(this.record.containerId)) fail("Removed container still exists");
      this.password = null;
    } finally {
      if (fd !== undefined) { closeSync(fd); unlinkSync(lock); }
      if (this.liveLease) { await new Promise(resolve => this.liveLease.close(resolve)); this.liveLease = null; }
    }
  }
}
export async function createIsolatedCluster() {
  const target = localTarget();
  const directory = protectedDirectory();
  const liveLease = await lease();
  const runId = randomBytes(16).toString("hex");
  const record = { version: 1, runId, repoRoot: repositoryRoot, repoId, target,
    containerName: `go-security-pg-${runId}`, containerId: null, intentAt: new Date().toISOString(), createdAt: null,
    phase: "planned", pid: process.pid, leasePort: liveLease.address().port,
    database: `go_share_test_${runId}`, marker: `go-disposable:${runId}`, identity: null };
  const path = join(directory, `${runId}.json`);
  const cluster = new IsolatedCluster(record, path, liveLease);
  try {
    persistManifest(path, record, true);
    const names = docker(["ps", "-a", "--format", "{{.Names}}"]);
    if (names.trim().split(/\s+/).includes(record.containerName)) fail("Container name collision; no adoption permitted");
    cluster.update({ phase: "submitted" });
    const id = docker(["create", "--name", record.containerName,
      ...Object.entries(ownershipLabels(record)).flatMap(([key, value]) => ["--label", `${key}=${value}`]),
      "--network", "none", "--restart", "no", "--ipc", "private", "--memory", "2g", "--cpus", "2", "--shm-size", "128m",
      "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=1073741824",
      "--env", "PGDATA=/var/lib/postgresql/data", "--env", "POSTGRES_HOST=/var/run/postgresql",
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "POSTGRES_PASSWORD=", imageDigest,
      "postgres", "-D", "/etc/postgresql", "-c", "statement_timeout=120s", "-c", "idle_in_transaction_session_timeout=120s",
      "-c", "log_statement=none", "-c", "log_min_error_statement=panic", "-c", "log_parameter_max_length=0",
      "-c", "log_parameter_max_length_on_error=0"]);
    const container = verifyContainer(record, inspect(id.trim()));
    cluster.update({ containerId: container.id, createdAt: container.created, phase: "created" });
    return cluster;
  } catch (error) {
    if (existsSync(path)) {
      try { await cluster.cleanup(); } catch { /* Preserve durable evidence; no unsafe fallback. */ }
    } else await new Promise(resolve => liveLease.close(resolve));
    const reported = new Error(`${safeError(error)}; run ${runId} (inspect its local manifest before recovery)`);
    reported.safe = true; throw reported;
  }
}
export async function recoverIsolatedCluster(runId) {
  if (!/^[a-f0-9]{32}$/.test(runId ?? "")) fail("Recovery requires one exact isolated run ID");
  const path = join(protectedDirectory(), `${runId}.json`);
  const record = readManifest(path);
  verifyTarget(record.target, localTarget());
  if (record.phase !== "removed") await assertInactive(record);
  const cluster = new IsolatedCluster(record, path);
  await cluster.cleanup();
  return record.runId;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "recover") fail("Usage: node scripts/isolated-postgres-test-cluster.mjs recover <exact-run-id>");
    await recoverIsolatedCluster(process.argv[3]); console.log("Verified isolated container removed; recovery is safely repeatable.");
  } catch (error) { console.error(safeError(error)); process.exitCode = 1; }
}
