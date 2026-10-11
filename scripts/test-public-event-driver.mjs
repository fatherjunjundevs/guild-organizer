// Real pg + actual API route on loopback inside existing verified infrastructure.
// No host ports, image construction/downloads, Redis provisioning or dev targets.
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import ts from "typescript";
import { createIsolatedCluster, literal, safeError, ownedDocker, repositoryRoot } from "./isolated-postgres-test-cluster.mjs";
import { createHttpService } from "./isolated-postgrest-test-service.mjs";
import { prepareShareLinkTestDatabase } from "./share-link-test-database.mjs";
import { assertHttpPrivacy, inspectPostgresLogs } from "./http-postgres-privacy.mjs";
import { assertNoSensitiveOutput } from "./postgrest-http-contract.mjs";

const tokenA = "v1." + "A".repeat(43), tokenB = "v1." + "B".repeat(42) + "A", tokenC = "v1." + "C".repeat(42) + "A";
const event = "6b500000-0000-4000-8000-000000000001", owner = "6b000000-0000-4000-8000-000000000001";
const require = createRequire(import.meta.url);
function packageRoot(name, from = require) {
  let path = dirname(realpathSync(from.resolve(name)));
  while (!existsSync(join(path, "package.json")) || JSON.parse(readFileSync(join(path, "package.json"), "utf8")).name !== name) {
    const parent = dirname(path); if (parent === path) throw new Error("Package root missing"); path = parent;
  }
  return path;
}
function stageRuntime(run) {
  const root = join(tmpdir(), `go-public-driver-source-${run}`); mkdirSync(root, { recursive: false });
  const packages = new Map();
  function copyPackage(name, from) {
    const path = packageRoot(name, from), metadata = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
    if (packages.has(name)) { if (packages.get(name) !== path) throw new Error("Ambiguous package closure"); return; }
    packages.set(name, path); const destination = join(root, "node_modules", name); mkdirSync(dirname(destination), { recursive: true });
    cpSync(path, destination, { recursive: true, filter: path => !path.includes("/node_modules/") || !path.slice(path.indexOf("/node_modules/") + 14).includes("/node_modules/") });
    const local = createRequire(join(path, "package.json"));
    for (const dependency of Object.keys(metadata.dependencies ?? {})) copyPackage(dependency, local);
  }
  for (const name of ["pg", "zod", "server-only"]) copyPackage(name, require);
  if (JSON.parse(readFileSync(join(root, "node_modules/pg/package.json"), "utf8")).version !== "8.23.1") throw new Error("Unapproved driver version");
  writeFileSync(join(root, "package.json"), '{"type":"module","private":true}');
  const files = ["public-event-postgres", "public-event-resolver", "public-event-config", "public-event-handler", "public-event-admission",
    "public-bounded-json", "public-lineup", "share-link-feature"].map(name => `src/features/events/${name}.ts`);
  files.push("src/app/api/share/event/route.ts");
  for (const file of files) {
    let compiled = ts.transpileModule(readFileSync(join(repositoryRoot, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    compiled = compiled.replace(/from "(@\/[^"\n]+|\.\/?[^"\n]+)"/g, (_, source) => {
      const target = source.startsWith("@/") ? relative(dirname(file), "src/" + source.slice(2)).replaceAll("\\", "/") : source;
      return `from "${target.startsWith(".") ? target : "./" + target}.js"`;
    });
    const destination = join(root, file.replace(/\.ts$/, ".js")); mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, compiled);
  }
  mkdirSync(join(root, "scripts"), { recursive: true });
  for (const file of ["public-event-driver-runtime.mjs", "postgrest-http-contract.mjs"]) cpSync(new URL(file, import.meta.url), join(root, "scripts", file));
  const archive = join(tmpdir(), `go-public-driver-source-${run}.tar`);
  const packed = spawnSync("tar", ["-cf", archive, "-C", root, "."], { windowsHide: true, timeout: 30000 });
  if (packed.status !== 0) throw new Error("Runtime packaging failed");
  return readFileSync(archive);
}
function transport(cluster, service, secrets) {
  service.verify();
  const child = spawn("docker", ["exec", "-i", cluster.record.http.containerId, "node", "--conditions=react-server", "/run/go-http/scripts/public-event-driver-runtime.mjs"],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let buffer = "", bytes = 0, stderr = ""; const pending = new Map();
  const reject = (failure) => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(failure instanceof Error ? failure : new Error("Driver transport failed")); } pending.clear(); };
  child.on("error", reject); child.on("exit", reject); child.stdin.on("error", reject);
  child.stderr.on("data", chunk => { stderr += chunk; if (Buffer.byteLength(stderr) > 65536) { child.kill(); reject(); } });
  child.stdout.on("data", chunk => {
    buffer += chunk; bytes += chunk.length; if (bytes > 65536) { child.kill(); reject(); return; }
    while (buffer.includes("\n")) {
      const end = buffer.indexOf("\n"), line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      try {
        assertNoSensitiveOutput(line, secrets); const row = JSON.parse(line), item = pending.get(row.id);
        if (item && row.ok === false && Number.isSafeInteger(row.assertion) && ["TypeError", "SyntaxError", "ReferenceError", "assertion-or-runtime"].includes(row.category)) {
          const error = new Error(`Owned driver command failed: ${item.operation}; assertion=${row.assertion}; category=${row.category}`); error.safe = true; throw error;
        }
        if (!item || row.ok !== true || !row.result || Object.keys(row).sort().join() !== "id,ok,result") throw new Error("Driver assertion failed");
        clearTimeout(item.timer); pending.delete(row.id); item.resolve(row.result);
      } catch (error) { reject(error); child.kill(); }
    }
  });
  return { child, async command(value) {
    service.verify(); const id = randomBytes(16).toString("hex");
    return new Promise((resolve, fail) => {
      const timer = setTimeout(() => { pending.delete(id); fail(new Error("Driver operation deadline")); child.kill(); }, 15000);
      pending.set(id, { resolve, reject: fail, timer, operation: ["init", "http", "parallel", "transport", "end"].includes(value.op) ? value.op : "unknown" }); child.stdin.write(JSON.stringify({ ...value, id }) + "\n");
    });
  }, inspect() { assertNoSensitiveOutput(stderr, secrets); if (stderr.length || buffer.length) throw new Error("Unexpected driver diagnostics"); return bytes; } };
}
function lockTable(cluster) {
  cluster.verifyDatabase();
  const child = spawn("docker", ["exec", "-i", cluster.record.containerId, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", cluster.record.database],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  child.stderr.resume();
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("Owned lock deadline")); }, 5000);
    child.on("error", () => { clearTimeout(timer); reject(new Error("Owned lock failed")); });
    child.on("exit", () => { clearTimeout(timer); reject(new Error("Owned lock exited")); });
    child.stdout.on("data", chunk => { if (String(chunk).includes("go_owned_lock_ready")) { clearTimeout(timer); resolve(); } });
  });
  child.stdin.write("begin; lock table private.event_share_links in access exclusive mode; select 'go_owned_lock_ready';\n");
  return { ready, async release() { child.stdin.end("rollback;\n\\q\n"); await new Promise(resolve => child.once("exit", resolve)); } };
}
let cluster, runtime, lock, phase = "create";
try {
  cluster = await createIsolatedCluster({ httpPrivacy: true }); await cluster.start();
  phase = "migration-privacy";
  prepareShareLinkTestDatabase(cluster).applyBoundary(); assertHttpPrivacy(cluster);
  const password = randomBytes(32).toString("hex"); cluster.privacySecrets.push(password, tokenA, tokenB, tokenC);
  cluster.sql(cluster.record.database, `begin;
    create role go_event_share_reader login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 4 password ${literal(password)};
    grant go_event_share_resolver to go_event_share_reader with inherit false, set true, admin false;
    grant connect on database ${cluster.record.database} to go_event_share_reader;
    select pg_catalog.set_config('session_preload_libraries','',true),pg_catalog.set_config('local_preload_libraries','',true);
    alter role go_event_share_reader set session_preload_libraries from current;
    alter role go_event_share_reader set local_preload_libraries from current; commit;`, "supabase_admin");
  const fingerprintSql = `select md5(json_build_array(
    (select json_agg(row(rolname,rolcanlogin,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolconnlimit) order by rolname) from pg_roles),
    (select json_agg(m order by roleid,member) from pg_auth_members m),
    (select json_agg(s order by setdatabase,setrole) from pg_db_role_setting s),
    (select json_agg(h order by rule_number) from pg_hba_file_rules h))::text);`;
  const fingerprint = cluster.rawSql(cluster.record.database, fingerprintSql).trim();
  if (!/^[a-f0-9]{32}$/.test(fingerprint)) throw new Error("Missing security fingerprint");
  phase = "fixture";
  const fixture = readFileSync(new URL("../supabase/tests/public_event_lineup.test.sql", import.meta.url), "utf8").split("-- Public display regression assertions.")[0];
  if (cluster.sql(cluster.record.database, "select count(*) from public.guilds;").trim() !== "0") throw new Error("Nonempty fixture target");
  cluster.sql(cluster.record.database, fixture.replace("select no_plan();", "") + "commit;");
  phase = "runtime-packaging";
  const service = await createHttpService(cluster); service.verify();
  ownedDocker(["start", cluster.record.http.containerId]); service.verify();
  ownedDocker(["exec", "-i", cluster.record.http.containerId, "tar", "-xf", "-", "-C", "/run/go-http"], stageRuntime(cluster.record.runId)); service.verify();
  const proxy = randomBytes(32).toString("base64"), admission = randomBytes(32).toString("base64"), credential = randomBytes(32).toString("hex");
  const secrets = [...cluster.privacySecrets, proxy, admission, credential, Buffer.from(proxy, "base64").toString("hex"), "PRIVATE_HTTP_DRAFT_CANARY", "PRIVATE_TRANSPORT_ERROR"];
  runtime = transport(cluster, service, secrets);
  await runtime.command({ op: "init", secrets, env: { APP_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3100", SHARE_LINK_INTERFACE_ENABLED: "true",
    PUBLIC_EVENT_VIEWER_ENABLED: "true", PUBLIC_EVENT_DB_HOST: "127.0.0.1", PUBLIC_EVENT_DB_NAME: cluster.record.database,
    PUBLIC_EVENT_DB_PASSWORD: password, PUBLIC_EVENT_ISOLATED_RUN_ID: cluster.record.runId,
    PUBLIC_EVENT_ADMISSION_URL: "https://admission.invalid", PUBLIC_EVENT_ADMISSION_CREDENTIAL: credential,
    PUBLIC_EVENT_PROXY_KEY: proxy, PUBLIC_EVENT_ADMISSION_KEY: admission } });
  const request = (extra = {}) => runtime.command({ op: "http", token: tokenA, status: 200, display: "ready", eventName: "HTTP published event", versionExpected: 1, ...extra });
  phase = "HTTP-controls";
  await request(); await runtime.command({ op: "parallel", token: tokenA });
  if (cluster.rawSql(cluster.record.database, `select count(*)=2 from pg_stat_activity where usename='go_event_share_reader' and datname=${literal(cluster.record.database)};`).trim() !== "t") throw new Error("Two real pool backends not established");
  for (const extra of [{ token: "invalid", status: 400 }, { token: tokenC, status: 404 }, { admission: "failure", status: 503 },
    { admission: "limited", status: 429 }, { admission: "unknown", status: 503 }, { untrusted: true, status: 503 }, { query: true, status: 403 }, { method: "GET", status: 405 }, { method: "HEAD", status: 405 }])
    await request({ display: undefined, noDatabase: extra.status !== 404, ...extra });
  const sqlTests = readFileSync(new URL("../supabase/tests/public_event_lineup.test.sql", import.meta.url), "utf8");
  const otherGuild = sqlTests.slice(sqlTests.indexOf("insert into public.guilds(id,name,created_by) values('6b100000-0000-4000-8000-000000000002'"),
    sqlTests.indexOf("select ok(pg_temp.lineup()::text not like '%Unrelated%'"));
  if (!otherGuild.includes("Other League")) throw new Error("Missing second-Guild fixture");
  cluster.sql(cluster.record.database, `begin; set local request.jwt.claim.sub=${literal(owner)};` + otherGuild + "commit;");
  await request(); await request({ token: tokenC, eventName: "Unrelated Event", versionExpected: 1, empty: true });
  await request({ status: 400, display: undefined, guildId: "6b100000-0000-4000-8000-000000000002", noDatabase: true });
  cluster.sql(cluster.record.database, `grant select on public.characters to go_event_share_reader;`);
  await request({ status: 503, display: undefined, noDatabase: true });
  cluster.sql(cluster.record.database, "revoke select on public.characters from go_event_share_reader;"); await request();
  cluster.sql(cluster.record.database, "grant go_event_share_resolver to go_event_share_reader with inherit false, set false, admin false;", "supabase_admin");
  await request({ status: 503, display: undefined, noDatabase: true });
  cluster.sql(cluster.record.database, "grant go_event_share_resolver to go_event_share_reader with inherit false, set true, admin false;", "supabase_admin"); await request();
  phase = "transport-controls";
  for (const kind of ["password", "tls", "connect", "query"]) await runtime.command({ op: "transport", kind });
  phase = "deadline-cancellation";
  lock = lockTable(cluster); await lock.ready; const start = Date.now(); await request({ status: 503, display: undefined });
  if (Date.now() - start < 1700 || Date.now() - start > 6000) throw new Error("Statement deadline not established");
  await lock.release(); lock = null; await request();
  lock = lockTable(cluster); await lock.ready; await request({ cancel: true }); await lock.release(); lock = null;
  await request();
  cluster.rawSql(cluster.record.database, `select pg_terminate_backend(pid) from pg_stat_activity where usename='go_event_share_reader' and datname=${literal(cluster.record.database)};`);
  await request();
  phase = "publication-controls";
  cluster.sql(cluster.record.database, `begin; update public.events set name='Updated Public Event' where id=${literal(event)};
    set local role authenticated; set local request.jwt.claim.sub=${literal(owner)}; select public.update_event_publication(${literal(event)}); commit;`);
  await request({ version: 1, display: "updated" }); await request({ eventName: "Updated Public Event", versionExpected: 2 });
  const rotation = readFileSync(new URL("../supabase/tests/public_event_lineup.test.sql", import.meta.url), "utf8")
    .split("-- Exercise the real attested rotation RPC; this fixed test key rolls back.")[1].split("select ok(pg_temp.lineup() is null,'rotated bearer unavailable');")[0];
  if (!rotation.includes("rotate_event_share_link")) throw new Error("Missing rotation fixture");
  cluster.sql(cluster.record.database, `begin; set local request.jwt.claim.sub=${literal(owner)};` + rotation + "commit;");
  await request({ status: 404, display: undefined }); await request({ token: tokenB, eventName: "Updated Public Event", versionExpected: 2 });
  cluster.sql(cluster.record.database, `begin; set local role authenticated; set local request.jwt.claim.sub=${literal(owner)};
    select public.unpublish_event(${literal(event)}); commit;`); await request({ token: tokenB, status: 404, display: undefined });
  cluster.sql(cluster.record.database, `begin; set local role authenticated; set local request.jwt.claim.sub=${literal(owner)};
    select public.publish_event(${literal(event)}); select public.revoke_event_share_link('6b100000-0000-4000-8000-000000000001',${literal(event)},'6b800000-0000-4000-8000-000000000002'); commit;`);
  await request({ token: tokenB, status: 404, display: undefined });
  const evidence = await runtime.command({ op: "end" }); runtime.child.stdin.end();
  const outputBytes = runtime.inspect();
  if (cluster.rawSql(cluster.record.database, fingerprintSql).trim() !== fingerprint) throw new Error("Security policy fingerprint changed");
  if (cluster.rawSql(cluster.record.database, `select count(*)=0 from pg_stat_activity where usename='go_event_share_reader' and datname=${literal(cluster.record.database)};`).trim() !== "t") throw new Error("Driver pool closure not verified");
  const logs = inspectPostgresLogs(cluster, []);
  console.log(`Real pg/HTTP route: ${evidence.assertions} assertions passed; identity checks=${evidence.identities}; bearer projections=${evidence.projections}; SQLSTATE 42501 denials=${evidence.sqlDenials}; SQLSTATE 57014 deadlines=${evidence.statementTimeouts}; two pool backends verified.`);
  console.log(`Actual negative password, TLS rejection, 2s connection/statement deadlines, 3s query deadline, cancellation, pool recovery and privacy checks passed; runtime logs=${evidence.logBytes}; sanitized output=${outputBytes}; PostgreSQL logs=${logs.bytes} bytes, zero sensitive matches.`);
  console.log("Admission adapter exercised with scripted REST results only; no external provider or proxy was provisioned.");
} catch (error) { console.error(safeError(error)); console.error(`Real-driver failure phase=${phase}`); process.exitCode = 1; }
finally {
  if (lock) { try { await lock.release(); } catch { process.exitCode = 1; } }
  runtime?.child.kill();
  if (cluster) try { await cluster.cleanup(); console.log(`Verified exact real-driver resources removed: run=${cluster.record.runId}; pg=${cluster.record.containerId}; node=${cluster.record.http?.containerId}`); }
  catch (error) { console.error(safeError(error)); console.error(`Cleanup unverified; retain manifest for exact run ${cluster.record.runId}`); process.exitCode = 1; }
}
