// Real local Docker probes, limited to containers created by this helper.
import assert from "node:assert/strict";
import { fork, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createIsolatedCluster, recoverIsolatedCluster, repositoryRoot, safeError, literal } from "./isolated-postgres-test-cluster.mjs";

const self = new URL(import.meta.url);
process.chdir(repositoryRoot);
if (process.argv[2] === "--cleanup-failure-child") {
  const cluster = await createIsolatedCluster();
  process.send({ runId: cluster.record.runId });
  cluster.removeContainer = () => { throw new Error("injected cleanup failure"); };
  try { await cluster.cleanup(); }
  catch (error) { console.error(safeError(error)); process.exitCode = 1; }
} else if (process.argv[2] === "--interrupted-child") {
  const cluster = await createIsolatedCluster();
  if (process.argv[3] === "submitted") {
    // Real resource, lost response/ID persistence window. Creation labels and
    // durable submission intent remain; recovery must reconcile exactly one ID.
    cluster.update({ phase: "submitted", containerId: null, createdAt: null });
  }
  process.send({ runId: cluster.record.runId });
  await new Promise(() => {}); // Parent kills only this exact spawned child.
} else {
  let assertions = 0;
  const check = (condition, label) => { assert.ok(condition, label); assertions++; console.log(`ok ${assertions} - ${label}`); };
  const clusters = [];
  const interruptedRuns = [];
  const existing = () => {
    const result = spawnSync("docker", ["ps", "-a", "--no-trunc", "--format", '{{.ID}} {{.Names}} {{.Label "go.test.kind"}}'], { encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0);
    // Other independent test runs may create/remove their own containers while
    // this suite runs. Their labels only exclude them from the non-test inventory
    // comparison; labels alone never authorize deletion. Our exact resources are
    // independently verified absent by each cleanup/recovery operation.
    return result.stdout.trim().split(/\r?\n/).filter(line => line && !line.endsWith(" isolated-postgres-v1")).sort();
  };
  const before = existing();
  let failed = false;
  try {
    const a = await createIsolatedCluster(); clusters.push(a);
    const b = await createIsolatedCluster(); clusters.push(b);
    check(a.record.containerId !== b.record.containerId, "two exact owned containers coexist");
    await Promise.all([a.start(), b.start()]);
    check(a.record.identity.systemId !== b.record.identity.systemId, "independent PostgreSQL system identifiers");
    a.verify();
    const collision = spawnSync("docker", ["create", "--name", a.record.containerName, "--network", "none", a.record.target.imageDigest],
      { encoding: "utf8", windowsHide: true, timeout: 10_000 });
    check(collision.status !== 0 && a.verify().id === a.record.containerId, "actual container-name collision neither adopts nor changes the existing owned resource");
    const bootstrap = readFileSync(new URL("./sql/isolated-postgres-test-bootstrap.sql", import.meta.url), "utf8");
    check(a.rawSql("postgres", "begin; alter role postgres superuser;\n" + bootstrap, "supabase_admin", true) === null,
      "incompatible bootstrap authority fails closed in a real transaction");
    check(a.rawSql("postgres", "select not rolsuper from pg_roles where rolname='postgres';").trim() === "t",
      "bootstrap rejection rolls back the incompatible test-only role change");
    const migrations = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
    const boundaryIndex = migrations.findIndex(name => name.endsWith("_event_share_link_resolver_access_boundary.sql"));
    assert.ok(boundaryIndex >= 0, "Required resolver migration missing");
    for (const c of [a, b]) {
      c.sql(c.record.database, c.dumpAuth(), "supabase_admin");
      c.sql(c.record.database, "create schema extensions; create extension pgcrypto with schema extensions; grant usage on schema extensions,auth to postgres,anon,authenticated,service_role; grant all on all tables in schema auth to postgres; grant all on all sequences in schema auth to postgres;", "supabase_admin");
      const earlier = migrations.slice(0,boundaryIndex).map(name => readFileSync(join("supabase/migrations",name), "utf8")).join("\n");
      c.sql(c.record.database, earlier);
      const beforeResolver = c.sql(c.record.database, "select pg_get_functiondef('public.resolve_event_share_link(text)'::regprocedure);");
      const boundary = readFileSync(join("supabase/migrations",migrations[boundaryIndex]), "utf8");
      c.sql(c.record.database, boundary);
      check(c.sql(c.record.database, "select pg_get_functiondef('public.resolve_event_share_link(text)'::regprocedure);") === beforeResolver, "resolver definition unchanged in independently owned cluster");
      const later = migrations.slice(boundaryIndex + 1).map(name => readFileSync(join("supabase/migrations",name), "utf8")).join("\n");
      if (later) c.sql(c.record.database,later);
      check(c.sql(c.record.database, boundary, "postgres", true) === null, "same-cluster resolver role collision fails closed");
      check(c.sql(c.record.database, "select count(*) from pg_roles where rolname='go_event_share_resolver';").trim() === "1", "dedicated resolver role exists in this cluster");
      c.sql(c.record.database, `create schema test_isolation; create table test_isolation.marker(value text); insert into test_isolation.marker values(${literal(c.record.runId)});`);
    }
    check(a.sql(a.record.database,"select value from test_isolation.marker;").trim() === a.record.runId
      && b.sql(b.record.database,"select value from test_isolation.marker;").trim() === b.record.runId, "matching role names and test records do not cross clusters");
    await assert.rejects(recoverIsolatedCluster(a.record.runId)); assertions++; console.log(`ok ${assertions} - active-run recovery refused`);
    await assert.rejects(recoverIsolatedCluster("0".repeat(32))); assertions++; console.log(`ok ${assertions} - unregistered run recovery refused`);

    const identity = a.record.identity;
    a.update({ identity: { ...identity, systemId: "1" } });
    assert.throws(() => a.sql(a.record.database, "select 1"));
    assertions++; console.log(`ok ${assertions} - database identity mismatch refuses SQL`);
    a.update({ identity });
    const originalManifest = readFileSync(a.path,"utf8");
    writeFileSync(a.path,"{corrupted");
    assert.throws(() => a.verify()); assertions++; console.log(`ok ${assertions} - corrupted manifest refuses execution`);
    writeFileSync(a.path,originalManifest); a.verify();
    const remove = a.removeContainer.bind(a);
    a.removeContainer = () => { throw new Error("injected removal failure"); };
    await assert.rejects(a.cleanup());
    check(a.verify().state === "running" && JSON.parse(readFileSync(a.path,"utf8")).phase === "removing", "failed removal retains exact live resource and recovery evidence");
    a.removeContainer = remove;
    await a.cleanup();
    check(b.sql(b.record.database,"select value from test_isolation.marker;").trim() === b.record.runId, "removing one cluster preserves the other");
    await a.cleanup(); check(a.record.phase === "removed", "duplicate cleanup is safe");
    await recoverIsolatedCluster(a.record.runId); check(true, "completed recovery safely repeats");
    const removeB = b.removeContainer.bind(b);
    b.removeContainer = () => { removeB(); throw new Error("injected lost removal response"); };
    await assert.rejects(b.cleanup());
    check(JSON.parse(readFileSync(b.path,"utf8")).phase === "removing", "partial cleanup retains removal intent");
    b.removeContainer = removeB; await b.cleanup(); check(b.record.phase === "removed", "partial removal reconciles exact absence");

    for (const phase of ["created", "submitted"]) {
      const child = fork(self, ["--interrupted-child", phase], { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
      let run;
      try {
        run = await new Promise((resolve,reject) => {
          const timer = setTimeout(() => reject(new Error("Interrupted child readiness timeout")), 60_000);
          child.once("message", message => { clearTimeout(timer); resolve(message.runId); });
          child.once("exit", () => { clearTimeout(timer); reject(new Error("Interrupted child exited before registration")); });
        });
        interruptedRuns.push(run);
      } finally {
        child.kill("SIGKILL");
        if (child.exitCode === null) await new Promise(resolve => child.once("exit",resolve));
      }
      await recoverIsolatedCluster(run); await recoverIsolatedCluster(run);
      check(true, `real interrupted ${phase} creation recovered and repeated`);
    }
    const child = fork(self, ["--cleanup-failure-child"], { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
    const childOutcome = await new Promise((resolve, reject) => {
      let run;
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Cleanup failure probe timed out")); }, 60_000);
      child.once("message", message => { run = message.runId; interruptedRuns.push(run); });
      child.once("exit", code => { clearTimeout(timer); resolve({ run, code }); });
    });
    check(childOutcome.code !== 0 && childOutcome.run, "real test subprocess fails when verified cleanup fails");
    await recoverIsolatedCluster(childOutcome.run);
    check(true, "failed cleanup subprocess leaves recoverable evidence and no surviving container after recovery");
    check(JSON.stringify(existing()) === JSON.stringify(before), "all exact suite containers removed; pre-existing non-test inventory unchanged");
    console.log(`Infrastructure lifecycle: ${assertions} assertions passed.`);
  } catch (error) { failed = true; console.error(safeError(error)); }
  finally {
    for (const c of clusters) {
      try { await c.cleanup(); } catch (error) { failed=true; console.error(safeError(error)); console.error(`Retained isolated run ${c.record.runId}`); }
    }
    for (const run of interruptedRuns) {
      try { await recoverIsolatedCluster(run); } catch (error) { failed=true; console.error(safeError(error)); console.error(`Retained interrupted run ${run}`); }
    }
    if (JSON.stringify(existing()) !== JSON.stringify(before)) { failed=true; console.error("Container inventory differs; inspect exact owned manifests without broad cleanup."); }
  }
  if (failed) process.exitCode=1;
}
