// Read-only inspection. Produces review inventories, never deletion commands.
import { resolve } from "node:path";
import { prepareInventoryOutput, inventorySummary } from "./local-inventory-output.mjs";
import { verifiedLocalEnvironment, localSql, profileReferences, scopedTables } from "../e2e/helpers/local-fixture-lifecycle.ts";
const root = resolve(import.meta.dirname, ".."); process.chdir(root);
if (process.argv.length !== 2) throw new Error("Inventory output is local-only; command-line output overrides are unsupported.");
const output = prepareInventoryOutput(root);
const { target } = verifiedLocalEnvironment();
const quote = v => '"'+v.replaceAll('"','""')+'"';
const literal = v => "'"+v.replaceAll("'","''")+"'";
const dependent = scopedTables(target).map(t => `${literal(`${t.schema}.${t.table}`)},(select count(*) from ${quote(t.schema)}.${quote(t.table)} where guild_id=g.id)`);
const references = profileReferences(target).filter(f => f.table !== "profiles").map(f => `select u.id as user_id,${literal(`${f.schema}.${f.table}.${f.column}`)} as reference,${f.scope ? `r.${quote(f.scope)}::text` : "null::text"} as scope_id,count(*) from candidate_users u join ${quote(f.schema)}.${quote(f.table)} r on r.${quote(f.column)}=u.id where ${f.scope ? `not exists(select 1 from candidate_guilds owned where owned.created_by=u.id and owned.id=r.${quote(f.scope)})` : "true"} group by u.id${f.scope ? `,r.${quote(f.scope)}` : ""}`);
const report = JSON.parse(localSql(target, `begin isolation level repeatable read read only;
  with candidate_users as (select id,email,created_at from auth.users where email ~ '^(owner-e2e|role-owner|role-actor|event-builder-e2e|sharing-actor)-[0-9a-f-]{36}@example[.]test$'),
  candidate_guilds as (select g.* from public.guilds g where g.created_by in (select id from candidate_users) or g.name ~ '^(Roster|Role|Event Builder) E2E [0-9a-f]{8}$'),
  outside_refs as (${references.join(" union all ")})
  select json_build_object('captured_at',clock_timestamp(),'target',${literal(JSON.stringify(target))}::json,
    'totals',json_build_object('guilds',(select count(*) from public.guilds),'accounts',(select count(*) from auth.users),'marked_guilds',(select count(*) from candidate_guilds),'marked_accounts',(select count(*) from candidate_users)),
    'unmatched_guilds',(select coalesce(json_agg(json_build_object('id',id,'name',name,'created_by',created_by,'created_at',created_at,'status',status)),'[]') from public.guilds where id not in(select id from candidate_guilds)),
    'unmatched_accounts',(select coalesce(json_agg(json_build_object('id',id,'created_at',created_at)),'[]') from auth.users where id not in(select id from candidate_users)),
    'accounts',(select coalesce(json_agg(json_build_object('id',u.id,'email',u.email,'created_at',u.created_at,'memberships',(select coalesce(json_agg(json_build_object('id',m.id,'guild_id',m.guild_id,'role',m.role,'status',m.status,'created_at',m.created_at)),'[]') from public.guild_memberships m where user_id=u.id)) order by u.created_at),'[]') from candidate_users u),
    'guilds',(select coalesce(json_agg(json_build_object('id',g.id,'name',g.name,'created_by',g.created_by,'status',g.status,'created_at',g.created_at,
      'memberships',(select coalesce(json_agg(json_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'status',m.status,'created_at',m.created_at)),'[]') from public.guild_memberships m where guild_id=g.id),
      'events',(select coalesce(json_agg(json_build_object('id',e.id,'name',e.name,'status',e.status,'created_at',e.created_at)),'[]') from public.events e where guild_id=g.id),
      'publications',(select coalesce(json_agg(json_build_object('id',p.id,'event_id',p.event_id,'status',p.status,'current_version_id',p.current_version_id)),'[]') from public.event_publications p where guild_id=g.id),
      'versions',(select coalesce(json_agg(json_build_object('id',v.id,'event_id',v.event_id,'version_number',v.version_number,'created_at',v.created_at,'sealed_at',v.sealed_at)),'[]') from public.event_publication_versions v where guild_id=g.id),
      'share_links',(select coalesce(json_agg(json_build_object('id',l.id,'event_id',l.event_id,'created_at',l.created_at,'revoked_at',l.revoked_at)),'[]') from private.event_share_links l where guild_id=g.id),
      'dependent_counts',json_build_object(${dependent.join(",")})) order by g.created_at),'[]') from candidate_guilds g),
    'outside_references',(select coalesce(json_agg(outside_refs),'[]') from outside_refs)); rollback;`));
const users = new Map(report.accounts.map(u => [u.id,u]));
const proposed = [], held = [];
for (const guild of report.guilds) {
  const owner = users.get(guild.created_by);
  const marker = owner?.email.match(/^(owner-e2e|role-owner|event-builder-e2e)-([0-9a-f-]{36})@example\.test$/);
  const expected = marker ? `${{ 'owner-e2e':'Roster', 'role-owner':'Role', 'event-builder-e2e':'Event Builder' }[marker[1]]} E2E ${marker[2].slice(0,8)}` : null;
  const reasons = [];
  if (!owner || !marker || guild.name !== expected) reasons.push("name/email creation marker mismatch");
  if (report.guilds.filter(g => g.created_by===guild.created_by).length !== 1) reasons.push("owner has multiple candidate Guilds");
  if (guild.memberships.length !== 1 || guild.memberships[0].user_id !== guild.created_by || guild.memberships[0].role !== 'owner' || guild.memberships[0].status !== 'active') reasons.push("unexpected membership relationship");
  if (owner && Math.abs(new Date(guild.created_at)-new Date(owner.created_at))>60000) reasons.push("creation timestamps differ by more than one minute");
  if (report.outside_references.some(r=>r.user_id===guild.created_by)) reasons.push("references outside candidate Guild");
  const cohort = owner?.created_at >= '2026-10-09T18:10:12' && owner?.created_at <= '2026-10-09T18:14:00' ? 'authorization-repair-validation' : owner?.created_at >= '2026-10-09T17:21:00' && owner?.created_at <= '2026-10-09T17:35:00' ? 'original-audit-validation' : 'earlier-validation';
  const item = { guild_id:guild.id,user_id:guild.created_by,guild_name:guild.name,email:owner?.email,guild_created_at:guild.created_at,user_created_at:owner?.created_at,cohort,dependent_counts:guild.dependent_counts };
  if (reasons.length) held.push({...item,reasons}); else proposed.push(item);
}
const plan = { captured_at:report.captured_at,target:report.target,authorization:'NOT APPROVED FOR DELETION',limitations:'Legacy markers are corroborating evidence, not new lifecycle ownership proof. Independent exact-ID approval and fresh transactional verification required. The automatic recovery tool must refuse these fixtures.',proposed,held };
output.write(report, plan);
console.log(JSON.stringify(inventorySummary(report, plan)));
