// Common preparation for verified isolated clusters, never a development target.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot, literal } from "./isolated-postgres-test-cluster.mjs";

export const boundaryMigration = "20261010002444_event_share_link_resolver_access_boundary.sql";
export function prepareShareLinkTestDatabase(cluster, { onBoundarySubmitted = () => {}, onBoundaryCreated = () => {} } = {}) {
  const database=cluster.record.database;
  cluster.verifyDatabase();
  cluster.sql(database,cluster.dumpAuth(),"supabase_admin");
  cluster.sql(database,"create schema extensions; create extension pgcrypto with schema extensions; grant usage on schema extensions,auth to postgres,anon,authenticated,service_role; grant all on all tables in schema auth to postgres; grant all on all sequences in schema auth to postgres;","supabase_admin");
  const migrations=readdirSync(join(repositoryRoot,"supabase/migrations")).filter(n=>n.endsWith(".sql")).sort();
  const index=migrations.indexOf(boundaryMigration);
  if(index<0)throw new Error("Required committed access migration missing");
  const run=name=>cluster.sql(database,readFileSync(join(repositoryRoot,"supabase/migrations",name),"utf8"));
  for(const name of migrations.slice(0,index))run(name);
  const before=cluster.sql(database,"select pg_get_functiondef('public.resolve_event_share_link(text)'::regprocedure);");
  let applied=false;
  function applyBoundary(){
    if(applied)throw new Error("Access migration application cannot repeat");
    cluster.verifyDatabase();onBoundarySubmitted();run(boundaryMigration);applied=true;
    // Persist test-only role marker as in the established security runner.
    cluster.rawSql("postgres",`comment on role go_event_share_resolver is ${literal(`go-resolver-test:${cluster.record.runId}`)};`);
    onBoundaryCreated();
    if(before!==cluster.sql(database,"select pg_get_functiondef('public.resolve_event_share_link(text)'::regprocedure);"))throw new Error("Resolver definition changed");
    const oid=cluster.rawSql("postgres","select oid from pg_roles where rolname='go_event_share_resolver';");
    const replay=cluster.sql(database,readFileSync(join(repositoryRoot,"supabase/migrations",boundaryMigration),"utf8"),"postgres",true);
    if(replay!==null||oid!==cluster.rawSql("postgres","select oid from pg_roles where rolname='go_event_share_resolver';"))throw new Error("Role collision did not fail closed");
    for(const name of migrations.slice(index+1))run(name);
  }
  return {migrations,applyBoundary};
}
