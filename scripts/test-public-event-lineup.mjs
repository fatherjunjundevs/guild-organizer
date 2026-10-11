// Work Package B only. All SQL/credentials stay inside verified disposable targets.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createIsolatedCluster, literal, safeError, ownedDocker } from "./isolated-postgres-test-cluster.mjs";
import { prepareShareLinkTestDatabase } from "./share-link-test-database.mjs";
import { assertHttpPrivacy, inspectPostgresLogs } from "./http-postgres-privacy.mjs";

let cluster;
try {
  cluster=await createIsolatedCluster({httpPrivacy:true}); await cluster.start();
  const prepared=prepareShareLinkTestDatabase(cluster); prepared.applyBoundary(); assertHttpPrivacy(cluster);
  cluster.sql(cluster.record.database,"grant go_event_share_resolver to postgres with admin true, inherit false, set true;","supabase_admin");
  cluster.sql(cluster.record.database,"create extension pgtap with schema extensions; grant usage on schema extensions to go_event_share_resolver;","supabase_admin");
  // Execute with sanitized failure categories instead of exposing SQL/psql errors.
  cluster.verifyDatabase();
  const test=spawnSync("docker",["exec","-i",cluster.record.containerId,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose","-U","postgres","-d",cluster.record.database],
    {input:readFileSync(new URL("../supabase/tests/public_event_lineup.test.sql",import.meta.url)),encoding:"utf8",timeout:120000,maxBuffer:1024*1024,windowsHide:true});
  if(test.error || test.status!==0) {
    const state=String(test.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? "unknown";
    const line=String(test.stderr).match(/LINE (\d+):/)?.[1] ?? "unknown";
    const completed=test.stdout.split(/\r?\n/).filter(line=>/^(not )?ok \d+/.test(line)).length;
    console.error(`Owned lineup SQL failed: SQLSTATE=${state}, expression-line=${line}, completed-assertions=${completed}, run=${cluster.record.runId}`);
    process.exitCode=1;
  } else {
    const assertions=test.stdout.split(/\r?\n/).filter(line=>/^(not )?ok \d+/.test(line));
    const plan=test.stdout.match(/^1\.\.(\d+)$/m);
    if(!plan || assertions.length!==Number(plan[1]) || assertions.some(line=>line.startsWith("not ok"))) {
      console.error("Lineup assertions failed: "+assertions.filter(line=>line.startsWith("not ok")).map(line=>line.match(/^not ok (\d+)/)[1]).join(","));
      process.exitCode=1;
    } else console.log(`Public lineup SQL: ${assertions.length} assertions passed; run=${cluster.record.runId}`);
  }
  if(!process.exitCode) {
    // Installation authority comes solely from the exact owned disposable target.
    // No app identity receives pg_read_all_settings, superuser or admin authority.
    const password=randomBytes(32).toString("hex"), wrong=randomBytes(32).toString("hex");
    const identitySql=readFileSync(new URL("../src/features/events/public-event-resolver.ts",import.meta.url),"utf8")
      .match(/export const resolverIdentitySql = `([^`]+)`;/)?.[1];
    if(!identitySql || identitySql.includes("${")) throw new Error("Unrecognized static identity assertion");
    cluster.privacySecrets.push(password,wrong);
    cluster.sql(cluster.record.database,`begin;
      create role go_event_share_reader login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 4 password ${literal(password)};
      grant go_event_share_resolver to go_event_share_reader with inherit false, set true, admin false;
      grant connect on database ${cluster.record.database} to go_event_share_reader;
      select pg_catalog.set_config('session_preload_libraries','',true),pg_catalog.set_config('local_preload_libraries','',true);
      alter role go_event_share_reader set session_preload_libraries from current;
      alter role go_event_share_reader set local_preload_libraries from current;
      commit;`,"supabase_admin");
    const probe=pass=>{cluster.verifyDatabase();return ownedDocker(["exec","-i",cluster.record.containerId,"sh","-c",
      `IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -qAt -w -h 127.0.0.1 -U go_event_share_reader -d ${cluster.record.database}`],pass+"\n"+`begin read only;
      set local role go_event_share_resolver;
      ${identitySql};
      select session_user='go_event_share_reader' and current_user='go_event_share_resolver'
        and pg_catalog.current_database()=${literal(cluster.record.database)}
        and (select pg_catalog.shobj_description(oid,'pg_database') from pg_catalog.pg_database where datname=pg_catalog.current_database())=${literal(cluster.record.marker)}
        and go_event_share_private.connection_private() is true
        and not pg_catalog.pg_has_role(session_user,'pg_read_all_settings','MEMBER')
        and not pg_catalog.pg_has_role(session_user,'anon','SET')
        and not pg_catalog.pg_has_role(session_user,'authenticated','SET')
        and not pg_catalog.pg_has_role(session_user,'service_role','SET');
      commit;`,true);};
    if(probe(wrong)!==null || probe(password)?.trim().replaceAll("\r","")!=="t\nt") throw new Error("Reader authentication/configuration failed");
    console.log("Fresh dedicated reader TCP session: negative/positive SCRAM, restricted identity, effective privacy, ownership and application-role isolation passed.");
    const source=readFileSync(new URL("../supabase/tests/public_event_lineup.test.sql",import.meta.url),"utf8");
    const setup=source.split("-- Public display regression assertions.");
    if(setup.length!==2 || cluster.sql(cluster.record.database,"select count(*) from public.guilds;").trim()!=="0") throw new Error("Race fixture target not empty");
    cluster.sql(cluster.record.database,setup[0].replace("select no_plan();","")+"commit;");
    cluster.sql(cluster.record.database,"create extension dblink with schema extensions; grant usage on foreign data wrapper dblink_fdw to postgres;","supabase_admin");
    cluster.sql(cluster.record.database,`create server go_public_lineup foreign data wrapper dblink_fdw
      options(host '127.0.0.1',dbname ${literal(cluster.record.database)},port '5432');
      create user mapping for postgres server go_public_lineup options(user 'go_event_share_reader',password ${literal(password)});`);
    const races=cluster.sql(cluster.record.database,readFileSync(new URL("../supabase/concurrency-tests/public_event_lineup.test.sql",import.meta.url),"utf8"));
    const rows=races.split(/\r?\n/).filter(line=>/^(not )?ok \d+/.test(line)), plan=races.match(/^1\.\.(\d+)$/m);
    if(!plan || rows.length!==Number(plan[1]) || rows.some(line=>line.startsWith("not ok"))) throw new Error("Public lineup race assertions failed");
    console.log(`Public lineup MVCC/republish/revoke races: ${rows.length} assertions passed.`);
    cluster.privacySecrets.push('v1.'+'A'.repeat(43),'v1.'+'B'.repeat(42)+'A','v1.'+'C'.repeat(42)+'A');
    const logs=inspectPostgresLogs(cluster,[]); console.log(`Complete PostgreSQL log evidence: ${logs.bytes} bytes; zero sensitive matches.`);
  }
} catch(error) { console.error(safeError(error)); process.exitCode=1; }
finally {
  if(cluster) {
    try { await cluster.cleanup(); console.log(`Verified exact Work Package B cluster removed: ${cluster.record.runId}; container=${cluster.record.containerId}`); }
    catch(error) { console.error(safeError(error)); console.error(`Cleanup unverified; retain ownership manifest for exact run ${cluster.record.runId}`); process.exitCode=1; }
  }
}
