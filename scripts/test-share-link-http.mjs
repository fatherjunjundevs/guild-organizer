// Actual HTTP security validation, exclusively in independently owned test resources.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createIsolatedCluster, literal, safeError } from "./isolated-postgres-test-cluster.mjs";
import { createHttpService, verifyLocalHttpImage } from "./isolated-postgrest-test-service.mjs";
import { prepareShareLinkTestDatabase } from "./share-link-test-database.mjs";
import { loadShareLinkTestModules } from "./load-share-link-test-modules.mjs";
import { signTestJwt, exactKeys, httpFail } from "./postgrest-http-contract.mjs";
import { runScramDiagnostics, assertDiagnosticScramControls, diagnosticPreloadProbe, assertPreloadCatalog, scramSecurityFingerprint, assertInstallerAuthority } from "./scram-probe-diagnostics.mjs";
import { installHttpPrivacy, assertHttpPrivacy, inspectPostgresLogs, assertPostgrestConnections } from "./http-postgres-privacy.mjs";

const actor="6f000000-0000-4000-8000-000000000001", member="6f000000-0000-4000-8000-000000000002";
const guild="6f100000-0000-4000-8000-000000000001", event="6f500000-0000-4000-8000-000000000001";
const link=n=>`6f800000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const credentialCases=[{name:"anonymous",role:"anon",signed:false,uid:null},{name:"signed anon",role:"anon",signed:true,uid:null},
  {name:"authenticated",role:"authenticated",signed:true,uid:actor},{name:"service role",role:"service_role",signed:true,uid:null}];
export function denialCases(token) {
  return credentialCases.flatMap(caller=>["GET","HEAD","POST"].flatMap(method=>[token,`v1.${randomBytes(32).toString("base64url")}`,"malformed"].map(value=>
    ({caller,method,value,expected:{kind:"denied",method,status:caller.role==="anon"?401:403}}))));
}
export function assertInternalRows(rows,{name="HTTP published event",version=1,empty=false}={}) {
  if(!Array.isArray(rows) || rows.length!==(empty?0:1))httpFail("Internal resolver availability mismatch");
  if(!empty && (!exactKeys(rows[0],["event_name","event_type_name","version_number","published_at"])
    ||rows[0].event_name!==name||rows[0].event_type_name!=="HTTP League"||rows[0].version_number!==version
    ||!Number.isFinite(Date.parse(rows[0].published_at))))httpFail("Internal resolver metadata/privacy mismatch");
}
export function installHttpBootstrap(cluster) {
  cluster.verifyDatabase();
  const password=randomBytes(32).toString("hex");
  cluster.sql(cluster.record.database,readFileSync(new URL("./sql/event-share-link-http-bootstrap.sql",import.meta.url),"utf8"),"supabase_admin");
  cluster.rawSql("postgres",`set log_statement='none'; set log_min_error_statement='panic';set log_parameter_max_length=0;set log_parameter_max_length_on_error=0;set password_encryption='scram-sha-256';alter role authenticator password ${literal(password)};`);
  const allowed=cluster.rawSql("postgres","select not rolinherit and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication from pg_roles where rolname='authenticator';select pg_has_role('authenticator','anon','SET') and pg_has_role('authenticator','authenticated','SET') and pg_has_role('authenticator','service_role','SET');").trim();
  if(allowed.replaceAll("\r","")!=="t\nt")httpFail("HTTP authenticator authority mismatch");
  // Real negative and positive SCRAM controls: no password in argv/environment config.
  const probe=value=>cluster.verify() && import("./isolated-postgres-test-cluster.mjs").then(({ownedDocker})=>
    ownedDocker(["exec","-i",cluster.record.containerId,"sh","-c","IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -qAt -w -h 127.0.0.1 -U authenticator -d postgres -c 'select current_user'"],value+"\n",true));
  return {password,probe};
}
export async function runHttpValidation({diagnosticOnly=false}={}) {
  // This is intentionally blocked until binary provenance can be established.
  verifyLocalHttpImage();
  let cluster=null, failed=false, httpAssertions=0, internalAssertions=0;
  const secrets=[];
  try {
    cluster=await createIsolatedCluster({httpPrivacy:!diagnosticOnly});await cluster.start();
    secrets.push(cluster.password);
    const database=cluster.record.database;
    const sql=(input,user="postgres")=>cluster.sql(database,input,user);
    const prepared=prepareShareLinkTestDatabase(cluster);
    if(sql("select (select count(*) from auth.users)+(select count(*) from public.guilds);").trim()!=="0")httpFail("HTTP target contains pre-existing records");
    const {password,probe}=installHttpBootstrap(cluster);
    secrets.push(password);
    // Read-only diagnostics use the verified owned cluster; never select secret fields.
    cluster.verifyDatabase();
    const diagnostics=JSON.parse(cluster.rawSql("postgres",`begin read only;
      select json_build_object(
        'loginEnabled', (select rolcanlogin from pg_roles where rolname='authenticator'),
        'connectPostgres', has_database_privilege('authenticator','postgres','CONNECT'),
        'connectDisposable', has_database_privilege('authenticator',${literal(database)},'CONNECT'),
        'accountExpired', (select coalesce(rolvaliduntil < current_timestamp,false) from pg_roles where rolname='authenticator'),
        'loopbackScramVerified',
          not exists(select 1 from pg_hba_file_rules where error is not null)
          and (select count(*) from pg_hba_file_rules)=4
          and exists(select 1 from pg_hba_file_rules where rule_number=2 and type='host'
            and database=array['all']::text[] and user_name=array['all']::text[]
            and address='127.0.0.1' and netmask='255.255.255.255' and auth_method='scram-sha-256')
          and pg_read_file(current_setting('hba_file'))=E'local all all trust\nhost all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n'
          and pg_conf_load_time() >= (pg_stat_file(current_setting('hba_file'))).modification
      );commit;`));
    if(!exactKeys(diagnostics,["loginEnabled","connectPostgres","connectDisposable","accountExpired","loopbackScramVerified"])
      || ["loginEnabled","connectPostgres","connectDisposable","loopbackScramVerified"].some(k=>typeof diagnostics[k]!=="boolean")
      || (diagnostics.accountExpired!==null && typeof diagnostics.accountExpired!=="boolean"))httpFail("HTTP SCRAM diagnostics unavailable");
    if(diagnosticOnly){
      if (["loginEnabled","connectPostgres","connectDisposable","loopbackScramVerified"].some(k=>diagnostics[k]!==true)
        || diagnostics.accountExpired!==false) httpFail("Diagnostic connection policy not established");
      assertInstallerAuthority(cluster);
      const installationBefore=scramSecurityFingerprint(cluster,false);
      cluster.sql(database,readFileSync(new URL("./sql/scram-preload-inspection.sql",import.meta.url),"utf8"),"supabase_admin");
      assertPreloadCatalog(cluster);
      if(scramSecurityFingerprint(cluster,false)!==installationBefore) httpFail("Installer changed existing SCRAM policy");
      const securityBefore=scramSecurityFingerprint(cluster);
      const report=runScramDiagnostics(cluster,password);
      console.log("SCRAM diagnostic-only result: "+JSON.stringify({runId:cluster.record.runId,probeDatabase:"postgres",hba:diagnostics,...report}));
      assertDiagnosticScramControls(report.negative,report.positive);
      const effective=diagnosticPreloadProbe(cluster,password);
      console.log("Fresh disposable authenticator preload result: "+JSON.stringify(effective));
      assertDiagnosticScramControls(report.negative,effective);
      assertPreloadCatalog(cluster);
      if(scramSecurityFingerprint(cluster)!==securityBefore) httpFail("SCRAM security policy changed during probes");
      console.log("Diagnostic-only probes passed; stopping before HTTP fixtures or sidecar creation.");
      return;
    }
    // Run both controls independently; neither result can short-circuit the other.
    const invalidPassword=randomBytes(32).toString("hex");secrets.push(invalidPassword);
    const wrongPasswordAccepted=await probe(invalidPassword)!==null;
    const correctPasswordAuthenticated=(await probe(password))?.trim()==="authenticator";
    const yesNo=value=>value?"YES":"NO";
    console.log(`Wrong password unexpectedly accepted: ${yesNo(wrongPasswordAccepted)}`);
    console.log(`Correct password successfully authenticated as authenticator: ${yesNo(correctPasswordAuthenticated)}`);
    console.log("Probe database target: postgres");
    console.log(`Authenticator LOGIN enabled: ${yesNo(diagnostics.loginEnabled)}`);
    console.log(`Authenticator connection permitted to postgres database: ${yesNo(diagnostics.connectPostgres)}`);
    console.log(`Authenticator connection permitted to disposable test database: ${yesNo(diagnostics.connectDisposable)}`);
    console.log(`Authenticator account expired: ${diagnostics.accountExpired===null?"UNKNOWN":yesNo(diagnostics.accountExpired)}`);
    console.log(`Effective loopback HBA SCRAM configuration verified: ${yesNo(diagnostics.loopbackScramVerified)}`);
    if(wrongPasswordAccepted)httpFail("HTTP SCRAM negative-password control failed: wrong password unexpectedly accepted");
    if(!correctPasswordAuthenticated)httpFail("HTTP SCRAM positive-password control failed: correct password did not authenticate as authenticator");
    installHttpPrivacy(cluster,password);
    console.log("Pre-token PostgreSQL privacy: "+JSON.stringify(inspectPostgresLogs(cluster,secrets)));
    sql(readFileSync(new URL("./sql/event-share-link-http-fixtures.sql",import.meta.url),"utf8"));
    const modules=loadShareLinkTestModules(), key=randomBytes(32), jwtKey=randomBytes(32), aesKey=randomBytes(32);
    secrets.push(...[key,jwtKey,aesKey].flatMap(b=>[b.toString("hex"),b.toString("base64")]));
    const recovery=modules.config.loadShareLinkRecoveryConfig({APP_ENV:"local",APP_ORIGIN:"http://127.0.0.1:3000",SHARE_LINK_RECOVERY_KEY_ID:"http_aes",
      SHARE_LINK_RECOVERY_KEYS_JSON:JSON.stringify({http_aes:aesKey.toString("base64")})});
    const provisioning=new modules.config.ShareLinkProvisioningConfig("http_test",key);
    cluster.sql(database,`insert into private.event_share_link_provisioning_keys values('http_test',decode('${key.toString("hex")}','hex'),clock_timestamp()-interval '1 minute',null);`,"supabase_admin");
    const actorSql=input=>sql(`begin;set local role authenticated;set local request.jwt.claim.sub=${literal(actor)};${input};commit;`);
    function provision(operation,n,previous=null){
      const identity={guildId:guild,eventId:event,linkId:link(n)};
      const envelope=modules.crypto.createShareLinkEnvelope(identity,recovery);
      const proof=modules.crypto.signShareLinkProvisioning({...identity,operation,actorId:actor,previousLinkId:previous,envelope},provisioning);
      const args=[guild,event,...(previous?[previous]:[]),identity.linkId,envelope.digest,...[envelope.ciphertext,envelope.nonce,envelope.authTag].map(modules.crypto.toShareBytea),envelope.encryptionKeyId,proof.keyId,proof.expiresAt,modules.crypto.toShareBytea(proof.mac)];
      actorSql(`select public.${operation}_event_share_link(${args.map(literal).join(",")})`);
      const token=modules.crypto.recoverShareToken(identity,envelope,recovery);
      secrets.push(token);return token;
    }
    const first=provision("create",1);
    const service=await createHttpService(cluster);
    await service.start({password,jwtSecret:jwtKey.toString("hex")});
    const jwt=caller=>{const value=caller.signed?signTestJwt(jwtKey,caller.role,caller.uid):null;if(value)secrets.push(value);return value;};
    const send=async(input)=>{const result=await service.request(input);httpAssertions++;return result;};
    const identities=async()=>{
      // Each actual pool session independently proves safe logging and claim reset.
      const callers=[...credentialCases,{name:"other user",role:"authenticated",signed:true,uid:member}];
      const results=await service.requestBatch(Array.from({length:10},(_,i)=>{
        const caller=callers[i%callers.length];return {method:"POST",rpc:"go_http_test_identity",args:{p_hold_ms:100},jwt:jwt(caller),
          expected:{kind:"identity",status:200,role:caller.role,uid:caller.uid}};
      }));
      httpAssertions+=results.length;
      const pids=[...new Set(results.map(r=>r.backendPid))];
      if(pids.length!==2)httpFail("Both bounded HTTP pool connections were not verified");
      assertPostgrestConnections(cluster,pids);
    };
    await identities(); // Must precede every token-bearing GET/HEAD control.
    assertHttpPrivacy(cluster);
    console.log("Gate B pre-token pool/server privacy: "+JSON.stringify(inspectPostgresLogs(cluster,secrets)));
    for(const caller of credentialCases){
      for(const method of ["GET","HEAD","POST"]){
        const expected=caller.role==="service_role"?{kind:"denied",status:403,method}:
          {kind:"projection",status:200,method,eventName:"HTTP published event",version:1};
        await send({method,rpc:"resolve_event_share_link",args:{p_token:first},jwt:jwt(caller),expected});
      }
    }
    console.log("Pre-migration HTTP controls passed; service role correctly denied under earlier grants.");
    prepared.applyBoundary();
    const permissions=sql(`select not has_function_privilege('anon','public.resolve_event_share_link(text)','EXECUTE')
      and not has_function_privilege('authenticated','public.resolve_event_share_link(text)','EXECUTE')
      and not has_function_privilege('service_role','public.resolve_event_share_link(text)','EXECUTE')
      and has_function_privilege('go_event_share_resolver','public.resolve_event_share_link(text)','EXECUTE')
      and not exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.oid='public.resolve_event_share_link(text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE')
      and not pg_has_role('authenticator','go_event_share_resolver','SET')
      and not pg_has_role('anon','go_event_share_resolver','SET')
      and not pg_has_role('authenticated','go_event_share_resolver','SET')
      and not pg_has_role('service_role','go_event_share_resolver','SET');`).trim();
    if(permissions!=="t")httpFail("Post-migration effective resolver authorization mismatch");
    const matrix=async(label)=>{
      await identities();
      for(const c of denialCases(first))await send({method:c.method,rpc:"resolve_event_share_link",args:{p_token:c.value},jwt:jwt(c.caller),expected:c.expected});
      console.log(`HTTP ${label}: 36 resolver permission assertions passed (401/403, PostgreSQL 42501).`);
    };
    await matrix("immediately after committed migration");
    const generation=randomBytes(4).toString("hex"),rpc=`go_http_cache_${generation}`;
    sql(`create function public.${rpc}() returns integer language sql immutable security invoker set search_path='' as 'select 1';revoke all on function public.${rpc}() from public;grant execute on function public.${rpc}() to anon,authenticated,service_role;`);
    sql("notify pgrst,'reload schema';");
    await matrix("after reload request");
    const deadline=Date.now()+15000;
    let completed=false;
    while(Date.now()<deadline){
      try{await send({method:"POST",rpc,args:{},expected:{kind:"cache",status:200,generation:1}});completed=true;break;}
      catch{await new Promise(resolve=>setTimeout(resolve,100));}
    }
    if(!completed)httpFail("Schema reload completion was not proven");
    await matrix("after verified reload completion");
    await service.restart();await matrix("after cold PostgREST process restart");
    // Parser/JWT/role-switch errors are classified separately and never count as resolver denials.
    await send({method:"POST",rpc:"resolve_event_share_link",rawBody:"{",jwt:jwt(credentialCases[2]),expected:{kind:"error",status:400,code:"PGRST102"}});
    await send({method:"POST",rpc:"go_http_test_identity",args:{},jwt:"invalid.jwt.token",expected:{kind:"error",status:401,code:"PGRST301"}});
    const escalation=signTestJwt(jwtKey,"go_event_share_resolver");
    secrets.push(escalation);
    await send({method:"POST",rpc:"go_http_test_identity",args:{},jwt:escalation,expected:{kind:"error",status:403,code:"42501"}});
    // Direct internal SQL role only; authenticator never receives resolver membership.
    const internal=(token,expected={})=>{
      const output=sql(`set session authorization go_event_share_resolver;select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.resolve_event_share_link(${literal(token)}) r;reset session authorization;`,"supabase_admin");
      let rows;try{rows=JSON.parse(output.trim());}catch{httpFail("Internal resolver returned an unexpected wire shape");}
      assertInternalRows(rows,expected);internalAssertions++;return rows;
    };
    const sealed=internal(first);
    // Preserve integrity triggers. A private unsealed candidate and a missing
    // version cannot become current; the previously sealed version stays current.
    sql(`begin;
      insert into public.event_publication_versions(id,guild_id,event_id,publication_id,version_number,source_event_type_id,
        source_template_id,event_name_snapshot,event_type_name_snapshot,template_name_snapshot,uses_areas,created_by)
      select '6f710000-0000-4000-8000-000000000001',v.guild_id,v.event_id,v.publication_id,999,v.source_event_type_id,
        v.source_template_id,'PRIVATE_HTTP_UNSEALED_CANARY',v.event_type_name_snapshot,v.template_name_snapshot,v.uses_areas,v.created_by
      from public.event_publication_versions v join public.event_publications p on p.current_version_id=v.id
      where p.event_id=${literal(event)};
      do $guard$ begin
        begin update public.event_publications set current_version_id='6f710000-0000-4000-8000-000000000001' where event_id=${literal(event)};
          raise exception 'Unsealed pointer unexpectedly accepted'; exception when check_violation then null; end;
        begin update public.event_publications set current_version_id='6f710000-0000-4000-8000-000000000002' where event_id=${literal(event)};
          raise exception 'Missing pointer unexpectedly accepted'; exception when check_violation then null; end;
      end $guard$;
      rollback;`,"supabase_admin");
    if(JSON.stringify(internal(first))!==JSON.stringify(sealed))httpFail("Unsealed/unavailable version changed resolver metadata");
    internal(`v1.${randomBytes(32).toString("base64url")}`,{empty:true});internal("malformed",{empty:true});
    sql(`update public.events set name='HTTP revised event',description='PRIVATE_HTTP_DRAFT_CHANGED_CANARY' where id=${literal(event)};`);
    if(JSON.stringify(internal(first))!==JSON.stringify(sealed))httpFail("Draft mutation changed sealed resolver metadata");
    // Concurrent HTTP denial is invariant on both sides of each commit; existing
    // SQL suites retain the successful internal-resolution snapshot race coverage.
    const concurrentDenials=async(token,label)=>{
      const commands=credentialCases.flatMap(caller=>["GET","HEAD","POST"].map(method=>({method,rpc:"resolve_event_share_link",
        args:{p_token:token},jwt:jwt(caller),expected:{kind:"denied",status:caller.role==="anon"?401:403,method}})));
      const results=await service.requestBatch(commands);httpAssertions+=results.length;
      console.log(`HTTP ${label}: ${results.length} concurrent permission assertions passed.`);
    };
    // Request/commit overlap is not assumed. Permission denial is required for
    // every response regardless of its statement snapshot; existing SQL races
    // separately verify successful internal resolution across those snapshots.
    await identities();
    const beforeRotate=concurrentDenials(first,"rotation batch");
    const second=provision("rotate",2,link(1));await beforeRotate;
    await concurrentDenials(first,"completed rotation old-token batch");
    internal(first,{empty:true});internal(second);
    actorSql(`select public.unpublish_event(${literal(event)})`);internal(second,{empty:true});
    actorSql(`select public.publish_event(${literal(event)})`);internal(second,{name:"HTTP revised event",version:2});
    sql(`update public.events set status='archived' where id=${literal(event)};`);internal(second,{empty:true});
    sql(`update public.events set status='active' where id=${literal(event)};update public.guilds set status='archived' where id=${literal(guild)};`);internal(second,{empty:true});
    sql(`update public.guilds set status='active' where id=${literal(guild)};`);
    await identities();
    const beforeRevoke=concurrentDenials(second,"revocation batch");
    actorSql(`select public.revoke_event_share_link(${literal(guild)},${literal(event)},${literal(link(2))})`);await beforeRevoke;internal(second,{empty:true});
    await concurrentDenials(second,"completed revocation batch");
    // Existing management authorization remains reachable through the actual HTTP pool.
    await send({method:"POST",rpc:"get_event_share_link_management_state",args:{p_guild_id:guild,p_event_id:event},jwt:jwt(credentialCases[2]),
      expected:{kind:"management",status:200,state:"revoked"}});
    console.log(`HTTP assertions: ${httpAssertions}; internal resolver assertions: ${internalAssertions}.`);
    assertHttpPrivacy(cluster);
  }catch(error){failed=true;console.error(safeError(error));}
  finally{
    if(cluster){
      if(cluster.httpService) {
        try{await cluster.httpService.close();}
        catch(error){failed=true;console.error(safeError(error));}
      }
      if(cluster.record.startupProfile==="http-private-v1" && cluster.record.phase==="ready") {
        try{console.log("Complete PostgreSQL log privacy: "+JSON.stringify(inspectPostgresLogs(cluster,secrets)));}
        catch(error){failed=true;console.error(safeError(error));}
      }
      try{await cluster.cleanup();console.log("Verified HTTP sidecar and PostgreSQL cluster removed.");}
      catch(error){failed=true;console.error(safeError(error));console.error(`Exact-run recovery required: ${cluster.record.runId}`);}}
  }
  if(failed)process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length>1 || (args.length===1 && args[0]!=="--diagnose-scram")){
    console.error("Usage: node scripts/test-share-link-http.mjs [--diagnose-scram]");process.exitCode=1;
  }else runHttpValidation({diagnosticOnly:args.length===1}).catch(error=>{console.error(safeError(error));process.exitCode=1;});
}
