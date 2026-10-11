// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { classifyScramProcess, diagnosticScramProbe, assertDiagnosticScramControls, inspectScramRole, diagnosticPreloadProbe, assertInstallerAuthority, scramSecurityFingerprint } from "../../scripts/scram-probe-diagnostics.mjs";

const runnerMocks=vi.hoisted(()=>({create:vi.fn(),image:vi.fn(),sidecar:vi.fn(),prepare:vi.fn(),diagnostics:vi.fn(),preloads:vi.fn()}));
vi.mock("../../scripts/isolated-postgres-test-cluster.mjs",async importOriginal=>({
  ...await importOriginal<typeof import("../../scripts/isolated-postgres-test-cluster.mjs")>(),createIsolatedCluster:runnerMocks.create,
}));
vi.mock("../../scripts/isolated-postgrest-test-service.mjs",()=>({createHttpService:runnerMocks.sidecar,verifyLocalHttpImage:runnerMocks.image}));
vi.mock("../../scripts/share-link-test-database.mjs",()=>({prepareShareLinkTestDatabase:runnerMocks.prepare}));
vi.mock("../../scripts/scram-probe-diagnostics.mjs",async importOriginal=>{
  const actual=await importOriginal<typeof import("../../scripts/scram-probe-diagnostics.mjs")>();
  runnerMocks.preloads.mockImplementation(actual.diagnosticPreloadProbe);
  return {...actual,runScramDiagnostics:runnerMocks.diagnostics,diagnosticPreloadProbe:runnerMocks.preloads};
});
import { runHttpValidation } from "../../scripts/test-share-link-http.mjs";

afterEach(()=>{vi.restoreAllMocks();process.exitCode=undefined;});

const marker="GO_SCRAM_STDIN_MATCH\n";
const secret="synthetic-password JWT.secret SCRAM-SHA-256$synthetic-verifier";
const result=(status=0,stdout="authenticator\n",stderr=marker)=>({status,stdout,stderr,error:null,signal:null});
const negative=()=>classifyScramProcess(result(2,"",marker+'FATAL: password authentication failed for user "authenticator"\n'));
const positive=()=>classifyScramProcess(result());

describe("safe SCRAM process classification",()=>{
  it("retains four explicit empty preload defaults and the existing privacy boundary",()=>{
    const bootstrap=readFileSync(new URL("../../scripts/sql/event-share-link-http-bootstrap.sql",import.meta.url),"utf8");
    const logging=bootstrap.split("do $logging$")[1].split("$logging$;")[0];
    const loop="foreach r in array array['authenticator','anon','authenticated','service_role'] loop";
    for(const name of ["session_preload_libraries","local_preload_libraries"]){
      expect(logging.indexOf(`perform pg_catalog.set_config('${name}', '', true);`)).toBeGreaterThan(-1);
      expect(logging.indexOf(`perform pg_catalog.set_config('${name}', '', true);`)).toBeLessThan(logging.indexOf(loop));
      expect(logging).toContain(`execute format('alter role %I set ${name} from current', r);`);
      expect(bootstrap).not.toMatch(new RegExp(`alter role %I set ${name} = %L`));
    }
    expect(logging).toContain(loop);
    const privacy=readFileSync(new URL("../../scripts/sql/http-privacy-inspection.sql",import.meta.url),"utf8");
    expect(bootstrap).toContain("and go_test_privacy.preloads_safe() is true");
    expect(privacy).toContain("and pg_catalog.current_setting('shared_preload_libraries') !~ '(pgaudit|auto_explain)'");
    expect(bootstrap).toContain("language plpgsql stable security invoker set search_path='' as $identity$");
    expect(bootstrap).not.toMatch(/security definer|go_http_test_preload_state|alter role[^;]* reset|grant set on parameter/i);
  });
  it("recognizes exact identity and password rejection without relaxing controls",()=>{
    expect(positive()).toMatchObject({processState:"completed",exitCode:0,category:"expected-identity",output:"expected-identity",credentialDelivered:true});
    expect(negative()).toMatchObject({processState:"completed",exitCode:2,category:"password-authentication-rejected",sqlState:null});
    expect(()=>assertDiagnosticScramControls(negative(),positive())).not.toThrow();
    expect(()=>assertDiagnosticScramControls(positive(),positive())).toThrow(/negative/);
    expect(()=>assertDiagnosticScramControls(negative(),negative())).toThrow(/positive/);
  });
  it.each([
    ['FATAL: 58P01: could not access file "": No such file or directory',"empty-library-load-failed","58P01",null],
    ['FATAL: could not access file "": No such file or directory',"empty-library-load-failed",null,null],
    ['FATAL: 58P01: could not load library "/synthetic/private-library"',"library-load-failed","58P01",null],
    ['FATAL: could not access file "/synthetic/private-library": No such file or directory',"library-load-failed",null,null],
    ['ERROR: 42501: permission denied to examine "session_preload_libraries"',"setting-inspection-denied","42501","session_preload_libraries"],
    ['ERROR: 42501: permission denied to examine "shared_preload_libraries"',"setting-inspection-denied","42501","shared_preload_libraries"],
    ['ERROR: 42501: permission denied to examine "/synthetic/private-library"',"sql-execution-error","42501",null],
  ])("suppresses library and inspection details for %s",(stderr,category,sqlState,parameter)=>{
    const classified=classifyScramProcess(result(2,"",marker+stderr+"\n"+secret));
    expect(classified).toMatchObject({category,sqlState,parameter,output:"empty"});
    expect(JSON.stringify(classified)).not.toContain(secret);
    expect(JSON.stringify(classified)).not.toContain("/synthetic/private-library");
    expect(()=>assertDiagnosticScramControls(negative(),classified)).toThrow(/positive/);
    expect(()=>assertDiagnosticScramControls(classified,positive())).toThrow(/negative/);
  });
  it.each([
    ["ENOENT","spawn-failed"],["ETIMEDOUT","timed-out"],["EPIPE","process-error"],
  ])("distinguishes %s from authentication rejection",(code,category)=>{
    const classified=classifyScramProcess({...result(),status:null,error:{code,message:secret}});
    expect(classified).toMatchObject({processState:category,category,exitCode:null,sqlState:null});
    expect(JSON.stringify(classified)).not.toContain(secret);
    expect(()=>assertDiagnosticScramControls(classified,positive())).toThrow(/negative/);
  });
  it.each([
    ['FATAL: 28P01: password authentication failed for user "authenticator"',"password-authentication-rejected","28P01"],
    ['FATAL: too many connections for role "authenticator"',"role-connection-limit",null],
    ['FATAL: permission denied for database postgres',"database-connect-denied",null],
    ['FATAL: role "authenticator" is not permitted to log in',"role-login-disabled",null],
    ['FATAL: too many connections for database postgres',"database-connection-limit",null],
    ['FATAL: no pg_hba.conf entry',"hba-rejected",null],
    ['FATAL: database postgres is not currently accepting connections',"database-unavailable",null],
    ['Connection refused',"connection-refused",null],
    ['fe_sendauth: no password supplied',"password-not-delivered",null],
    ['OCI runtime exec failed',"docker-execution-failed",null],
    ['ERROR: 42501: permission denied',"sql-execution-error","42501"],
  ])("allowlists error category for %s",(stderr,category,sqlState)=>{
    expect(classifyScramProcess(result(2,"",marker+stderr+"\n"+secret))).toMatchObject({category,sqlState,output:"empty"});
  });
  it("returns only an allowlisted setting name and suppresses parameter values",()=>{
    const classified=classifyScramProcess(result(2,"",marker+'FATAL: 22023: invalid value for parameter "pg_stat_statements.track": '+secret));
    expect(classified).toMatchObject({category:"startup-setting-rejected",parameter:"pg_stat_statements.track",sqlState:"22023"});
    expect(JSON.stringify(classified)).not.toContain(secret);
    expect(classifyScramProcess(result(2,"",marker+'FATAL: permission denied to set parameter "secret_unknown"'))).toMatchObject({parameter:null});
  });
  it.each([["","empty-output"],[secret,"unexpected-output"]])("fails closed for unexpected stdout",(stdout,category)=>{
    const classified=classifyScramProcess(result(0,stdout));
    expect(classified.category).toBe(category);expect(JSON.stringify(classified)).not.toContain(secret);
    expect(()=>assertDiagnosticScramControls(negative(),classified)).toThrow(/positive/);
  });
  it("rejects unverified delivery, unknown diagnostics, termination and unknown SQLSTATE",()=>{
    for(const raw of [result(0,"authenticator",""),result(0,"authenticator",marker+secret),
      {...result(),status:null,signal:"SIGTERM"},result(1,"",marker+'FATAL: ABCDE: '+secret)]){
      const classified=classifyScramProcess(raw);expect(()=>assertDiagnosticScramControls(negative(),classified)).toThrow(/positive/);
      expect(JSON.stringify(classified)).not.toContain(secret);expect(classified.sqlState).toBeNull();
    }
    expect(()=>assertDiagnosticScramControls(classifyScramProcess(result(1,"",marker+secret)),positive())).toThrow(/negative/);
  });
  it("verifies ownership before execution and uses only binary stdin for the credential",()=>{
    const cluster={verifyDatabase:vi.fn(),verify:vi.fn(()=>({env:[],cmd:["postgres"]})),record:{containerId:"a".repeat(64)}};
    const credential="b".repeat(64);let delivered="";let input:Buffer|undefined;
    const stdout=Buffer.from("authenticator\n"),stderr=Buffer.from(marker);
    const execute=vi.fn((_command:string,_args:string[],options:{input:Buffer})=>{
      expect(cluster.verifyDatabase).toHaveBeenCalledOnce();input=options.input;delivered=input.toString();
      return {status:0,stdout,stderr,error:null,signal:null};
    });
    expect(diagnosticScramProbe(cluster,credential,execute)).toMatchObject({category:"expected-identity"});
    expect(delivered.split("\n")[0]).toBe(credential);expect(Buffer.isBuffer(input)).toBe(true);
    const [command,args,options]=execute.mock.calls[0];expect(command).toBe("docker");
    expect(args).toEqual(expect.arrayContaining(["exec","-i",cluster.record.containerId]));
    expect(args.join(" ")).not.toContain(credential);expect(options).not.toHaveProperty("env");
    expect(input?.every(byte=>byte===0)).toBe(true);expect(stdout.every(byte=>byte===0)).toBe(true);expect(stderr.every(byte=>byte===0)).toBe(true);
    cluster.verifyDatabase.mockImplementation(()=>{throw new Error("unowned");});execute.mockClear();
    expect(()=>diagnosticScramProbe(cluster,credential,execute)).toThrow("unowned");expect(execute).not.toHaveBeenCalled();
  });
  it("keeps the protected-setting capability private and scoped",()=>{
    const sql=readFileSync(new URL("../../scripts/sql/scram-preload-inspection.sql",import.meta.url),"utf8");
    expect(sql).toContain("create role go_test_preload_reader nologin inherit nosuperuser nocreatedb");
    expect(sql).toContain("grant pg_read_all_settings to go_test_preload_reader");
    expect(sql).toContain("with inherit true, set false, admin false");
    expect(sql).toContain("create schema go_test_diagnostics authorization go_test_preload_reader");
    expect(sql).toContain("set search_path = pg_catalog, pg_temp");
    expect(sql).toContain("returns boolean language plpgsql stable security definer");
    expect(sql).toContain("alter function go_test_diagnostics.preloads_empty() owner to go_test_preload_reader");
    expect(sql).toContain("from public,authenticator,anon,authenticated,service_role");
    expect(sql).toContain("grant usage on schema go_test_diagnostics to authenticator");
    expect(sql).toContain("grant execute on function go_test_diagnostics.preloads_empty() to authenticator");
    expect(sql).toContain("session_user <> 'authenticator'");
    expect(sql).toContain("pg_catalog.current_database() is distinct from %L");
    expect(sql).toContain("exception when others then\n      return false;");
    expect(sql).toContain("pg_catalog.aclexplode");
    expect(sql).toContain("and rolsuper and rolcreaterole and rolcanlogin");
    expect(sql).toContain("x.grantee=0 or x.grantee not in (o,a)");
    expect(sql).toContain("and inherit_option and not set_option and not admin_option");
    expect(sql).toContain("where roleid=o");
    expect(sql).toContain("proconfig=array['search_path=pg_catalog, pg_temp']::text[]");
    expect(sql.indexOf("and rolsuper and rolcreaterole and rolcanlogin")).toBeLessThan(sql.indexOf("create role go_test_preload_reader"));
    expect(sql).not.toMatch(/grant pg_read_all_settings to authenticator|create (?:or replace )?function public\.|set_config|alter role|alter system/i);
    const harness=readFileSync(new URL("../../scripts/docker/postgrest-http/harness.mjs",import.meta.url),"utf8");
    expect(harness).toContain('db-schemas = "public"');
    expect(harness).toContain('db-extra-search-path = "public, extensions"');
  });
  it.each(["","f\n","t\n","authenticator\nextra","anon\n"])("rejects non-proof preload output %j",(stdout)=>{
    const cluster={verifyDatabase:vi.fn(),verify:vi.fn(()=>({env:[],cmd:["postgres"]})),record:{database:`go_share_test_${"a".repeat(32)}`,containerId:"a".repeat(64)}};
    const probe=diagnosticPreloadProbe(cluster,"b".repeat(64),()=>result(0,stdout));
    expect(()=>assertDiagnosticScramControls(negative(),probe)).toThrow(/positive/);
  });
  it("inspects a fresh owned target without masking its preload settings",()=>{
    const cluster={verifyDatabase:vi.fn(),verify:vi.fn(()=>({env:[],cmd:["postgres"]})),record:{database:`go_share_test_${"a".repeat(32)}`,containerId:"a".repeat(64)}};
    let delivered="";let buffer:Buffer|undefined;
    const execute=vi.fn((_command:string,args:string[],options:{input:Buffer})=>{
      expect(cluster.verifyDatabase).toHaveBeenCalledOnce();
      buffer=options.input;delivered=buffer.toString();
      expect(args.join(" ")).toContain(`-d '${cluster.record.database}' -f -`);
      expect(args.join(" ")).not.toContain("b".repeat(64));
      return result();
    });
    expect(()=>assertDiagnosticScramControls(negative(),diagnosticPreloadProbe(cluster,"b".repeat(64),execute))).not.toThrow();
    expect(delivered).toContain("go_test_diagnostics.preloads_empty() is true");
    expect(delivered).toContain("get stacked diagnostics error_state=returned_sqlstate,error_message=message_text;");
    expect(delivered).toContain("error_message is distinct from 'permission denied for schema go_test_diagnostics'");
    expect(delivered).toContain("execute 'select go_test_diagnostics.preloads_empty()';");
    expect(delivered).toContain("pg_catalog.has_schema_privilege(current_user,n,'USAGE') is distinct from false");
    expect(delivered).toContain("pg_catalog.has_function_privilege(current_user,f,'EXECUTE') is distinct from false");
    for(const role of ["q","o"]) for(const privilege of ["MEMBER","USAGE","SET"])
      expect(delivered).toContain(`pg_catalog.pg_has_role(current_user,${role},'${privilege}') is distinct from false`);
    expect(delivered).toContain("x.grantee=0 and x.privilege_type='EXECUTE'");
    expect(delivered).not.toContain("when insufficient_privilege then null");
    expect(delivered).toContain("begin read only;");
    expect(delivered).not.toMatch(/set_config|set (?:session_|local_)preload_libraries/i);
    expect(buffer?.every(byte=>byte===0)).toBe(true);
    cluster.record.database="postgres";execute.mockClear();
    expect(()=>diagnosticPreloadProbe(cluster,"b".repeat(64),execute)).toThrow(/target/);
    expect(execute).not.toHaveBeenCalled();
  });
  it.each(["f","",null,secret,"t\nextra"])("rejects insufficient installer evidence %j",value=>{
    const cluster={verifyDatabase:vi.fn(),record:{database:`go_share_test_${"a".repeat(32)}`,marker:`go-disposable:${"a".repeat(32)}`},rawSql:vi.fn(()=>value)};
    expect(()=>assertInstallerAuthority(cluster)).toThrow(/installer authority/);
    expect(cluster.verifyDatabase).toHaveBeenCalledOnce();
    const call=cluster.rawSql.mock.calls[0] as unknown as [string,string];
    expect(call[0]).toBe(cluster.record.database);expect(call[1]).toContain("begin read only;");
    expect(call[1]).toContain("and rolsuper and rolcreaterole and rolcanlogin");
    expect(call[1]).not.toMatch(/\bcreate role|\bgrant|\balter role/i);
  });
  it.each(["",null,secret,"a".repeat(63),"a".repeat(64)+"\nextra"])("rejects unavailable fingerprint evidence %j",value=>{
    const cluster={verifyDatabase:vi.fn(),record:{database:`go_share_test_${"a".repeat(32)}`},rawSql:vi.fn(()=>value)};
    expect(()=>scramSecurityFingerprint(cluster)).toThrow(/fingerprint unavailable/);
  });
  it("keeps the fingerprint in the administrative disposable context",()=>{
    const cluster={verifyDatabase:vi.fn(),record:{database:`go_share_test_${"a".repeat(32)}`},rawSql:vi.fn(()=>"a".repeat(64))};
    expect(scramSecurityFingerprint(cluster)).toBe("a".repeat(64));
    const call=cluster.rawSql.mock.calls[0] as unknown as [string,string];
    expect(call[0]).toBe(cluster.record.database);
    expect(call[1]).toContain("pg_catalog.sha256");expect(call[1]).toContain("pg_catalog.pg_read_file");
    expect(call[1]).toContain("pg_catalog.pg_parameter_acl");expect(call[1]).toContain("pg_catalog.pg_proc");
    expect(call[1]).toContain("begin read only;");
  });
  it("keeps only the verified diagnostic delta outside the installation comparison",()=>{
    const cluster={verifyDatabase:vi.fn(),record:{database:`go_share_test_${"a".repeat(32)}`},rawSql:vi.fn(()=>"a".repeat(64))};
    expect(scramSecurityFingerprint(cluster,false)).toBe("a".repeat(64));
    const call=cluster.rawSql.mock.calls[0] as unknown as [string,string];
    expect(call[1]).toContain("r.rolname<>'go_test_preload_reader'");
    expect(call[1]).toContain("m.member not in (select oid from pg_catalog.pg_roles where rolname='go_test_preload_reader')");
    expect(call[1]).not.toContain("pg_catalog.to_regprocedure");
  });
  it.each([
    {env:["PGOPTIONS=-c session_preload_libraries="],cmd:["postgres"]},
    {env:["PGSERVICE=unexpected"],cmd:["postgres"]},
    {env:["PGSERVICEFILE=/synthetic/private"],cmd:["postgres"]},
    {env:["PGHOSTADDR=127.0.0.2"],cmd:["postgres"]},
    {env:[],cmd:["postgres","-c","session_preload_libraries="]},
    {env:[],cmd:["postgres","-c","shared_preload_libraries="]},
    {env:null,cmd:["postgres"]},
  ])("rejects misleading startup context %j",startup=>{
    const cluster={verifyDatabase:vi.fn(),verify:vi.fn(()=>startup),record:{database:`go_share_test_${"a".repeat(32)}`,containerId:"a".repeat(64)}};
    const execute=vi.fn(()=>result());
    expect(()=>diagnosticPreloadProbe(cluster,"b".repeat(64),execute)).toThrow(/startup context/);
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([
    'ERROR: 42501: permission denied to examine "session_preload_libraries"',
    'ERROR: 42501: permission denied for function other_function',
    'ERROR: 42501: permission denied for schema different_schema',
    'ERROR: P0001: Unexpected diagnostic denial boundary',
  ])("does not accept an unrelated denial as preload proof %s",error=>{
    const cluster={verifyDatabase:vi.fn(),verify:vi.fn(()=>({env:[],cmd:["postgres"]})),record:{database:`go_share_test_${"a".repeat(32)}`,containerId:"a".repeat(64)}};
    const classified=diagnosticPreloadProbe(cluster,"b".repeat(64),()=>result(3,"authenticator\n",marker+error+"\n"+secret));
    expect(()=>assertDiagnosticScramControls(negative(),classified)).toThrow(/positive/);
    expect(JSON.stringify(classified)).not.toContain(secret);
  });
  it("rejects unexpected catalog fields before exposing role diagnostics",()=>{
    const role={loginEnabled:true,connectionLimit:-1,activeConnections:0,validUntil:null,scramVerifierConfigured:true,
      unlistedSettingCount:0,settings:[],databases:["postgres","disposable"].map(target=>({target,allowConnections:true,connectPrivilege:true,connectionLimit:-1,activeConnections:0}))};
    const cluster={verifyDatabase:vi.fn(),record:{database:`go_share_test_${"a".repeat(32)}`},rawSql:vi.fn(()=>JSON.stringify(role))};
    expect(inspectScramRole(cluster)).toEqual(role);
    const sql=cluster.rawSql.mock.calls[0] as unknown as [string,string];expect(sql[1]).toContain("begin read only;");
    cluster.rawSql.mockReturnValue(JSON.stringify({...role,password:secret}));
    expect(()=>inspectScramRole(cluster)).toThrow(/diagnostics unavailable/);
    cluster.rawSql.mockReturnValue(JSON.stringify({...role,settings:[{name:secret,scope:"role",matchesBootstrap:true,recognized:true,context:"user",canSet:true}]}));
    expect(()=>inspectScramRole(cluster)).toThrow(/diagnostics unavailable/);
  });
  it.each(["pass","login","preload","policy","installation","installer","catalog","fingerprint","hba"])("fails closed and cleans up for %s",async scenario=>{
    let fingerprints=0;
    const hba={loginEnabled:true,connectPostgres:true,connectDisposable:true,accountExpired:false,loopbackScramVerified:scenario!=="hba"};
    const cluster={record:{runId:"a".repeat(32),database:`go_share_test_${"a".repeat(32)}`,marker:`go-disposable:${"a".repeat(32)}`},start:vi.fn(),cleanup:vi.fn(),
      verifyDatabase:vi.fn(),sql:vi.fn(()=>"0"),rawSql:vi.fn((_database:string,sql:string)=>{
        if(sql.includes("select not rolinherit"))return "t\nt";
        if(sql.includes("select session_user='supabase_admin'"))return scenario==="installer"?"f":"t";
        if(sql.includes("with roles as"))return scenario==="catalog"?"f":"t";
        if(sql.includes("sha256"))return scenario==="fingerprint"?"":((++fingerprints===4&&scenario==="policy")||(fingerprints===2&&scenario==="installation")?"b":"a").repeat(64);
        if(sql.includes("json_build_object"))return JSON.stringify(hba);
        return "";
      })};
    runnerMocks.create.mockResolvedValue(cluster);runnerMocks.sidecar.mockClear();runnerMocks.prepare.mockReset();
    runnerMocks.diagnostics.mockReturnValue({role:{},negative:negative(),positive:scenario==="login"?negative():positive()});
    runnerMocks.preloads.mockReset();
    runnerMocks.preloads.mockReturnValue(scenario==="preload"?classifyScramProcess(result(0,"")):positive());
    vi.spyOn(console,"log").mockImplementation(()=>{});vi.spyOn(console,"error").mockImplementation(()=>{});
    await runHttpValidation({diagnosticOnly:true});
    expect(cluster.cleanup).toHaveBeenCalledOnce();expect(runnerMocks.sidecar).not.toHaveBeenCalled();
    expect(cluster.sql).toHaveBeenCalledTimes(["installer","hba","fingerprint"].includes(scenario)?2:3);
    expect(runnerMocks.preloads).toHaveBeenCalledTimes(["pass","preload","policy"].includes(scenario)?1:0);
    expect(process.exitCode).toBe(scenario==="pass"?undefined:1);
  });
});
