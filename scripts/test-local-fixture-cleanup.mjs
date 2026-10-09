import { fork, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createLocalBackend, LocalFixtureRun, manifestDirectory, manifestSchema, localSql, verifiedLocalEnvironment } from "../e2e/helpers/local-fixture-lifecycle.ts";
process.chdir(resolve(import.meta.dirname, ".."));
const backend = createLocalBackend();
const directory = manifestDirectory();
const names = () => { try { return readdirSync(directory).filter(n => n.endsWith(".json")); } catch (e) { if (e.code === "ENOENT") return []; throw e; } };
const before = new Set(names());
const counts = () => localSql(backend.target, "select json_build_object('guilds',(select count(*) from public.guilds),'accounts',(select count(*) from auth.users));");
const initial = counts();
const batch = randomUUID();
const children = new Set();
async function probe(kind) {
  const child = fork(resolve('scripts/local-fixture-probe-child.mjs'), [], { env:{...process.env,GO_LOCAL_FIXTURE_BATCH:batch,GO_FIXTURE_PROBE:kind},stdio:['ignore','ignore','ignore','ipc'] });
  children.add(child);
  child.once('exit',()=>children.delete(child));
  const result = await new Promise((done,reject)=>{
    const timeout=setTimeout(()=>{child.kill();reject(new Error('Local child probe timed out'));},30000);
    child.once('error',()=>{clearTimeout(timeout);reject(new Error('Local child probe failed'));});
    child.on('message',m=>{if(m.stage==='ready'||m.stage==='failed'){clearTimeout(timeout);done({child,run:m.run});}});
    child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Local child exited before verification'));});
  });
  return result;
}
async function stop(child) {
  if(child.exitCode!==null||child.signalCode!==null)return;
  await new Promise(done=>{child.once('exit',done);child.kill();});
}
let failure;
try {
  const env = verifiedLocalEnvironment();
  for (const field of ['container','system','databaseOid','fingerprint']) {
    const wrong = createLocalBackend({...env,target:{...env.target,[field]:'incorrect-local-identity'}});
    let refused=false;try{await wrong.verifyTarget();}catch{refused=true;}
    if(!refused)throw new Error(`Wrong ${field} identity accepted`);
  }
  console.log('Real container/system/database/fingerprint mismatches rejected before fixture creation.');
  // Read-only validation of the empty-owned-Guild boundary, using an existing
  // reference only as a witness. No historical record is ever mutated here.
  const witness = localSql(backend.target,"begin read only; select created_by from public.guilds where created_by is not null order by id limit 1; rollback;").trim();
  if(witness && !(await backend.outsideReferences([witness],[])).includes('public.guilds.created_by'))throw new Error('Empty owned-Guild set failed to detect outside references');
  if(witness)console.log('Read-only outside-reference witness detected with no registered Guilds.');
  const positive = spawnSync("pnpm exec playwright test e2e/fixture-cleanup.spec.ts --workers=1 --reporter=line", { shell: true, stdio: "inherit", env: { ...process.env, GO_LOCAL_FIXTURE_BATCH:batch, GO_FIXTURE_CLEANUP_FAILURE_PROBE: "false", PLAYWRIGHT_NO_COPY_PROMPT: "1" } });
  if (positive.error || positive.status !== 0) throw new Error("Positive real cleanup checks failed");
  const negative = spawnSync("pnpm exec playwright test e2e/fixture-cleanup.spec.ts --workers=1 --reporter=json", { shell: true, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GO_LOCAL_FIXTURE_BATCH:batch, GO_FIXTURE_CLEANUP_FAILURE_PROBE: "true", PLAYWRIGHT_NO_COPY_PROMPT: "1" } });
  if (negative.error || negative.status === 0 || !negative.stdout.includes("ORIGINAL_CLEANUP_PROBE_FAILURE") || !negative.stdout.includes("Local fixture cleanup failed")) throw new Error("Failure probe did not preserve both test and teardown failures");
  console.log("Intentional failure probe: nonzero exit; original failure and cleanup failure both reported.");
  const a=await probe('partial-user'),b=await probe('partial-guild');
  let refused=false;try{await LocalFixtureRun.recover(a.run,backend,directory);}catch{refused=true;}
  if(!refused)throw new Error('Active run was eligible for recovery');
  await stop(a.child);await LocalFixtureRun.recover(a.run,backend,directory);
  const bManifest=manifestSchema.parse(JSON.parse(readFileSync(join(directory,`${b.run}.json`),'utf8')));
  if((await backend.guilds(bManifest.guilds[0])).length!==1)throw new Error('Another active run was affected');
  await stop(b.child);await LocalFixtureRun.recover(b.run,backend,directory);
  await LocalFixtureRun.recover(b.run,backend,directory);
  const c=await probe('auth-failure');
  await new Promise(done=>{if(c.child.exitCode!==null)done();else c.child.once('exit',done);});
  await LocalFixtureRun.recover(c.run,backend,directory);
  console.log('Real child interruption, lost responses, active/concurrent-run isolation, Auth deletion failure, and repeat recovery passed.');
} catch (error) { failure = error; }
finally {
  for(const child of children)await stop(child);
  // Only manifests created by these child processes are eligible; no historical
  // fixtures or other runs are searched/adopted. Recovery also checks liveness.
  const recoveryErrors = [];
  for (const name of names().filter(n => !before.has(n))) {
    let m;try{m=manifestSchema.parse(JSON.parse(readFileSync(join(directory,name),"utf8")));}
    catch{recoveryErrors.push(name);continue;}
    if(m.batch!==batch)continue;
    try { await LocalFixtureRun.recover(m.run, backend, directory); }
    catch { recoveryErrors.push(m.run); }
  }
  if (recoveryErrors.length || counts() !== initial) throw new AggregateError([...(failure ? [failure] : []), new Error(`Cleanup verification failed; inspect exact new run manifests: ${recoveryErrors.join(",")}`)]);
}
if (failure) throw failure;
console.log(`Real cleanup and interrupted/failed-run recovery passed. Before/after: ${initial}`);
