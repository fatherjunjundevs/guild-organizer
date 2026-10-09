// Only creates/drops runner-owned empty databases in the verified local CLI container.
// Production URLs and credentials are neither accepted nor printed.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadShareLinkTestModules } from "./load-share-link-test-modules.mjs";
import { testShareLinkServerIntegration } from "./test-share-link-server-integration.mjs";
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!project) throw new Error("Local project identity missing");
let password;
function redact(value) {
  return password ? value.replaceAll(password, "[redacted]") : value;
}
function command(args, input, allowFailure = false) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(redact(result.stderr || "Local Docker operation failed"));
  }
  return result.stdout;
}
const ids = command(["ps", "-q", "--filter", `label=com.supabase.cli.project=${project}`]).trim().split(/\s+/).filter(Boolean);
const containers = ids.map((id) => JSON.parse(command(["inspect", id]))[0]);
const container = containers.find((c) => c.Config.Image.includes("supabase/postgres:"));
if (!container || resolve(container.Config.Labels["com.supabase.cli.workdir"] || "") !== root) {
  throw new Error("Refusing unverified local Supabase container");
}
const containerId = container.Id;
password = container.Config.Env.find((e) => e.startsWith("POSTGRES_PASSWORD="))?.slice("POSTGRES_PASSWORD=".length);
if (!password) throw new Error("Local database authentication configuration missing");
const host = Object.values(container.NetworkSettings.Networks).find((n) => n.IPAddress)?.IPAddress;
if (!host || !/^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error("Local container network identity missing");
function sql(database, input, user = "postgres", allowFailure = false) {
  return command(["exec", "-i", containerId, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database], input, allowFailure);
}
function literal(value) { return "'" + value.replaceAll("'", "''") + "'"; }
const runId = randomBytes(16).toString("hex");
const database = `go_share_test_${runId}`;
const marker = `go-disposable:${runId}`;
const manifest = join(tmpdir(), `go-share-concurrency-${runId}.json`);
function dispose(record) {
  // Never use a name/prefix alone as authorization to delete a database.
  if (record.containerId !== containerId || record.root !== root || !/^[a-f0-9]{32}$/.test(record.runId)
    || record.database !== `go_share_test_${record.runId}`) throw new Error("Invalid disposable ownership record");
  const comment = sql("postgres", `select shobj_description(oid,'pg_database') from pg_database where datname=${literal(record.database)};`).trim();
  if (!comment) {
    const exists = sql("postgres", `select count(*) from pg_database where datname=${literal(record.database)};`).trim();
    if (exists === "0") return;
    throw new Error("Disposable database has no ownership marker; manual inspection required");
  }
  if (comment !== `go-disposable:${record.runId}`) throw new Error("Refusing mismatched disposable database");
  command(["exec", containerId, "dropdb", "-U", "postgres", "--force", record.database]);
}
// An interrupted previous run can leave committed fixtures. Reclaim only exact
// manifest + container + database-comment matches. Never touch the development DB.
for (const name of readdirSync(tmpdir()).filter((n) => /^go-share-concurrency-[a-f0-9]{32}\.json$/.test(n))) {
  const path = join(tmpdir(), name);
  const record = JSON.parse(readFileSync(path, "utf8"));
  if (record.containerId !== containerId || record.root !== root) continue;
  // Do not reclaim a database owned by another currently running test process.
  if (Number.isSafeInteger(record.pid) && record.pid > 0) {
    try { process.kill(record.pid, 0); continue; } catch (error) {
      if (error.code !== "ESRCH") throw new Error("Cannot verify interrupted runner status");
    }
  }
  dispose(record);
  unlinkSync(path);
}
const record = { root, containerId, runId, database, pid: process.pid };
writeFileSync(manifest, JSON.stringify(record), { flag: "wx", mode: 0o600 });
let failed = false;
try {
  if (sql("postgres", `select count(*) from pg_database where datname=${literal(database)};`).trim() !== "0") {
    throw new Error("Disposable name already exists");
  }
  command(["exec", containerId, "createdb", "-U", "postgres", "--template=template0", database, marker]);
  // Schema-only Supabase auth primitives; remove project triggers, which are
  // recreated by the ordered migrations. Never clone any development data.
  const authSchema = command(["exec", containerId, "pg_dump", "-U", "postgres", "--schema-only", "--schema=auth", "--no-owner", "--no-privileges"])
    .replace(/CREATE TRIGGER guild_organizer_[\s\S]*?;\r?\n/g, "");
  sql(database, authSchema, "supabase_admin");
  sql(database, "create schema extensions; create extension pgcrypto with schema extensions; grant usage on schema extensions,auth to postgres,anon,authenticated,service_role; grant all on all tables in schema auth to postgres; grant all on all sequences in schema auth to postgres;", "supabase_admin");
  const migrations = readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql")).sort();
  for (const name of migrations) sql(database, readFileSync(join("supabase/migrations", name), "utf8"));
  if (sql(database, "select (select count(*) from public.guilds)+(select count(*) from auth.users);").trim() !== "0") {
    throw new Error("Disposable target is populated; refusing fixture writes");
  }
  const key = randomBytes(32);
  const expiry = Number(sql(database, "select floor(extract(epoch from clock_timestamp()))::bigint+60;").trim());
  const actor = "6d000000-0000-4000-8000-000000000001";
  const guild = "6d100000-0000-4000-8000-000000000001";
  const event = "6d500000-0000-4000-8000-000000000001";
  const old = "6d800000-0000-4000-8000-000000000001";
  const serverModules = loadShareLinkTestModules();
  const provisioningConfig = new serverModules.config.ShareLinkProvisioningConfig("concurrency_test", key);
  function mac(op, link, previous, digest, nonce) {
    return serverModules.crypto.signShareLinkProvisioning({ operation: op, actorId: actor, guildId: guild,
      eventId: event, linkId: link, previousLinkId: previous, envelope: { digest,
        ciphertext: Buffer.alloc(32, 0xab), nonce: Buffer.from(nonce.repeat(12), "hex"),
        authTag: Buffer.alloc(16, 0xcd), encryptionKeyId: "test_key" } }, provisioningConfig, (expiry - 120) * 1000).mac.toString("hex");
  }
  const proofs = {
    create: mac("create", old, null, "1".repeat(64), "ef"),
    competing_create: mac("create", "6d800000-0000-4000-8000-000000000009", null, "1".repeat(64), "ef"),
    rotate: mac("rotate", "6d800000-0000-4000-8000-000000000002", old, "2".repeat(64), "ed"),
    competing_rotate: mac("rotate", "6d800000-0000-4000-8000-000000000003", old, "2".repeat(64), "ed"),
  };
  const settings = `set test.share_expiry=${literal(String(expiry))};` + Object.entries(proofs)
    .map(([name, proof]) => `set test.share_${name}_mac=${literal(proof)};`).join("");
  // Password is passed via stdin in this owned database only, never CLI arguments
  // or logs. Failures from this provisioning block receive a generic message.
  sql(database, "create extension pgtap with schema extensions; create extension dblink with schema extensions; grant usage on foreign data wrapper dblink_fdw to postgres;", "supabase_admin");
  const setup = `
create schema test_runner;
create table test_runner.ownership(run_id text primary key, database_name text, host text);
insert into test_runner.ownership values(${literal(runId)},${literal(database)},${literal(host)});
create server share_concurrency foreign data wrapper dblink_fdw options(host ${literal(host)},dbname ${literal(database)},port '5432');
create user mapping for postgres server share_concurrency options(user 'postgres',password ${literal(password)});
create function test_runner.assert_target() returns void language plpgsql set search_path='' as $guard$
begin
 if current_database() <> ${literal(database)} or not exists(
  select 1 from test_runner.ownership o join pg_catalog.pg_database d on d.datname=o.database_name
  where o.run_id=${literal(runId)} and o.database_name=current_database()
  and pg_catalog.shobj_description(d.oid,'pg_database')=${literal(marker)}
  and exists(select 1 from pg_catalog.pg_foreign_server s where s.srvname='share_concurrency'
   and s.srvoptions @> array['host='||o.host,'dbname='||o.database_name,'port=5432'])) then
   raise exception 'disposable concurrency target verification failed';
 end if;
end;
$guard$;
revoke all on schema test_runner from public,anon,authenticated,service_role;
revoke all on all functions in schema test_runner from public,anon,authenticated,service_role;
insert into private.event_share_link_provisioning_keys values('concurrency_test',decode('${key.toString("hex")}','hex'),clock_timestamp()-interval '1 minute',null);
`;
  // Suppress statement/error-parameter logging before transmitting runtime
  // authentication/key material. These settings affect only this setup session.
  const noSensitiveLogging = "set log_statement='none'; set log_min_error_statement='panic'; set log_parameter_max_length=0; set log_parameter_max_length_on_error=0; set role postgres;\n";
  if (sql(database, noSensitiveLogging + setup, "supabase_admin", true) === null) throw new Error("Disposable test setup failed (sensitive details suppressed)");
  const context = `do $context$ begin
perform set_config('test.share_dblink_server','share_concurrency',false);
perform set_config('test.share_proof_settings',${literal(settings)},false);
end; $context$;\n` + settings;
  console.log(`Replayed ${migrations.length} migrations in a new empty disposable database.`);
  const output = sql(database, context + readFileSync("supabase/concurrency-tests/event_share_link_concurrency.test.sql", "utf8"));
  console.log(redact(output).trim());
  const results = output.split(/\r?\n/).filter((line) => /^(not )?ok \d+/.test(line));
  if (results.length !== 16 || results.some((line) => line.startsWith("not ok")) || !/^1\.\.16$/m.test(output)) {
    throw new Error("Concurrency TAP assertions failed or incomplete");
  }
  if (sql(database, "select (select count(*) from public.guilds)+(select count(*) from auth.users)+(select count(*) from private.event_share_links);").trim() !== "0") {
    throw new Error("Committed concurrency fixtures were not cleaned");
  }
  console.log("Concurrency: 16 assertions passed; committed fixtures cleaned.");
  testShareLinkServerIntegration({ modules: serverModules, key, sql, database });
} catch (error) {
  failed = true;
  console.error(redact(error.message));
} finally {
  try {
    dispose(record);
    unlinkSync(manifest);
    console.log("Verified disposable database removed; development database preserved.");
  } catch (error) {
    failed = true;
    console.error(redact(error.message));
    console.error("Ownership manifest retained for safe recovery on the next run.");
  }
}
if (failed) process.exitCode = 1;
