// Owned HTTP-only privacy verification; no raw logs or protected settings escape.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { httpSharedLibraries, literal } from "./isolated-postgres-test-cluster.mjs";
import { assertNoSensitiveOutput, httpFail } from "./postgrest-http-contract.mjs";
import { assertInstallerAuthority, assertPreloadCatalog, scramSecurityFingerprint,
  runScramDiagnostics, diagnosticPreloadProbe, assertDiagnosticScramControls } from "./scram-probe-diagnostics.mjs";

export function installHttpPrivacy(cluster,password) {
  assertHttpPrivacy(cluster);
  assertInstallerAuthority(cluster);
  const before=scramSecurityFingerprint(cluster,false);
  cluster.sql(cluster.record.database,readFileSync(new URL("./sql/scram-preload-inspection.sql",import.meta.url),"utf8"),"supabase_admin");
  assertPreloadCatalog(cluster);
  if(scramSecurityFingerprint(cluster,false)!==before) httpFail("Privacy installer changed authentication policy");
  const baseline=scramSecurityFingerprint(cluster);
  const report=runScramDiagnostics(cluster,password);
  assertDiagnosticScramControls(report.negative,report.positive);
  const effective=diagnosticPreloadProbe(cluster,password);
  assertDiagnosticScramControls(report.negative,effective);
  if(scramSecurityFingerprint(cluster)!==baseline) httpFail("Authentication policy changed during Gate A");
  cluster.sql(cluster.record.database,readFileSync(new URL("./sql/http-privacy-inspection.sql",import.meta.url),"utf8"),"supabase_admin");
  console.log("Gate A passed: SCRAM controls, eight empty entries, effective preloads and private-schema 42501 denials.");
  return report;
}

export function assertHttpPrivacy(cluster) {
  cluster.verifyDatabase();
  if(cluster.record.startupProfile!=="http-private-v1") httpFail("HTTP privacy startup profile required");
  for(const user of ["supabase_admin","postgres"]) {
    const result=cluster.rawSql(cluster.record.database,`begin read only;
      select pg_catalog.current_setting('shared_preload_libraries')=${literal(httpSharedLibraries)}
        and (${user==="supabase_admin"?`array(select pg_catalog.btrim(v) from pg_catalog.unnest(pg_catalog.string_to_array(
          (select setting from pg_catalog.pg_file_settings where name='shared_preload_libraries' order by seqno desc limit 1),','))
          with ordinality x(v,n) where pg_catalog.btrim(v) not in ('pgaudit','auto_explain') order by n)
          = pg_catalog.string_to_array(${literal(httpSharedLibraries)},',')`:"true"})
        and pg_catalog.current_setting('session_preload_libraries') in ('','supautils')
        and pg_catalog.current_setting('local_preload_libraries')=''
        and pg_catalog.current_setting('log_statement')='none'
        and pg_catalog.current_setting('log_min_error_statement')='panic'
        and pg_catalog.current_setting('log_min_messages')='fatal'
        and pg_catalog.current_setting('log_duration')='off'
        and pg_catalog.current_setting('log_min_duration_statement')='-1'
        and pg_catalog.current_setting('log_min_duration_sample')='-1'
        and pg_catalog.current_setting('log_statement_sample_rate')='0'
        and pg_catalog.current_setting('log_transaction_sample_rate')='0'
        and pg_catalog.current_setting('log_parameter_max_length')='0'
        and pg_catalog.current_setting('log_parameter_max_length_on_error')='0'
        and pg_catalog.current_setting('pg_stat_statements.track')='none'
        and pg_catalog.current_setting('logging_collector')='off'
        and pg_catalog.current_setting('log_destination')='stderr'
        and pg_catalog.current_setting('log_connections')='off'
        and pg_catalog.current_setting('log_disconnections')='off'
        and pg_catalog.pg_current_logfile() is null
        and not exists(select 1 from pg_catalog.pg_settings where name like 'pgaudit.%' or name like 'auto_explain.%');
      commit;`,user);
    if(typeof result!=="string" || result.trim()!=="t") httpFail("Administrative HTTP privacy prerequisite failed");
  }
}

/** @param {(command:string,args:string[],options:{timeout:number,maxBuffer:number,windowsHide:boolean})=>{status:number|null,stdout:Buffer|null,stderr:Buffer|null,error?:unknown,signal?:string|null}} execute */
export function inspectPostgresLogs(cluster, secrets, execute=spawnSync) {
  const c=cluster.verify();
  if(c.host?.LogConfig?.Type!=="json-file" || Object.keys(c.host.LogConfig.Config??{}).length!==0)
    httpFail("Unknown PostgreSQL Docker log sink");
  const result=execute("docker",["logs",cluster.record.containerId],
    {timeout:30_000,maxBuffer:1024*1024,windowsHide:true});
  try {
    if(result.error || result.status!==0 || result.signal
      || !Buffer.isBuffer(result.stdout) || !Buffer.isBuffer(result.stderr))
      httpFail("Complete PostgreSQL log evidence unavailable");
    const text=Buffer.concat([result.stdout,result.stderr]).toString("utf8");
    assertNoSensitiveOutput(text,[...secrets,...(cluster.privacySecrets??[]),cluster.password]);
    // Readiness LOG messages are intentionally suppressed. The real negative
    // bootstrap SCRAM control supplies a FATAL sentinel in the same server sink.
    if(!/password authentication failed for user "postgres"/.test(text))
      httpFail("PostgreSQL negative-control log evidence missing");
    return {complete:true,bytes:Buffer.byteLength(text),sensitiveMatches:0};
  } finally {
    for(const b of [result.stdout,result.stderr]) if(Buffer.isBuffer(b)) b.fill(0);
  }
}

export function assertPostgrestConnections(cluster,pids) {
  cluster.verifyDatabase();
  if(!Array.isArray(pids) || pids.length!==2 || new Set(pids).size!==2 || !pids.every(Number.isSafeInteger))
    httpFail("HTTP pool identity evidence missing");
  const value=cluster.rawSql(cluster.record.database,`begin read only;
    select count(*)=3
      and count(*) filter(where pid in (${pids.join(",")}))=2
      and count(*) filter(where query ~* '^LISTEN[[:space:]]+"?pgrst"?[;[:space:]]*$')=1
      and bool_and(backend_type='client backend')
    from pg_catalog.pg_stat_activity where usename='authenticator' and datname=${literal(cluster.record.database)};
    commit;`);
  if(typeof value!=="string" || value.trim()!=="t") httpFail("HTTP pool/listener identity not established");
}
