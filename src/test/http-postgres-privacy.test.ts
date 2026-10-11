// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { assertHttpPrivacy, inspectPostgresLogs } from "../../scripts/http-postgres-privacy.mjs";
import { httpSharedLibraries } from "../../scripts/isolated-postgres-test-cluster.mjs";
const cluster=()=>({record:{containerId:"b".repeat(64)},verify:vi.fn(()=>({host:{LogConfig:{Type:"json-file",Config:{}}}}))});
const logs=(text='FATAL: password authentication failed for user "postgres"\n')=>({status:0,stdout:Buffer.from(text),stderr:Buffer.alloc(0),error:null,signal:null});
describe("HTTP PostgreSQL privacy prerequisites",()=>{
 it.each(["","f","t\nextra"])("rejects missing administrative evidence %j",value=>{
  const c={record:{database:`go_share_test_${"a".repeat(32)}`,startupProfile:"http-private-v1"},verifyDatabase:vi.fn(),rawSql:vi.fn(()=>value)};
  expect(()=>assertHttpPrivacy(c)).toThrow(/privacy prerequisite/);
 });
 it("requires two independent administrative contexts",()=>{
  const c={record:{database:`go_share_test_${"a".repeat(32)}`,startupProfile:"http-private-v1"},verifyDatabase:vi.fn(),rawSql:vi.fn(()=> "t")};
  assertHttpPrivacy(c);expect((c.rawSql.mock.calls as unknown as [string,string,string][]).map(c=>c[2])).toEqual(["supabase_admin","postgres"]);
 });
 it("collects complete logs without returning their contents",()=>{
  const c=cluster(),r=logs(),execute=vi.fn(()=>r);
  expect(inspectPostgresLogs(c,[],execute)).toMatchObject({complete:true,sensitiveMatches:0});
  expect((execute.mock.calls as unknown as [string,string[]][])[0][1]).toEqual(["logs",c.record.containerId]);
  expect(r.stdout.every(b=>b===0)).toBe(true);
 });
 it.each(["synthetic-token-abcdefgh",encodeURIComponent("synthetic token abcdefgh"),
  Buffer.from("synthetic-token-abcdefgh").toString("base64"),Buffer.from("synthetic-token-abcdefgh").toString("hex")])(
  "rejects secret variants without exposing them",value=>{
   const r=logs("database system is ready to accept connections\n"+value);
   expect(()=>inspectPostgresLogs(cluster(),["synthetic-token-abcdefgh","synthetic token abcdefgh"],()=>r)).toThrow(/Sensitive/);
   expect(r.stdout.every(b=>b===0)).toBe(true);
 });
 it.each([()=>({...logs(),status:1}),()=>({...logs(),error:new Error("synthetic-secret")}),
  ()=>({...logs(),stdout:null}),()=>logs(""),()=>logs("x".repeat(1024*1024+1))])(
  "rejects incomplete or oversized log evidence",factory=>expect(()=>inspectPostgresLogs(cluster(),[],factory)).toThrow());
 it("rejects unknown and rotating Docker log sinks",()=>{
  for(const log of [{Type:"none",Config:{}},{Type:"json-file",Config:{"max-size":"1k"}}]){
   const c={record:{containerId:"b".repeat(64)},verify:vi.fn(()=>({host:{LogConfig:log}}))},execute=vi.fn(()=>logs());
   expect(()=>inspectPostgresLogs(c,[],execute)).toThrow(/log sink/);expect(execute).not.toHaveBeenCalled();
  }
 });
 it("preserves the shared-hook prohibition without application settings membership",()=>{
  expect(httpSharedLibraries.split(",")).toHaveLength(9);expect(httpSharedLibraries).not.toMatch(/pgaudit|auto_explain/);
  const sql=readFileSync(new URL("../../scripts/sql/http-privacy-inspection.sql",import.meta.url),"utf8");
  expect(sql).toContain("returns boolean");expect(sql).toContain("security definer");
  expect(sql).toContain("set search_path = pg_catalog, pg_temp");expect(sql).toContain("exception when others then return false");
  expect(sql).toContain("current_setting('shared_preload_libraries') !~ '(pgaudit|auto_explain)'");
  expect(sql).not.toMatch(/grant pg_read_all_settings|create function public\./i);
  const auth=readFileSync(new URL("../../scripts/sql/scram-preload-inspection.sql",import.meta.url),"utf8");
  expect(auth).toContain("pg_catalog.has_function_privilege(r,f,'EXECUTE') is distinct from (r='authenticator')");
  const harness=readFileSync(new URL("../../scripts/docker/postgrest-http/harness.mjs",import.meta.url),"utf8");
  expect(harness).toContain('db-schemas = "public"');expect(harness).toContain("db-config = false");
 });
});
