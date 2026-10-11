// Runs only inside the owned sidecar. No remote destinations or raw diagnostics.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { request } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { verifyHttpPins, assertHttpResponse, assertNoSensitiveOutput, httpFail } from "../../postgrest-http-contract.mjs";

export function runtimeConfig(input) {
  if (!/^go_share_test_[a-f0-9]{32}$/.test(input.database) || !/^[a-f0-9]{64}$/.test(input.password)
    || !/^[a-f0-9]{64}$/.test(input.jwtSecret)) httpFail("Invalid private runtime configuration");
  return `db-uri = "postgresql://authenticator:${input.password}@127.0.0.1:5432/${input.database}?sslmode=disable"
db-anon-role = "anon"
db-schemas = "public"
db-extra-search-path = "public, extensions"
db-config = false
db-pool = 2
db-pool-acquisition-timeout = 5
db-max-rows = 1000
db-plan-enabled = false
db-prepared-statements = true
db-channel-enabled = true
jwt-secret = "${Buffer.from(input.jwtSecret,"hex").toString("base64")}"
jwt-secret-is-base64 = true
jwt-aud = "go-http-test"
jwt-cache-max-entries = 0
server-host = "127.0.0.1"
server-port = 3000
server-timing-enabled = false
log-level = "crit"
log-query = false
openapi-mode = "disabled"
`;
}
export function localRequest(input, signal) {
  if (!["GET","HEAD","POST"].includes(input.method)
    || !/^(resolve_event_share_link|go_http_test_identity|go_http_cache_[a-f0-9]{8}|get_event_share_link_management_state)$/.test(input.rpc)
    || (input.jwt != null && (!/^[A-Za-z0-9_.-]+$/.test(input.jwt) || input.jwt.length>4096))) httpFail("Unregistered HTTP request target");
  const query=input.method==="POST" ? "" : "?"+new URLSearchParams(input.args ?? {}).toString();
  const body=input.method==="POST" ? (input.rawBody ?? JSON.stringify(input.args ?? {})) : null;
  if (query.length>8192 || (body!==null && Buffer.byteLength(body)>8192)) httpFail("HTTP request exceeds its bound");
  return new Promise((resolve,reject)=>{
    const req=request({host:"127.0.0.1",port:3000,path:`/rpc/${input.rpc}${query}`,method:input.method,signal,
      headers:{...(input.jwt ? {Authorization:`Bearer ${input.jwt}`} : {}),...(body!==null ? {"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)} : {})}},res=>{
      let data="",bytes=0;
      res.on("data",chunk=>{bytes+=chunk.length;if(bytes>65536){req.destroy();reject(new Error("HTTP response exceeds its bound"));}else data+=chunk.toString("utf8");});
      res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
      res.on("error",()=>reject(new Error("HTTP response transport failed")));
    });
    req.on("error",()=>reject(new Error("HTTP request transport failed")));
    req.setTimeout(5000,()=>req.destroy());
    req.end(body);
  });
}
async function main() {
  let child=null, config=null, diagnostics="", inputBuffer="", totalInput=0, inflight=0, initialized=false, diagnosticOverflow=false;
  const secrets=[], controllers=new Set();
  const configPath="/run/go-http/postgrest.conf";
  const result0={status:0,code:null,backendPid:null};
  const output=(id,ok,result=null)=>process.stdout.write(JSON.stringify({id,ok,result})+"\n");
  const safeDiagnostics=()=>{if(diagnosticOverflow)httpFail("PostgREST diagnostics exceeded their bound");assertNoSensitiveOutput(diagnostics,secrets);};
  const launch=()=>{
    diagnostics="";diagnosticOverflow=false;
    child=spawn("/usr/local/bin/postgrest",[configPath],{stdio:["ignore","pipe","pipe"],env:{PATH:process.env.PATH,GHCRTS:"-N2"}});
    const capture=chunk=>{if(Buffer.byteLength(diagnostics)+chunk.length>65536){diagnosticOverflow=true;child.kill("SIGKILL");return;}diagnostics+=chunk.toString("utf8");};
    child.stdout.on("data",capture);child.stderr.on("data",capture);child.on("error",()=>{});
  };
  const stop=async()=>{
    for(const controller of controllers)controller.abort();
    if(child && child.exitCode===null && child.signalCode===null){
      const current=child;
      await new Promise(resolve=>{const timer=setTimeout(()=>current.kill("SIGKILL"),3000);current.once("exit",()=>{clearTimeout(timer);resolve();});current.kill("SIGTERM");});
    }
    child=null;
  };
  const ready=async()=>{
    const deadline=Date.now()+45000;
    while(Date.now()<deadline){
      if(!child || child.exitCode!==null || child.signalCode!==null)httpFail("PostgREST startup failed");
      try{
        const response=await localRequest({method:"POST",rpc:"go_http_test_identity",args:{}},AbortSignal.timeout(5000));
        assertHttpResponse(response,{status:200,kind:"identity",role:"anon",uid:null});safeDiagnostics();return;
      }catch{safeDiagnostics();await new Promise(resolve=>setTimeout(resolve,100));}
    }
    httpFail("PostgREST readiness deadline exceeded");
  };
  const execute=async(command)=>{
    if(command.op==="init"){
      if(initialized || config)httpFail("HTTP initialization cannot repeat");
      verifyHttpPins(command.pins);
      secrets.push(command.password,command.jwtSecret);
      secrets.push(Buffer.from(command.jwtSecret,"hex").toString("base64"));
      config=runtimeConfig(command);
      const binary=readFileSync("/usr/local/bin/postgrest");
      const version=spawnSync("/usr/local/bin/postgrest",["--version"],{encoding:"utf8",timeout:5000,maxBuffer:4096});
      if(createHash("sha256").update(binary).digest("hex")!==command.pins.postgrestSha256 || version.status!==0
        || version.stdout.match(/\b\d+\.\d+\b/)?.[0]!==command.pins.postgrestVersion || process.getuid()!==10001)httpFail("HTTP executable identity mismatch");
      writeFileSync(configPath,config,{flag:"wx",mode:0o600});launch();await ready();initialized=true;return result0;
    }
    if(!initialized)httpFail("HTTP service is not initialized");
    if(command.op==="restart"){await stop();launch();await ready();return result0;}
    if(command.op==="stop"){await stop();safeDiagnostics();unlinkSync(configPath);config=null;initialized=false;return result0;}
    if(command.op!=="request")httpFail("Unknown HTTP command");
    if(command.jwt)secrets.push(command.jwt);
    if(command.rpc==="resolve_event_share_link" && typeof command.args?.p_token==="string")secrets.push(command.args.p_token);
    const controller=new AbortController();controllers.add(controller);
    try{
      const response=await localRequest(command,controller.signal);
      safeDiagnostics();assertNoSensitiveOutput(JSON.stringify(response),secrets);
      return assertHttpResponse(response,command.expected);
    }finally{controllers.delete(controller);}
  };
  const finish=async()=>{
    // Enforce the total lifetime even if a failed child never emits exit.
    const forced=setTimeout(()=>process.exit(1),5000);forced.unref();
    try{await stop();try{unlinkSync(configPath);}catch{/* No persistent configuration exists. */}}
    finally{process.exit(1);}
  };
  const lifetime=setTimeout(()=>void finish(),15*60*1000);lifetime.unref();
  process.on("SIGTERM",()=>void finish());process.on("SIGINT",()=>void finish());
  process.stdin.on("data",chunk=>{
    totalInput+=chunk.length;
    if(totalInput>4*1024*1024 || Buffer.byteLength(inputBuffer)+chunk.length>65536){process.stdin.pause();void finish();return;}
    inputBuffer+=chunk.toString("utf8");
    while(inputBuffer.includes("\n")){
      const end=inputBuffer.indexOf("\n"),line=inputBuffer.slice(0,end);inputBuffer=inputBuffer.slice(end+1);
      let command;
      try{command=JSON.parse(line);if(!/^[a-f0-9]{32}$/.test(command.id)||inflight>=16)throw new Error();}
      catch{process.stdin.pause();void finish();return;}
      inflight++;
      void execute(command).then(result=>output(command.id,true,result),()=>output(command.id,false))
        .finally(()=>{inflight--;});
    }
  });
  process.stdin.on("end",()=>void stop());
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(()=>{process.exitCode=1;});
}
