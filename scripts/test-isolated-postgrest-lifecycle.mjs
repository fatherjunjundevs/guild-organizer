// Real probes only after locally verified immutable binary/image provenance.
import { fork } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createIsolatedCluster, recoverIsolatedCluster, ownedDocker, inspectOwnedContainer, safeError } from "./isolated-postgres-test-cluster.mjs";
import { createHttpService, httpCreateArgs, verifyLocalHttpImage } from "./isolated-postgrest-test-service.mjs";
import { prepareShareLinkTestDatabase } from "./share-link-test-database.mjs";
import { installHttpBootstrap } from "./test-share-link-http.mjs";
import { installHttpPrivacy, inspectPostgresLogs } from "./http-postgres-privacy.mjs";
import { randomBytes } from "node:crypto";
import { httpFail } from "./postgrest-http-contract.mjs";

export async function runHttpLifecycle() {
  verifyLocalHttpImage(); // No resource intent/creation until image checks pass.
  const clusters=[], recoveryRuns=[];
  let failed=false,assertions=0;
  const check=(condition,label)=>{if(!condition)httpFail("HTTP lifecycle assertion failed; details suppressed");assertions++;console.log(`ok ${assertions} - ${label}`);};
  const rejects=async(action,label)=>{let refused=false;try{await action();}catch{refused=true;}check(refused,label);};
  const prepare=async()=>{
    const cluster=await createIsolatedCluster({httpPrivacy:true});clusters.push(cluster);await cluster.start();
    prepareShareLinkTestDatabase(cluster);
    const {password}=installHttpBootstrap(cluster);
    installHttpPrivacy(cluster,password);
    const service=await createHttpService(cluster),jwtSecret=randomBytes(32).toString("hex");
    cluster.privacySecrets.push(password,jwtSecret);
    await service.start({password,jwtSecret});return {cluster,service};
  };
  try {
    const [a,b]=await Promise.all([prepare(),prepare()]);
    check(a.cluster.record.identity.systemId!==b.cluster.record.identity.systemId,"two independent PostgreSQL systems coexist");
    check(a.service.verify().id!==b.service.verify().id,"two verified namespace-bound HTTP sidecars coexist");
    for(const {service} of [a,b])await service.request({method:"POST",rpc:"go_http_test_identity",args:{},expected:{kind:"identity",status:200,role:"anon",uid:null}});
    check(true,"both HTTP namespaces independently serve restricted anonymous pool identities");
    a.service.verify();
    check(ownedDocker(httpCreateArgs(a.cluster.record),undefined,true,10000)===null,"real sidecar creation collision refuses adoption");
    await rejects(()=>recoverIsolatedCluster(a.cluster.record.runId),"active HTTP run recovery refused");
    const original=readFileSync(a.cluster.path,"utf8");
    try {writeFileSync(a.cluster.path,"{corrupted");await rejects(()=>a.cluster.cleanup(),"corrupt dependent manifest blocks all cleanup");}
    finally {writeFileSync(a.cluster.path,original);}
    check(a.service.verify().id===a.cluster.record.http.containerId,"corrupt-manifest refusal preserves both exact resources");
    await a.service.close();inspectPostgresLogs(a.cluster,[]);
    const remove=a.service.removeContainer.bind(a.service);
    a.service.removeContainer=()=>{throw new Error("injected exact sidecar removal failure");};
    await rejects(()=>a.cluster.cleanup(),"failed sidecar removal propagates failure");
    check(a.cluster.verify().state==="running"&&a.cluster.record.http.phase==="removing","parent survives unresolved sidecar removal");
    a.service.removeContainer=remove;await a.cluster.cleanup();
    check(!inspectOwnedContainer(a.cluster.record.http.containerId)&&!inspectOwnedContainer(a.cluster.record.containerId),"sidecar absence proven before parent removal");
    await a.cluster.cleanup();await recoverIsolatedCluster(a.cluster.record.runId);
    check(true,"completed exact-run cleanup and recovery safely repeat");
    check(b.service.verify().state==="running","removal of one run preserves its independent peer");
    await b.service.close();inspectPostgresLogs(b.cluster,[]);
    const removeSidecar=b.service.removeContainer.bind(b.service);
    b.service.removeContainer=()=>{removeSidecar();throw new Error("injected lost sidecar removal response");};
    await rejects(()=>b.cluster.cleanup(),"uncertain sidecar removal response retains parent and removal intent");
    check(b.cluster.verify().state==="running"&&b.cluster.record.http.phase==="removing","parent survives an unconfirmed sidecar response");
    b.service.removeContainer=removeSidecar;
    const removeParent=b.cluster.removeContainer.bind(b.cluster);
    b.cluster.removeContainer=()=>{throw new Error("injected exact PostgreSQL cleanup failure");};
    await rejects(()=>b.cluster.cleanup(),"failed PostgreSQL cleanup propagates failure after sidecar removal");
    check(b.cluster.record.http.phase==="removed"&&b.cluster.record.phase==="removing","failed parent cleanup retains its manifest and completed dependent state");
    b.cluster.removeContainer=()=>{removeParent();throw new Error("injected lost removal response");};
    await rejects(()=>b.cluster.cleanup(),"uncertain parent removal response retains evidence");
    b.cluster.removeContainer=removeParent;await b.cluster.cleanup();
    check(b.cluster.record.phase==="removed","exact absence reconciles lost parent removal response");
    for(const phase of ["created","submitted"]){
      const child=fork(new URL(import.meta.url),["--interrupted-child",phase],{stdio:["ignore","ignore","ignore","ipc"],windowsHide:true});
      let run;
      try {
        run=await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error("Owned HTTP child readiness deadline exceeded")),180000);
          child.once("message",message=>{clearTimeout(timer);resolve(message.runId);});
          child.once("exit",()=>{clearTimeout(timer);reject(new Error("Owned HTTP child exited before registration"));});
        });
        recoveryRuns.push(run);
        await rejects(()=>recoverIsolatedCluster(run),"active interrupted-creation child refuses recovery");
      }finally{
        child.kill("SIGKILL");if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once("exit",resolve));
      }
      await recoverIsolatedCluster(run);await recoverIsolatedCluster(run);
      check(true,`real interrupted ${phase} HTTP creation recovered by complete ownership evidence`);
    }
    console.log(`HTTP lifecycle: ${assertions} assertions passed.`);
  }catch(error){failed=true;console.error(safeError(error));}
  finally{
    for(const cluster of clusters){try{await cluster.cleanup();}catch(error){failed=true;console.error(safeError(error));console.error(`Retained exact run ${cluster.record.runId}`);}}
    for(const run of recoveryRuns){try{await recoverIsolatedCluster(run);}catch(error){failed=true;console.error(safeError(error));console.error(`Retained interrupted run ${run}`);}}
  }
  if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    if(process.argv[2]==="--interrupted-child"){
      verifyLocalHttpImage();const cluster=await createIsolatedCluster({httpPrivacy:true});await cluster.start();
      // No HTTP initialization or credentials needed for creation-window probes.
      await createHttpService(cluster);
      if(process.argv[3]==="submitted")cluster.update({http:{...cluster.record.http,phase:"submitted",containerId:null,createdAt:null}});
      process.send({runId:cluster.record.runId});await new Promise(()=>{});
    }else if(process.argv.length===2)await runHttpLifecycle();
    else httpFail("Unsupported HTTP lifecycle arguments");
  }catch(error){console.error(safeError(error));process.exitCode=1;}
}
