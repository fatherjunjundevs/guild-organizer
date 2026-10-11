// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { publicRequestSchema, parsePublicLineup, publicTokenPattern } from "./public-lineup";
import { readPublicEventConfig, PublicEventConfig, publicPoolOptions } from "./public-event-config";
import { admitPublicRequest } from "./public-event-admission";
import { createPublicEventHandler } from "./public-event-handler";
import { createPublicResolver, resolverIdentitySql, type ResolverClient } from "./public-event-resolver";
import { readBoundedJson } from "./public-bounded-json";

const token = `v1.${"A".repeat(43)}`;
const input = { token, page: 0, version: null, search: "" };
const ready = { status: "ready", eventName: "League", eventType: "Raid", version: 1,
  publishedAt: "2026-10-11T12:00:00+00:00", page: 0, pageSize: 12, totalCards: 0, matchedCards: 0, cards: [] };
const config = new PublicEventConfig("http://127.0.0.1:3000", "127.0.0.1", 5432,
  `go_share_test_${"a".repeat(32)}`, undefined, "a".repeat(32), "https://redis.example", "p".repeat(64),
  "c".repeat(32), Buffer.alloc(32,1), Buffer.alloc(32,2));
const headers = { origin: config.origin, "sec-fetch-site": "same-origin", "content-type": "application/json" };
const request = (body: unknown = input, extra: Record<string,string> = {}) => new Request(`${config.origin}/api/share/event`,
  { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });

describe("public token and minimal DTO", () => {
  it.each(["", "invalid", `v1.${"A".repeat(42)}B`, token + "=", token + "\n", token.toUpperCase()])("rejects noncanonical token %i", value => expect(publicTokenPattern.test(value)).toBe(false));
  it("accepts canonical token and no private response fields", () => {
    expect(publicRequestSchema.safeParse(input).success).toBe(true);
    expect(parsePublicLineup(ready)).toEqual(ready);
    expect(parsePublicLineup({ ...ready, guildId: "private" })).toBeNull();
    expect(parsePublicLineup({ ...ready, matchedCards: 1 })).toBeNull();
  });
  it.each([{ ...input, page: -1 }, { ...input, page: 417 }, { ...input, search: "x".repeat(81) },
    { ...input, search: "\0" }, { ...input, guildId: "another" }, { ...input, version: 0 }])("rejects bounded input violation", value => expect(publicRequestSchema.safeParse(value).success).toBe(false));
  it("supports empty structures and duplicate published IGNs without IDs", () => {
    const card = { ordinal: 1, area: null, team: "Team", party: "Party", slots: [{ name: "Seat", roleLabel: null, ign: "Hero", className: "Knight", characterRole: null }] };
    expect(parsePublicLineup({ ...ready, totalCards: 2, matchedCards: 2, cards: [card, { ...card, ordinal: 2 }] })).not.toBeNull();
    expect(parsePublicLineup({ ...ready, totalCards: 2, matchedCards: 2, cards: [card, card] })).toBeNull();
    expect(parsePublicLineup({ ...ready, totalCards: 1, matchedCards: 1, cards: [{ ...card, slots: [] }] })).not.toBeNull();
  });
  it("rejects oversized pages, slots and private nested fields", () => {
    const card = { ordinal: 1, area: null, team: "Team", party: "Party", slots: [] };
    expect(parsePublicLineup({ ...ready, cards: [ { ...card, sourceCharacterId: "private" } ] })).toBeNull();
    expect(parsePublicLineup({ ...ready, totalCards: 13, matchedCards: 13, cards: Array(13).fill(card) })).toBeNull();
    expect(parsePublicLineup({ ...ready, totalCards: 5001 })).toBeNull();
  });
});

describe("bounded stream lifetime",()=>{
  it("returns by deadline even if the source's cancel never settles",async()=>{
    const stream=new ReadableStream<Uint8Array>({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})});
    await expect(readBoundedJson(stream,1024,20)).rejects.toThrow("Invalid request");
  });
  it("rejects malformed UTF-8 without returning raw content",async()=>{
    const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array([0xff]));c.close();}});
    await expect(readBoundedJson(stream,128,20)).rejects.toThrow(/^Invalid request$/);
  });
});

describe("fail-closed public configuration", () => {
  const env = { APP_ENV: "local", SHARE_LINK_INTERFACE_ENABLED: "true", PUBLIC_EVENT_VIEWER_ENABLED: "true",
    APP_ORIGIN: config.origin, PUBLIC_EVENT_DB_HOST: "127.0.0.1", PUBLIC_EVENT_DB_NAME: config.database,
    PUBLIC_EVENT_DB_PASSWORD: "p".repeat(64), PUBLIC_EVENT_ISOLATED_RUN_ID: config.isolatedRun,
    PUBLIC_EVENT_ADMISSION_URL: "https://redis.example", PUBLIC_EVENT_ADMISSION_CREDENTIAL: "c".repeat(32),
    PUBLIC_EVENT_PROXY_KEY: Buffer.alloc(32,1).toString("base64"), PUBLIC_EVENT_ADMISSION_KEY: Buffer.alloc(32,2).toString("base64") };
  it("keeps production and staging disabled even with every flag", () => {
    expect(readPublicEventConfig({ ...env, APP_ENV: "production" })).toBeNull();
    expect(readPublicEventConfig({ ...env, APP_ENV: "staging" })).toBeNull();
    expect(readPublicEventConfig({})).toBeNull(); expect(readPublicEventConfig(env)).not.toBeNull();
  });
  it.each(["PUBLIC_EVENT_DB_PASSWORD", "PUBLIC_EVENT_ADMISSION_CREDENTIAL", "PUBLIC_EVENT_PROXY_KEY", "PUBLIC_EVENT_ADMISSION_KEY", "APP_ORIGIN"])("requires %s", field => expect(readPublicEventConfig({ ...env, [field]: "" })).toBeNull());
  it("rejects TLS exception outside exact owned local target", () => {
    expect(readPublicEventConfig({ ...env, PUBLIC_EVENT_DB_HOST: "remote.example" })).toBeNull();
    expect(readPublicEventConfig({ ...env, PUBLIC_EVENT_DB_NAME: "postgres" })).toBeNull();
    expect(readPublicEventConfig({ ...env, PUBLIC_EVENT_ADMISSION_URL: "http://redis.example" })).toBeNull();
    expect(readPublicEventConfig({ ...env, APP_ORIGIN: config.origin + "/?token=private" })).toBeNull();
  });
  it("does not serialize credential or admission secrets", () => {
    const text = JSON.stringify(config);
    expect(text).not.toContain("p".repeat(64)); expect(text).not.toContain("c".repeat(32));
    expect(text).not.toContain(Buffer.alloc(32,1).toString("base64"));
  });
  it("requires verified TLS outside the exact owned test exception and bounds the pool", () => {
    const target = new PublicEventConfig(config.origin,"database.example",5432,"guild",undefined,undefined,
      config.redisUrl,"p".repeat(64),"c".repeat(32),Buffer.alloc(32,1),Buffer.alloc(32,2));
    const options=publicPoolOptions(target);
    expect(options).toMatchObject({user:"go_event_share_reader",max:2,connectionTimeoutMillis:2000,
      query_timeout:3000,statement_timeout:2000,ssl:{rejectUnauthorized:true,minVersion:"TLSv1.2"},options:""});
    if (options.ssl === false) throw new Error("TLS required");
    type Certificate = Parameters<typeof options.ssl.checkServerIdentity>[1];
    expect(options.ssl.checkServerIdentity("wrong.example",{subjectaltname:"DNS:wrong.example"} as Certificate)).toBeInstanceOf(Error);
    expect(options.ssl.checkServerIdentity("wrong.example",{subjectaltname:"DNS:database.example"} as Certificate)).toBeUndefined();
    expect(publicPoolOptions(config).ssl).toBe(false);
    expect(readPublicEventConfig({...env,PGOPTIONS:"-c session_preload_libraries="})).toBeNull();
  });
});

describe("distributed admission", () => {
  const proxyHeaders = { "x-go-proxy-key": Buffer.alloc(32,1).toString("hex"), "x-go-client-ip": "192.0.2.1" };
  it("rejects absent or forged trusted proxy identity before remote calls", async () => {
    const transport = vi.fn(); expect(await admitPublicRequest(request(), config, transport)).toBe("unavailable");
    expect(await admitPublicRequest(request(input, { ...proxyHeaders, "x-go-proxy-key": "00".repeat(32) }), config, transport)).toBe("unavailable"); expect(transport).not.toHaveBeenCalled();
  });
  it.each([[1,"allowed"],[0,"limited"],[2,"unavailable"],[null,"unavailable"]])("validates atomic Redis result %s", async (value, expected) => {
    const transport = vi.fn().mockResolvedValue(Response.json({ result: value }));
    expect(await admitPublicRequest(request(input,proxyHeaders),config,transport)).toBe(expected);
    const command = String(transport.mock.calls[0][1].body);
    expect(command).not.toContain(token); expect(command).not.toContain("192.0.2.1"); expect(command).toContain("EVAL");
  });
  it("fails closed on service failure and avoids raw errors", async () => {
    const transport = vi.fn().mockRejectedValue(new Error(token));
    expect(await admitPublicRequest(request(input,proxyHeaders),config,transport)).toBe("unavailable");
  });
});

describe("same-origin, bounded public endpoint", () => {
  const setup = () => { const resolve = vi.fn().mockResolvedValue(ready), admit = vi.fn().mockResolvedValue("allowed");
    return { resolve, admit, handle: createPublicEventHandler({ config: () => config, admit, resolve }) }; };
  it("delivers safe DTO with no-store, no-referrer and noindex", async () => {
    const s=setup(); const response=await s.handle(request()); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toContain("noindex"); expect(await response.json()).toEqual(ready);
  });
  it.each<Record<string,string>>([{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }, { "content-type": "text/plain" }])("rejects cross-origin or content-type violation", async extra => {
    const s=setup(); expect((await s.handle(request(input,extra))).status).toBe(403); expect(s.resolve).not.toHaveBeenCalled();
  });
  it("rejects GET and query-string delivery", async () => {
    const s=setup(); expect((await s.handle(new Request(config.origin + "/api/share/event?token=private"))).status).toBe(405);
    expect((await s.handle(new Request(config.origin + "/api/share/event?token=private", { method:"POST",headers,body:JSON.stringify(input) }))).status).toBe(403);
    expect(s.resolve).not.toHaveBeenCalled();
  });
  it("rejects actual oversized stream without content-length", async () => {
    const s=setup(); expect((await s.handle(request({ ...input, search:"x".repeat(1100) }))).status).toBe(413); expect(s.resolve).not.toHaveBeenCalled();
  });
  it.each([["limited",429],["unavailable",503]])("enforces admission %s", async (outcome,status) => {
    const s=setup(); s.admit.mockResolvedValue(outcome); expect((await s.handle(request())).status).toBe(status); expect(s.resolve).not.toHaveBeenCalled();
  });
  it("fails closed on missing configuration, unknown DTO and database error", async () => {
    const s=setup(); s.resolve.mockRejectedValue(new Error(token)); const response=await s.handle(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(token);
    s.resolve.mockResolvedValue({ ...ready, privateId:"secret" }); expect((await s.handle(request())).status).toBe(503);
    expect((await createPublicEventHandler({config:()=>null,admit:s.admit,resolve:s.resolve})(request())).status).toBe(503);
  });
  it("makes unknown/revoked/unpublished links indistinguishable", async () => {
    const s=setup(); s.resolve.mockResolvedValue(null); expect((await s.handle(request())).status).toBe(404);
  });
});

describe("dedicated PostgreSQL backend", () => {
  function client(safe=true): ResolverClient {
    return { query: vi.fn(async (sql: string) => ({ rows: sql===resolverIdentitySql || sql.startsWith("select pg_catalog.current_database()") ? [{safe}] : sql.includes("resolve_lineup($1") ? [{lineup:ready}] : [] })), release: vi.fn() };
  }
  it("checks actual identity/privacy before parameterized bearer query", async () => {
    const c=client(); const resolve=createPublicResolver({connect:async()=>c}); expect(await resolve(input,config)).toEqual(ready);
    const calls=vi.mocked(c.query).mock.calls; expect(calls.findIndex(([sql])=>sql===resolverIdentitySql)).toBeLessThan(calls.findIndex(([sql])=>sql.includes("resolve_lineup($1")));
    expect(calls.every(([sql])=>!sql.includes(token))).toBe(true);
    expect(calls.find(([sql])=>sql.includes("resolve_lineup($1"))?.[1]).toEqual([token,null,0,""]);
    expect(c.release).toHaveBeenCalledWith(false);
  });
  it("denies unsafe identity/settings without submitting a token, destroys connection", async () => {
    const c=client(false); await expect(createPublicResolver({connect:async()=>c})(input,config)).rejects.toThrow("Unavailable");
    expect(vi.mocked(c.query).mock.calls.some(([sql])=>sql.includes("resolve_lineup($1"))).toBe(false); expect(c.release).toHaveBeenCalledWith(true);
  });
  it("does not expose pool/SQL errors or parameters", async () => {
    await expect(createPublicResolver({connect:async()=>{throw new Error(token);}})(input,config)).rejects.toThrow(/^Unavailable$/);
  });
  it("rejects work beyond two active backends without an unbounded waiter queue", async () => {
    let finish!: (client:ResolverClient)=>void;
    const connection=new Promise<ResolverClient>(resolve=>{finish=resolve;});
    const connect=vi.fn(()=>connection), resolve=createPublicResolver({connect});
    const a=resolve(input,config), b=resolve(input,config);
    await expect(resolve(input,config)).rejects.toThrow(/^Unavailable$/);expect(connect).toHaveBeenCalledTimes(2);
    finish(client());await Promise.all([a,b]);
  });
  it("destroys backends after query deadline failure rather than keeping abandoned work",async()=>{
    const c=client();vi.mocked(c.query).mockRejectedValue(new Error("query timeout: "+token));
    await expect(createPublicResolver({connect:async()=>c})(input,config)).rejects.toThrow(/^Unavailable$/);
    expect(c.release).toHaveBeenCalledWith(true);
  });
});
