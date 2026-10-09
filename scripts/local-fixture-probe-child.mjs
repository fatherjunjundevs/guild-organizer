// Only invoked by the guarded cleanup verifier. It intentionally leaves a new
// manifest-owned fixture for its parent to recover after confirmed child exit.
import { createClient } from "@supabase/supabase-js";
import { LocalFixtureRun, createLocalBackend, ownershipTag, verifiedLocalEnvironment } from "../e2e/helpers/local-fixture-lifecycle.ts";
if (!process.send || !['partial-user','partial-guild','auth-failure'].includes(process.env.GO_FIXTURE_PROBE)) throw new Error('Guarded child invocation required');
const env = verifiedLocalEnvironment();
const backend = createLocalBackend(env);
const run = await LocalFixtureRun.start(backend);
process.send({run:run.record.run,stage:'intent'});
const intent = run.userIntent();
const admin = createClient(env.apiUrl,env.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
run.submitted(intent);
const {data,error} = await admin.auth.admin.createUser({email:intent.email,email_confirm:true,app_metadata:{go_e2e_fixture:ownershipTag(run.record,intent)}});
if(error||!data.user)throw new Error('Local probe creation failed');
if(process.env.GO_FIXTURE_PROBE!=='partial-user')await run.registeredUser(intent,data.user.id);
if(process.env.GO_FIXTURE_PROBE==='partial-guild') {
  const client = createClient(env.apiUrl,env.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'magiclink',email:intent.email});
  if(linkError)throw new Error('Local probe login failed');
  const {error:sessionError}=await client.auth.verifyOtp({type:'email',token_hash:link.properties.hashed_token});
  if(sessionError)throw new Error('Local probe login failed');
  const guild=run.guildIntent(data.user.id);
  run.submitted(guild);
  const {data:id,error:guildError}=await client.rpc('create_guild',{p_name:guild.name});
  if(guildError||!id)throw new Error('Local probe Guild creation failed');
  // Deliberately lose the response before registering ID, like interruption.
}
if(process.env.GO_FIXTURE_PROBE==='auth-failure') {
  backend.deleteUser=async()=>{throw new Error('Injected Auth deletion rejection');};
  try { await run.cleanup(); throw new Error('Failure probe unexpectedly succeeded'); }
  catch(error) { if(!String(error).includes('Local fixture cleanup failed'))throw error; }
  process.send({run:run.record.run,stage:'failed'});
  process.disconnect();
} else process.send({run:run.record.run,stage:'ready'});
