// Diagnostic-only: raw child output is transient; only fixed classifications leave here.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { literal, httpSharedLibraries } from "./isolated-postgres-test-cluster.mjs";
import { exactKeys, httpFail } from "./postgrest-http-contract.mjs";

const deliveryMarker = "GO_SCRAM_STDIN_MATCH";
const states = new Set(["28P01", "28000", "42501", "53300", "57P03", "08001", "08006", "22023", "42704", "3D000", "42601", "58P01"]);
const startupSettings = {
  log_statement:"none", log_min_messages:"fatal", log_min_error_statement:"panic", log_duration:"off",
  log_min_duration_statement:"-1", log_min_duration_sample:"-1", log_statement_sample_rate:"0",
  log_transaction_sample_rate:"0", log_parameter_max_length:"0", log_parameter_max_length_on_error:"0",
  session_preload_libraries:"", local_preload_libraries:"", "pg_stat_statements.track":"none",
  statement_timeout:"5s", idle_in_transaction_session_timeout:"5s",
};

export function classifyScramProcess(result) {
  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "");
  const lines = stderr.split(/\r?\n/);
  const credentialDelivered = lines.filter(line => line === deliveryMarker).length === 1;
  const errorText = lines.filter(line => line !== deliveryMarker).join("\n").trim();
  const code = errorText.match(/(?:FATAL|ERROR):\s+([A-Z0-9]{5}):/)?.[1];
  const sqlState = states.has(code) ? code : null; // Never infer a SQLSTATE from a message.
  const exitCode = Number.isInteger(result.status) && result.status >= 0 && result.status <= 255 ? result.status : null;
  const output = stdout === "authenticator" ? "expected-identity" : stdout === "" ? "empty" : "unexpected";
  let processState = "completed", category = "unclassified-process-failure", parameter = null;
  if (result.error) {
    processState = result.error.code === "ETIMEDOUT" ? "timed-out" : result.error.code === "ENOENT" ? "spawn-failed" : "process-error";
    category = processState;
  } else if (result.signal || exitCode === null) {
    processState = "terminated"; category = "process-terminated";
  } else if (exitCode === 0) {
    category = !credentialDelivered ? "credential-delivery-unverified" : errorText ? "unexpected-diagnostics"
      : output === "expected-identity" ? "expected-identity" : output === "empty" ? "empty-output" : "unexpected-output";
  } else {
    const fatal = /FATAL:\s+(?:[A-Z0-9]{5}:\s+)?/;
    if (fatal.test(errorText)) {
      if (/password authentication failed for user "authenticator"/.test(errorText)) category = "password-authentication-rejected";
      else if (/too many connections for role "authenticator"/.test(errorText)) category = "role-connection-limit";
      else if (/too many connections for database/.test(errorText)) category = "database-connection-limit";
      else if (/role "authenticator" is not permitted to log in/.test(errorText)) category = "role-login-disabled";
      else if (/permission denied for database/.test(errorText)) category = "database-connect-denied";
      else if (/no pg_hba.conf entry|pg_hba.conf rejects connection/.test(errorText)) category = "hba-rejected";
      else if (/database .* does not exist|database .* is not currently accepting connections/.test(errorText)) category = "database-unavailable";
      else if (/could not access file "":/.test(errorText)) category = "empty-library-load-failed";
      else if (/could not access file|could not load library|could not open library/.test(errorText)) category = "library-load-failed";
      else if (/permission denied to set parameter|invalid value for parameter|unrecognized configuration parameter/.test(errorText)) {
        category = "startup-setting-rejected";
        // Only a constant from the reviewed setting-name allowlist may be emitted.
        parameter = Object.keys(startupSettings).find(name => errorText.includes('"' + name + '"')) ?? null;
      }
    } else if (/Connection refused/.test(errorText)) category = "connection-refused";
    else if (/fe_sendauth: no password supplied/.test(errorText)) category = "password-not-delivered";
    else if (/ERROR:\s+(?:[A-Z0-9]{5}:\s+)?/.test(errorText)) {
      const denied = errorText.match(/permission denied to examine "(session_preload_libraries|shared_preload_libraries)"/);
      category = denied ? "setting-inspection-denied" : "sql-execution-error";
      parameter = denied ? denied[1] : null;
    }
    else if (/GO_SCRAM_STDIN_FAILED/.test(errorText)) category = "credential-delivery-failed";
    else if (/OCI runtime exec failed|Error response from daemon|Cannot connect to the Docker daemon/.test(errorText)) category = "docker-execution-failed";
  }
  return {processState, exitCode, sqlState, category, parameter, output, credentialDelivered};
}

/** @param {(command: string, args: string[], options: {input: Buffer, timeout: number, maxBuffer: number, windowsHide: boolean}) => {status: number|null, stdout: Buffer|string|null, stderr: Buffer|string|null, error?: {code?: string}|null, signal?: string|null}} execute */
export function diagnosticScramProbe(cluster, password, execute = spawnSync) {
  return diagnosticQueryProbe(cluster,password,execute,"postgres","select current_user;");
}

/** @param {(command: string, args: string[], options: {input: Buffer, timeout: number, maxBuffer: number, windowsHide: boolean}) => {status: number|null, stdout: Buffer|string|null, stderr: Buffer|string|null, error?: {code?: string}|null, signal?: string|null}} execute */
export function diagnosticPreloadProbe(cluster, password, execute = spawnSync) {
  const database=cluster.record.database;
  if (!/^go_share_test_[a-f0-9]{32}$/.test(database)) httpFail("Invalid preload diagnostic target");
  return diagnosticQueryProbe(cluster,password,execute,database,`begin read only;
select current_user where session_user='authenticator' and current_user='authenticator'
  and go_test_diagnostics.preloads_empty() is true;
do $denials$
declare
  r text;
  n oid := 'go_test_diagnostics'::pg_catalog.regnamespace;
  f oid := 'go_test_diagnostics.preloads_empty()'::pg_catalog.regprocedure;
  q oid := 'pg_read_all_settings'::pg_catalog.regrole;
  o oid := 'go_test_preload_reader'::pg_catalog.regrole;
  error_state text;
  error_message text;
begin
  if session_user <> 'authenticator' or current_user <> 'authenticator'
    or pg_catalog.current_setting('role') <> 'none'
    or pg_catalog.has_schema_privilege(current_user,n,'USAGE') is distinct from true
    or pg_catalog.has_function_privilege(current_user,f,'EXECUTE') is distinct from true
    or exists(select 1 from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x
      where p.oid=f and x.grantee=0 and x.privilege_type='EXECUTE') then
    raise exception 'Diagnostic caller authorization not established';
  end if;
  foreach r in array array['anon','authenticated','service_role'] loop
    execute pg_catalog.format('set local role %I',r);
    if session_user <> 'authenticator' or current_user::text is distinct from r
      or pg_catalog.has_schema_privilege(current_user,n,'USAGE') is distinct from false
      or pg_catalog.has_schema_privilege(current_user,n,'CREATE') is distinct from false
      or pg_catalog.has_function_privilege(current_user,f,'EXECUTE') is distinct from false
      or pg_catalog.pg_has_role(current_user,q,'MEMBER') is distinct from false
      or pg_catalog.pg_has_role(current_user,q,'USAGE') is distinct from false
      or pg_catalog.pg_has_role(current_user,q,'SET') is distinct from false
      or pg_catalog.pg_has_role(current_user,o,'MEMBER') is distinct from false
      or pg_catalog.pg_has_role(current_user,o,'USAGE') is distinct from false
      or pg_catalog.pg_has_role(current_user,o,'SET') is distinct from false then
      raise exception 'Request-role diagnostic privileges not denied';
    end if;
    begin
      execute 'select go_test_diagnostics.preloads_empty()';
      raise exception 'Request role entered private diagnostic';
    exception when insufficient_privilege then
      get stacked diagnostics error_state=returned_sqlstate,error_message=message_text;
      if error_state is distinct from '42501'
        or error_message is distinct from 'permission denied for schema go_test_diagnostics' then
        raise exception 'Unexpected diagnostic denial boundary';
      end if;
    end;
    execute 'set local role none';
  end loop;
  if session_user <> 'authenticator' or current_user <> 'authenticator'
    or pg_catalog.current_setting('role') <> 'none' then
    raise exception 'Diagnostic session identity changed';
  end if;
end;
$denials$;
commit;`);
}

/** @param {(command: string, args: string[], options: {input: Buffer, timeout: number, maxBuffer: number, windowsHide: boolean}) => {status: number|null, stdout: Buffer|string|null, stderr: Buffer|string|null, error?: {code?: string}|null, signal?: string|null}} execute */
function diagnosticQueryProbe(cluster, password, execute, database, query) {
  cluster.verifyDatabase(); // Reuses manifest, exact container, daemon and database identity checks.
  const startup=cluster.verify();
  if (!Array.isArray(startup?.env) || !startup.env.every(v=>typeof v==="string")
    || startup.env.some(v=>/^PG(OPTIONS|SERVICE|SERVICEFILE|HOSTADDR)=/.test(v))
    || !Array.isArray(startup.cmd) || startup.cmd[0]!=="postgres"
    || !startup.cmd.every(v=>typeof v==="string")
    || startup.cmd.some(v=>/preload_libraries/.test(v)
      && !(cluster.record.startupProfile==="http-private-v1" && v===`shared_preload_libraries=${httpSharedLibraries}`))) httpFail("Diagnostic startup context refused");
  if (!/^[a-f0-9]{64}$/.test(password)) httpFail("SCRAM diagnostic credential shape invalid");
  cluster.privacySecrets?.push(password);
  const digest = createHash("sha256").update(password).digest("hex");
  const input = Buffer.from(password + "\n" + digest + "\n" + query + "\n", "utf8");
  // A digest travels only on stdin and is compared in memory, never printed or persisted.
  const shell = `IFS= read -r PGPASSWORD && IFS= read -r expected && actual=$(printf '%s' "$PGPASSWORD" | sha256sum) && [ "\${actual%% *}" = "$expected" ] || { printf 'GO_SCRAM_STDIN_FAILED\\n' >&2; exit 90; }; unset expected actual; printf '${deliveryMarker}\\n' >&2; export PGPASSWORD; LC_ALL=C; export LC_ALL; exec psql -X -qAt -w -v VERBOSITY=verbose -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U authenticator -d '${database}' -f -`;
  let result;
  try {
    result = execute("docker", ["exec", "-i", cluster.record.containerId, "sh", "-c", shell],
      {input, timeout:180_000, maxBuffer:1024 * 1024, windowsHide:true});
    return classifyScramProcess(result);
  } finally {
    input.fill(0);
    for (const value of [result?.stdout, result?.stderr]) if (Buffer.isBuffer(value)) value.fill(0);
  }
}

export function inspectScramRole(cluster) {
  cluster.verifyDatabase();
  const expected = Object.entries(startupSettings).map(([name,value]) => `(${literal(name)},${literal(value)})`).join(",");
  const role = JSON.parse(cluster.rawSql("postgres", `begin read only;
    with expected(name,value) as (values ${expected}),
    settings as (select s.setdatabase,s.setrole,split_part(v,'=',1) name,substr(v,position('=' in v)+1) value
      from pg_db_role_setting s cross join lateral unnest(s.setconfig) v
      where s.setrole in (0,(select oid from pg_roles where rolname='authenticator'))
      and s.setdatabase in (0,(select oid from pg_database where datname='postgres'),(select oid from pg_database where datname=${literal(cluster.record.database)})))
    select json_build_object(
      'loginEnabled',r.rolcanlogin,'connectionLimit',r.rolconnlimit,
      'activeConnections',(select count(*) from pg_stat_activity where usename='authenticator'),
      'validUntil',case when r.rolvaliduntil is null then null when r.rolvaliduntil='infinity' then 'infinity'
        when r.rolvaliduntil='-infinity' then '-infinity' else to_char(r.rolvaliduntil at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
      'scramVerifierConfigured',(select coalesce(rolpassword like 'SCRAM-SHA-256$%',false) from pg_authid where rolname='authenticator'),
      'databases',(select json_agg(json_build_object('target',case when datname='postgres' then 'postgres' else 'disposable' end,
        'allowConnections',datallowconn,'connectPrivilege',has_database_privilege('authenticator',oid,'CONNECT'),
        'connectionLimit',datconnlimit,'activeConnections',(select count(*) from pg_stat_activity a where a.datid=d.oid)) order by datname)
        from pg_database d where datname in ('postgres',${literal(cluster.record.database)})),
      'unlistedSettingCount',(select count(*) from settings s where not exists(select 1 from expected e where e.name=s.name)),
      'settings',coalesce((select json_agg(json_build_object('name',e.name,
        'scope',case when s.setrole=0 then 'database' when s.setdatabase=0 then 'role' when s.setdatabase=(select oid from pg_database where datname='postgres') then 'role-postgres' else 'role-disposable' end,
        'matchesBootstrap',s.value=e.value,'recognized',g.name is not null,'context',g.context,
        'canSet',case when g.name is null then null else has_parameter_privilege('authenticator',e.name,'SET') end) order by e.name,s.setdatabase,s.setrole)
        from settings s join expected e on e.name=s.name left join pg_settings g on g.name=e.name),'[]'::json)
    ) from pg_roles r where r.rolname='authenticator';commit;`));
  // Reject malformed/unallowlisted output before any catalog result is logged.
  if (!exactKeys(role,["loginEnabled","connectionLimit","activeConnections","validUntil","scramVerifierConfigured","databases","unlistedSettingCount","settings"])
    || typeof role.loginEnabled !== "boolean" || typeof role.scramVerifierConfigured !== "boolean"
    || ![role.connectionLimit,role.activeConnections,role.unlistedSettingCount].every(Number.isSafeInteger)
    || !(role.validUntil === null || ["infinity","-infinity"].includes(role.validUntil) || /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(role.validUntil))
    || !Array.isArray(role.databases) || role.databases.length !== 2
    || role.databases.some(d => !exactKeys(d,["target","allowConnections","connectPrivilege","connectionLimit","activeConnections"])
      || !["postgres","disposable"].includes(d.target) || typeof d.allowConnections !== "boolean" || typeof d.connectPrivilege !== "boolean"
      || ![d.connectionLimit,d.activeConnections].every(Number.isSafeInteger))
    || !Array.isArray(role.settings) || role.settings.some(s => !exactKeys(s,["name","scope","matchesBootstrap","recognized","context","canSet"])
      || !Object.hasOwn(startupSettings,s.name) || !["database","role","role-postgres","role-disposable"].includes(s.scope)
      || typeof s.matchesBootstrap !== "boolean" || typeof s.recognized !== "boolean"
      || !(s.context === null || ["internal","postmaster","sighup","superuser-backend","backend","superuser","user"].includes(s.context))
      || !(s.canSet === null || typeof s.canSet === "boolean"))) httpFail("SCRAM role diagnostics unavailable");
  return role;
}

export function assertDiagnosticScramControls(negative, positive) {
  if (negative.processState !== "completed" || !negative.credentialDelivered || !(negative.exitCode > 0)
    || negative.category !== "password-authentication-rejected") httpFail("Diagnostic negative-password rejection not established");
  if (positive.processState !== "completed" || positive.exitCode !== 0 || !positive.credentialDelivered
    || positive.category !== "expected-identity" || positive.output !== "expected-identity") httpFail("Diagnostic positive-password authenticator login failed");
}

export function runScramDiagnostics(cluster, password) {
  const role = inspectScramRole(cluster);
  const negative = diagnosticScramProbe(cluster,randomBytes(32).toString("hex"));
  const positive = diagnosticScramProbe(cluster,password);
  return {role,negative,positive};
}

export function assertInstallerAuthority(cluster) {
  cluster.verifyDatabase();
  const value=cluster.rawSql(cluster.record.database,`begin read only;
    select session_user='supabase_admin' and current_user='supabase_admin'
      and pg_catalog.current_setting('role',true)='none'
      and pg_catalog.current_setting('server_version_num')::int/10000=17
      and exists(select 1 from pg_catalog.pg_roles where rolname=current_user
        and rolsuper and rolcreaterole and rolcanlogin)
      and pg_catalog.current_database()=${literal(cluster.record.database)}
      and (select pg_catalog.shobj_description(oid,'pg_database')
        from pg_catalog.pg_database where datname=pg_catalog.current_database())=${literal(cluster.record.marker)}
      and not exists(select 1 from pg_catalog.pg_roles where rolname='go_test_preload_reader')
      and not exists(select 1 from pg_catalog.pg_namespace where nspname='go_test_diagnostics');
    commit;`);
  if(typeof value!=="string" || value.trim()!=="t") httpFail("Diagnostic installer authority not established");
}

export function assertPreloadCatalog(cluster) {
  cluster.verifyDatabase();
  const value=cluster.rawSql("postgres",`begin read only;
    with roles as (select oid from pg_roles where rolname in ('authenticator','anon','authenticated','service_role')),
    names(name) as (values ('session_preload_libraries'),('local_preload_libraries'))
    select (select count(*) from roles)=4
      and not exists(select 1 from roles r cross join names n where
        (select count(*) from pg_db_role_setting s cross join lateral unnest(s.setconfig) v
          where s.setrole=r.oid and s.setdatabase=0 and v=n.name||'=')<>1)
      and not exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig) v
        where s.setrole in (0, (select oid from pg_roles where rolname='authenticator'),
          (select oid from pg_roles where rolname='anon'),(select oid from pg_roles where rolname='authenticated'),
          (select oid from pg_roles where rolname='service_role'))
        and s.setdatabase in (0,(select oid from pg_database where datname='postgres'),
          (select oid from pg_database where datname=${literal(cluster.record.database)}))
        and split_part(v,'=',1) in (select name from names)
        and (s.setrole=0 or s.setdatabase<>0 or v<>split_part(v,'=',1)||'='));
    commit;`).trim();
  if(value!=="t") httpFail("Eight empty preload catalog entries not established");
}

export function scramSecurityFingerprint(cluster, includeDiagnostics=true) {
  if(typeof includeDiagnostics!=="boolean") httpFail("Invalid SCRAM fingerprint scope");
  cluster.verifyDatabase();
  const value=cluster.rawSql(cluster.record.database,`begin read only;
    select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.oid) from pg_catalog.pg_authid r where ${includeDiagnostics?"true":"r.rolname<>'go_test_preload_reader'"}),
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.oid) from pg_catalog.pg_auth_members m where ${includeDiagnostics?"true":"m.member not in (select oid from pg_catalog.pg_roles where rolname='go_test_preload_reader')"}),
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) order by s.setdatabase,s.setrole) from pg_catalog.pg_db_role_setting s),
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(d.oid,d.datname,d.datdba,d.datallowconn,d.datconnlimit,d.datacl)
        order by d.oid) from pg_catalog.pg_database d),
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.oid) from pg_catalog.pg_parameter_acl p),
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(h) order by h.rule_number) from pg_catalog.pg_hba_file_rules h),
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) order by f.seqno) from pg_catalog.pg_file_settings f),
      pg_catalog.pg_read_file(pg_catalog.current_setting('hba_file')),
${includeDiagnostics?`      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(n) order by n.oid) from pg_catalog.pg_namespace n where n.nspname='go_test_diagnostics'),
      (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.oid) from pg_catalog.pg_proc p
        where p.pronamespace=(select oid from pg_catalog.pg_namespace where nspname='go_test_diagnostics'))`:"      null,null"}
    )::text,'UTF8')),'hex')
    where (select count(*) from pg_catalog.pg_hba_file_rules)=4
      and not exists(select 1 from pg_catalog.pg_hba_file_rules where error is not null)
      and exists(select 1 from pg_catalog.pg_file_settings)
      and not exists(select 1 from pg_catalog.pg_file_settings f where f.error is not null
        and not (${cluster.record.startupProfile==="http-private-v1"?"true":"false"}
          and f.name='shared_preload_libraries' and f.error='setting could not be applied'
          and exists(select 1 from pg_catalog.pg_settings g where g.name=f.name
            and g.source='command line' and g.setting=${literal(httpSharedLibraries)})))
${includeDiagnostics?"      and exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('go_test_diagnostics.preloads_empty()'))":""};
    commit;`);
  if(typeof value!=="string" || !/^[a-f0-9]{64}$/.test(value.trim())) httpFail("SCRAM security fingerprint unavailable");
  return value.trim(); // Only the digest leaves the administrative session.
}
