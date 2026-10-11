// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { imageDigest, imageId, repositoryRoot, verifyManifest, verifyTarget } from "../../scripts/isolated-postgres-test-cluster.mjs";
import { assertHttpResponse, assertNoSensitiveOutput, httpLabels, runtimeTmpfs, signTestJwt,
  verifyHttpContainer, verifyHttpPins, verifyHttpRecord } from "../../scripts/postgrest-http-contract.mjs";
import { runtimeConfig, localRequest } from "../../scripts/docker/postgrest-http/harness.mjs";
import { assertInternalRows, credentialCases, denialCases } from "../../scripts/test-share-link-http.mjs";

const mocks = vi.hoisted(() => ({ docker:vi.fn(), inspect:vi.fn(), target:vi.fn() }));
vi.mock("../../scripts/postgrest-http-image.mjs", () => ({
  httpImagePins: null,
}));
vi.mock("../../scripts/isolated-postgres-test-cluster.mjs", async importOriginal => {
  const actual=await importOriginal<typeof import("../../scripts/isolated-postgres-test-cluster.mjs")>();
  return {...actual,ownedDocker:mocks.docker,inspectOwnedContainer:mocks.inspect,localTarget:mocks.target};
});
import { cleanupHttpDependent, createHttpService, httpCreateArgs, httpSourceHash,
  HttpService, reconcileHttpCreation, verifyLocalHttpImage } from "../../scripts/isolated-postgrest-test-service.mjs";

const pins={imageDigest:`test/go-http@sha256:${"1".repeat(64)}`,imageId:`sha256:${"2".repeat(64)}`,
  postgrestImage:`test/postgrest@sha256:${"3".repeat(64)}`,nodeImage:`test/node@sha256:${"4".repeat(64)}`,
  postgrestVersion:"14.6",postgrestSha256:"5".repeat(64),sourceSha256:httpSourceHash()};
const target={context:"desktop-linux",endpoint:"npipe:////./pipe/dockerDesktopLinuxEngine",daemonId:"test-daemon",imageId,imageDigest};
const parent={version:2,runId:"a".repeat(32),repoRoot:repositoryRoot,
  repoId:createHash("sha256").update(repositoryRoot).digest("hex"),target,
  containerName:`go-security-pg-${"a".repeat(32)}`,containerId:"b".repeat(64),intentAt:"2026-10-10T00:00:00.000Z",
  createdAt:"2026-10-10T00:00:01.000Z",phase:"ready",pid:process.pid,leasePort:50000,
  database:`go_share_test_${"a".repeat(32)}`,marker:`go-disposable:${"a".repeat(32)}`,
  identity:{systemId:"1000001",databaseOid:"17001"},http:{phase:"ready",containerName:`go-security-http-${"a".repeat(32)}`,
    containerId:"c".repeat(64) as string|null,createdAt:"2026-10-10T00:00:03.000Z" as string|null,intentAt:"2026-10-10T00:00:02.000Z",
    pgContainerId:"b".repeat(64),identity:{systemId:"1000001",databaseOid:"17001"},pins}};
const container={id:parent.http.containerId,name:`/${parent.http.containerName}`,created:parent.http.createdAt,
  image:pins.imageId,configImage:pins.imageDigest,labels:httpLabels(parent),state:"running",mounts:[],ports:{},
  user:"10001:10001",workingDir:"/opt/go-http",entrypoint:["node","/opt/go-http/scripts/docker/postgrest-http/harness.mjs"],
  cmd:[],openStdin:true,tty:false,env:["PATH=/usr/local/bin:/usr/bin","NODE_VERSION=24.19.0"],
  host:{NetworkMode:`container:${parent.containerId}`,Privileged:false,AutoRemove:false,ReadonlyRootfs:true,PidMode:"",IpcMode:"private",
    RestartPolicy:{Name:"no"},Memory:512*1024**2,NanoCpus:10**9,PidsLimit:64,LogConfig:{Type:"none",Config:{}},
    CapDrop:["ALL"],CapAdd:[],SecurityOpt:["no-new-privileges"],Binds:[],Mounts:[],Devices:[],DeviceRequests:[],PortBindings:{},
    Tmpfs:{"/run/go-http":runtimeTmpfs}}};
const copy=<T,>(value:T):T=>structuredClone(value);
function fakeCluster(record=copy(parent)) {
  return {record,httpService:null,verifyDatabase:vi.fn(),update:vi.fn((changes:Partial<typeof parent>)=>{Object.assign(record,changes);})};
}
beforeEach(()=>{mocks.docker.mockReset();mocks.inspect.mockReset();mocks.target.mockReset();mocks.target.mockReturnValue(target);});
afterEach(()=>{vi.restoreAllMocks();});

describe("HTTP ownership and image boundary",()=>{
  it("preserves version-1 manifests and validates the version-2 dependent",()=>{
    expect(verifyManifest(parent)).toEqual(parent);
    const {http:discard,...v1}=parent;void discard;
    expect(verifyManifest({...v1,version:1})).toEqual({...v1,version:1});
    expect(()=>verifyManifest({...v1,version:2})).toThrow();
    expect(verifyHttpContainer(parent,container)).toEqual(container);
  });
  it("fails closed before Docker creation when provenance is unresolved",async()=>{
    expect(()=>verifyLocalHttpImage()).toThrow(/provenance unavailable/);
    await expect(createHttpService(fakeCluster())).rejects.toThrow(/provenance unavailable/);
    expect(mocks.docker).not.toHaveBeenCalled();expect(mocks.target).not.toHaveBeenCalled();
  });
  for(const [label,changes] of Object.entries({tag:{imageDigest:"test:latest"},secret:{password:"never-persist"},
    absent:{postgrestSha256:null},version:{postgrestVersion:"latest"},extra:{environment:{JWT_SECRET:"synthetic"}}})){
    it(`rejects ${label} image provenance`,()=>expect(()=>verifyHttpPins({...pins,...changes})).toThrow());
  }
  for(const field of ["daemonId","context","endpoint","imageDigest","imageId"]){
    it(`refuses changed parent target ${field}`,()=>expect(()=>verifyTarget(target,{...target,[field]:"untrusted"})).toThrow());
  }
  for(const [label,changes] of Object.entries({wrongParent:{pgContainerId:"d".repeat(64)},wrongDatabase:{identity:{systemId:"1000001",databaseOid:"17002"}},
    wrongSystem:{identity:{systemId:"1000002",databaseOid:"17001"}},partialId:{containerId:"c".repeat(12)},secret:{password:"secret"},
    missingTimestamp:{createdAt:null},unsubmittedResource:{phase:"planned"},unknownStage:{phase:"unknown"},misleadingName:{containerName:"existing-development"}})){
    it(`rejects ${label} dependent manifest`,()=>expect(()=>verifyHttpRecord({...parent,http:{...parent.http,...changes}})).toThrow());
  }
  for(const [label,changes] of Object.entries({wrongId:{id:"d".repeat(64)},wrongImage:{image:"sha256:"+"6".repeat(64)},mutableImage:{configImage:"test:latest"},
    wrongTimestamp:{created:"2026-10-10T00:00:04.000Z"},wrongName:{name:"/existing-development"},missingLabels:{labels:{}},
    developmentLabel:{labels:{...container.labels,"com.supabase.cli.project":"guild-organizer"}},root:{user:"0:0"},entrypoint:{entrypoint:["sh"]},
    command:{cmd:["--secret"]},secretEnvironment:{env:["JWT_SECRET=synthetic"]},tty:{tty:true},noInput:{openStdin:false},
    publishedPort:{ports:{"3000/tcp":[{HostPort:"3000"}]}},volume:{mounts:[{Type:"volume",Destination:"/run/go-http"}]}})){
    it(`rejects ${label} sidecar`,()=>expect(()=>verifyHttpContainer(parent,{...container,...changes})).toThrow());
  }
  for(const [label,changes] of Object.entries({bridge:{NetworkMode:"bridge"},wrongNamespace:{NetworkMode:`container:${"d".repeat(64)}`},
    privileged:{Privileged:true},autoRemove:{AutoRemove:true},writable:{ReadonlyRootfs:false},hostPid:{PidMode:"host"},sharedIpc:{IpcMode:"host"},
    restart:{RestartPolicy:{Name:"always"}},memory:{Memory:0},cpu:{NanoCpus:0},pids:{PidsLimit:0},logging:{LogConfig:{Type:"json-file",Config:{}}},
    capabilities:{CapAdd:["NET_ADMIN"]},missingDrops:{CapDrop:[]},privilegeEscalation:{SecurityOpt:[]},bind:{Binds:["/var/run/docker.sock:/var/run/docker.sock"]},
    mount:{Mounts:[{}]},device:{Devices:[{}]},gpu:{DeviceRequests:[{}]},port:{PortBindings:{"3000/tcp":[]}},tmpfs:{Tmpfs:{"/run/go-http":"rw"}}})){
    it(`rejects ${label} host configuration`,()=>expect(()=>verifyHttpContainer(parent,{...container,host:{...container.host,...changes}})).toThrow());
  }
  it("creates no port, bridge, mount, credential or environment arguments",()=>{
    const args=httpCreateArgs(parent);
    expect(args).toContain(`container:${parent.containerId}`);expect(args).toContain(pins.imageDigest);
    for(const option of ["--publish","-p","--env","--volume","--mount","--privileged"]){expect(args).not.toContain(option);}
    expect(args).toContain("--read-only");expect(args).toContain("none");expect(args).toContain("10001:10001");
  });
  it("rejects a stale harness source before image inspection",()=>{
    expect(()=>verifyLocalHttpImage({...pins,sourceSha256:"0".repeat(64)})).toThrow(/source differs/);
    expect(mocks.docker).not.toHaveBeenCalled();
  });
  it("verifies every image label and immutable digest",()=>{
    const info={id:pins.imageId,digests:[pins.imageDigest],labels:{"go.http.source":pins.sourceSha256,"go.http.postgrest.version":pins.postgrestVersion,
      "go.http.postgrest.sha256":pins.postgrestSha256,"go.http.postgrest.image":pins.postgrestImage,"go.http.node.image":pins.nodeImage}};
    mocks.docker.mockReturnValue(JSON.stringify(info));expect(verifyLocalHttpImage(pins)).toEqual(target);
    for(const key of Object.keys(info.labels)){
      mocks.docker.mockReturnValue(JSON.stringify({...info,labels:{...info.labels,[key]:"wrong"}}));
      expect(()=>verifyLocalHttpImage(pins)).toThrow(/provenance mismatch/);
    }
    mocks.docker.mockReturnValue(JSON.stringify({...info,digests:[]}));expect(()=>verifyLocalHttpImage(pins)).toThrow();
    mocks.docker.mockReturnValue(JSON.stringify({...info,digests:[]}));
    expect(verifyLocalHttpImage({...pins,imageDigest:pins.imageId})).toEqual(target);
  });
});

describe("HTTP dependent cleanup and uncertain outcomes",()=>{
  it("never removes a parent through the sidecar helper and orders stop before removal",async()=>{
    const cluster=fakeCluster();mocks.inspect.mockReturnValueOnce(container).mockReturnValueOnce(container).mockReturnValueOnce({...container,state:"exited"}).mockReturnValueOnce(null);
    await cleanupHttpDependent(cluster);
    expect(mocks.docker.mock.calls.map(call=>call[0][0])).toEqual(["stop","rm"]);
    expect(mocks.docker.mock.calls.every(call=>call[0].includes(container.id))).toBe(true);
    expect(cluster.record.http.phase).toBe("removed");
  });
  it("retains removal intent after failed sidecar removal",async()=>{
    const cluster=fakeCluster();mocks.inspect.mockReturnValue({...container,state:"exited"});
    mocks.docker.mockImplementation((args:string[])=>{if(args[0]==="rm")throw new Error("uncertain");return "";});
    await expect(cleanupHttpDependent(cluster)).rejects.toThrow();expect(cluster.record.http.phase).toBe("removing");
    expect(cluster.record.phase).toBe("ready");expect(mocks.docker.mock.calls).toHaveLength(2);
  });
  it("refuses removal without verified database identity",async()=>{
    const cluster=fakeCluster();cluster.verifyDatabase.mockImplementation(()=>{throw new Error("identity mismatch");});mocks.inspect.mockReturnValue(container);
    await expect(cleanupHttpDependent(cluster)).rejects.toThrow();expect(mocks.docker).not.toHaveBeenCalled();
  });
  it("refuses unexpected disappearance and retains evidence",async()=>{
    const cluster=fakeCluster();mocks.inspect.mockReturnValue(null);
    await expect(cleanupHttpDependent(cluster)).rejects.toThrow(/without removal intent/);
    expect(cluster.record.http.phase).toBe("ready");
  });
  it("reconciles exact absence only after recorded removal intent and safely repeats",async()=>{
    const cluster=fakeCluster({...copy(parent),http:{...copy(parent.http),phase:"removing"}});mocks.inspect.mockReturnValue(null);
    await cleanupHttpDependent(cluster);await cleanupHttpDependent(cluster);expect(cluster.record.http.phase).toBe("removed");
    expect(mocks.docker).not.toHaveBeenCalled();
  });
  it("retains uncertainty if Docker reports removal success but the sidecar remains",async()=>{
    const cluster=fakeCluster();mocks.inspect.mockReturnValue({...container,state:"exited"});
    await expect(cleanupHttpDependent(cluster)).rejects.toThrow(/could not be verified/);expect(cluster.record.http.phase).toBe("removing");
  });
  it("requires proven process closure even after a successful Docker stop response",async()=>{
    const cluster=fakeCluster();mocks.inspect.mockReturnValue(container);
    await expect(cleanupHttpDependent(cluster)).rejects.toThrow(/closure could not be verified/);
    expect(mocks.docker.mock.calls.map(call=>call[0][0])).toEqual(["stop"]);expect(cluster.record.phase).toBe("ready");
  });
  it("reconciles interrupted submitted creation by complete evidence",()=>{
    const cluster=fakeCluster({...copy(parent),http:{...copy(parent.http),phase:"submitted",containerId:null,createdAt:null}});
    mocks.docker.mockReturnValue(container.id);mocks.inspect.mockReturnValue(container);
    reconcileHttpCreation(cluster);expect(cluster.record.http.containerId).toBe(container.id);expect(cluster.record.http.phase).toBe("created");
  });
  for(const ids of ["",`${container.id}\n${"d".repeat(64)}`]){
    it("refuses missing or ambiguous interrupted creation",()=>{
      const cluster=fakeCluster({...copy(parent),http:{...copy(parent.http),phase:"submitted",containerId:null,createdAt:null}});
      mocks.docker.mockReturnValue(ids);expect(()=>reconcileHttpCreation(cluster)).toThrow(/ambiguous/);
      expect(cluster.record.http.phase).toBe("submitted");expect(mocks.inspect).not.toHaveBeenCalled();
    });
  }
  it("refuses a label-only match with wrong namespace",()=>{
    const cluster=fakeCluster({...copy(parent),http:{...copy(parent.http),phase:"submitted",containerId:null,createdAt:null}});
    mocks.docker.mockReturnValue(container.id);mocks.inspect.mockReturnValue({...container,host:{...container.host,NetworkMode:"bridge"}});
    expect(()=>reconcileHttpCreation(cluster)).toThrow();expect(cluster.record.http.containerId).toBeNull();
  });
  it("safely cleans a durable intent that was never submitted",async()=>{
    const cluster=fakeCluster({...copy(parent),http:{...copy(parent.http),phase:"planned",containerId:null,createdAt:null}});
    await cleanupHttpDependent(cluster);expect(cluster.record.http.phase).toBe("removed");expect(mocks.docker).not.toHaveBeenCalled();
  });
  it("suppresses raw protocol error payloads and rejects sensitive result shapes",async()=>{
    const service=new HttpService(fakeCluster());const kill=vi.fn();Object.defineProperty(service,"child",{value:{kill}});
    const rejected=vi.fn();const timer=setTimeout(()=>{},10000);service.pending.set("e".repeat(32),{reject:rejected,timer});
    service.consume(Buffer.from(JSON.stringify({id:"e".repeat(32),ok:false,result:{error:"Bearer PRIVATE_TEST_SECRET"}})+"\n"));
    expect(rejected.mock.calls[0][0].message).not.toContain("PRIVATE_TEST_SECRET");expect(service.pending.size).toBe(0);
  });
  it("rejects malformed protocol values without throwing outside cleanup",()=>{
    for(const payload of ["null", "[]", "\"unregistered\"", "{invalid"]){
      const service=new HttpService(fakeCluster()),kill=vi.fn();Object.defineProperty(service,"child",{value:{kill}});
      expect(()=>service.consume(Buffer.from(payload+"\n"))).not.toThrow();expect(kill).toHaveBeenCalledOnce();
    }
  });
});

describe("strict HTTP authentication and permission assertions",()=>{
  const denied={status:403,headers:{"proxy-status":"PostgREST; error=42501"},body:JSON.stringify({code:"42501",message:"permission denied for function resolve_event_share_link",details:null,hint:null})};
  it("accepts only the exact resolver permission failure",()=>{
    expect(assertHttpResponse(denied,{kind:"denied",status:403,method:"POST"})).toEqual({status:403,code:"42501",backendPid:null});
    expect(()=>assertHttpResponse({...denied,status:401},{kind:"denied",status:403,method:"POST"})).toThrow();
  });
  for(const [label,response] of Object.entries({jwt:{...denied,headers:{"proxy-status":"PostgREST; error=PGRST301"}},missing:{...denied,headers:{}},
    switchRole:{...denied,body:JSON.stringify({code:"42501",message:"permission denied to set role"})},empty:{status:200,headers:{},body:"[]"},
    schemaCache:{...denied,body:JSON.stringify({code:"PGRST202",message:"missing function"})},parser:{...denied,body:"invalid"}})){
    it(`does not count ${label} as resolver denial`,()=>expect(()=>assertHttpResponse(response,{kind:"denied",status:403,method:"POST"})).toThrow());
  }
  it("requires HEAD permission evidence with an empty body",()=>{
    expect(assertHttpResponse({...denied,body:""},{kind:"denied",status:403,method:"HEAD"}).code).toBe("42501");
    expect(()=>assertHttpResponse(denied,{kind:"denied",status:403,method:"HEAD"})).toThrow();
    expect(()=>assertHttpResponse({...denied,headers:{},body:""},{kind:"denied",status:403,method:"HEAD"})).toThrow();
  });
  it("requires the actual pool role, identity reset and safe logging",()=>{
    const row={session_user:"authenticator",request_role:"authenticated",uid:"synthetic",backend_pid:101,logging_safe:true};
    const expected={kind:"identity",status:200,role:"authenticated",uid:"synthetic"};
    expect(assertHttpResponse({status:200,headers:{},body:JSON.stringify([row])},expected).backendPid).toBe(101);
    for(const changes of [{session_user:"postgres"},{request_role:"service_role"},{uid:null},{logging_safe:false},{claims:{sub:"synthetic"}}]){
      expect(()=>assertHttpResponse({status:200,headers:{},body:JSON.stringify([{...row,...changes}])},expected)).toThrow();
    }
  });
  it("does not treat a reload notification or missing sentinel as cache completion",()=>{
    for(const response of [{status:404,headers:{},body:"missing"},{status:200,headers:{},body:"0"},{status:200,headers:{},body:"[]"}]){
      expect(()=>assertHttpResponse(response,{kind:"cache",status:200,generation:1})).toThrow();
    }
    expect(assertHttpResponse({status:200,headers:{},body:"1"},{kind:"cache",status:200,generation:1}).status).toBe(200);
  });
  it("enumerates all credentials, methods and valid/unknown/malformed token inputs",()=>{
    const cases=denialCases("v1."+"A".repeat(43));expect(cases).toHaveLength(36);
    for(const caller of credentialCases){for(const method of ["GET","HEAD","POST"]){
      const group=cases.filter(c=>c.caller.name===caller.name&&c.method===method);expect(group).toHaveLength(3);
      expect(group.every(c=>c.expected.status===(caller.role==="anon"?401:403))).toBe(true);
    }}
  });
  it("restricts resolver rows to the approved metadata projection",()=>{
    const row={event_name:"HTTP published event",event_type_name:"HTTP League",version_number:1,published_at:"2026-10-10T00:00:00Z"};
    expect(()=>assertInternalRows([row])).not.toThrow();expect(()=>assertInternalRows([],{empty:true})).not.toThrow();
    for(const extra of [{guild_id:"private"},{roster:"private"},{token:"private"},{recovery_envelope:"private"},{draft:"private"}]){
      expect(()=>assertInternalRows([{...row,...extra}])).toThrow();
    }
    expect(()=>assertInternalRows([row],{empty:true})).toThrow();
  });
  it("mints HS256 JWTs with the exact synthetic key and bounded expiry",()=>{
    const key=Buffer.alloc(32,7),token=signTestJwt(key,"authenticated","6f000000-0000-4000-8000-000000000001",1000);
    const [head,body,signature]=token.split(".");
    expect(JSON.parse(Buffer.from(head,"base64url").toString()).alg).toBe("HS256");
    expect(JSON.parse(Buffer.from(body,"base64url").toString())).toEqual({role:"authenticated",sub:"6f000000-0000-4000-8000-000000000001",aud:"go-http-test",iat:1000,nbf:999,exp:1120});
    expect(signature).toBe(createHmac("sha256",key).update(`${head}.${body}`).digest("base64url"));
    expect(()=>signTestJwt(Buffer.alloc(8),"anon")).toThrow();expect(()=>signTestJwt(key,"postgres")).toThrow();
  });
  it("uses matching binary signing keys and private loopback runtime configuration",()=>{
    const key=Buffer.alloc(32,7),config=runtimeConfig({database:parent.database,password:"8".repeat(64),jwtSecret:key.toString("hex")});
    expect(config).toContain(`jwt-secret = "${key.toString("base64")}"`);expect(config).toContain("jwt-secret-is-base64 = true");
    expect(config).toContain("postgresql://authenticator:");expect(config).toContain('server-host = "127.0.0.1"');
    expect(config).toContain("db-pool = 2");expect(config).toContain('log-level = "crit"');expect(config).toContain("log-query = false");
    expect(()=>runtimeConfig({database:"postgres",password:"8".repeat(64),jwtSecret:key.toString("hex")})).toThrow();
  });
  it("rejects foreign HTTP targets before sending requests",()=>{
    for(const rpc of ["http://development","../events","resolve_event_share_link?token=private","sql"]){
      expect(()=>localRequest({method:"POST",rpc,args:{}})).toThrow();
    }
    expect(()=>localRequest({method:"DELETE",rpc:"resolve_event_share_link"})).toThrow();
  });
  for(const encoding of ["raw","url","base64","hex"]){
    it(`suppresses ${encoding} sensitive diagnostic output`,()=>{
      const secret="Synthetic+secret/credential";
      const variants={raw:secret,url:encodeURIComponent(secret),base64:Buffer.from(secret).toString("base64"),hex:Buffer.from(secret).toString("hex")};
      expect(()=>assertNoSensitiveOutput(variants[encoding as keyof typeof variants],[secret])).toThrow(/suppressed/);
      expect(()=>assertNoSensitiveOutput("safe bounded diagnostic",[secret])).not.toThrow();
    });
  }
});
