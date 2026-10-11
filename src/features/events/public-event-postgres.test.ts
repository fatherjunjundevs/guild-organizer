// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
vi.mock("server-only", () => ({}));
const driver = vi.hoisted(() => ({ options: {} as Record<string, unknown>, release: vi.fn(), end: vi.fn(),
  connect: vi.fn(), on: vi.fn(), query: vi.fn() }));
vi.mock("pg", () => ({ Pool: class {
  constructor(options: Record<string, unknown>) { driver.options = options; }
  on = driver.on; connect = driver.connect; end = driver.end;
} }));
import { publicPostgresResolver } from "./public-event-postgres";
import { PublicEventConfig } from "./public-event-config";
const config = new PublicEventConfig("http://127.0.0.1:3000", "127.0.0.1", 5432,
  `go_share_test_${"a".repeat(32)}`, undefined, "a".repeat(32), "https://redis.example",
  "p".repeat(64), "c".repeat(32), Buffer.alloc(32, 1), Buffer.alloc(32, 2));
const input = { token: `v1.${"A".repeat(43)}`, page: 0, version: null, search: "" };
beforeEach(() => {
  vi.clearAllMocks(); driver.release.mockReset(); driver.end.mockResolvedValue(undefined);
  driver.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("resolve_lineup") ? [{ lineup: null }] : [{ safe: true }] }));
  driver.connect.mockResolvedValue({ query: driver.query, release: driver.release, on: vi.fn(), removeListener: vi.fn() });
});
describe("actual PostgreSQL adapter boundary", () => {
  it("uses the fixed bounded identity and parameterized driver API, with explicit shutdown", async () => {
    const resolve = publicPostgresResolver(config);
    await expect(resolve(input, config)).resolves.toBeNull();
    expect(driver.options).toMatchObject({ user: "go_event_share_reader", max: 2, connectionTimeoutMillis: 2000, query_timeout: 3000 });
    expect(driver.query).toHaveBeenCalledWith(expect.stringContaining("resolve_lineup($1::text"), [input.token, null, 0, ""]);
    expect(driver.release).toHaveBeenCalledExactlyOnceWith(false);
    await Promise.all([resolve.close(), resolve.close()]); await expect(resolve(input, config)).rejects.toThrow("Unavailable");
    expect(driver.end).toHaveBeenCalledOnce();
  });
  it("consumes idle driver errors without logging raw messages", () => {
    publicPostgresResolver(config);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const listener = driver.on.mock.calls[0][1];
    expect(driver.on.mock.calls[0][0]).toBe("error");
    listener(new Error("PRIVATE_CREDENTIAL_DO_NOT_LOG")); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it("consumes backend errors before the asynchronous acquisition continuation", () => {
    publicPostgresResolver(config);
    const client = new EventEmitter(), connect = driver.on.mock.calls.find(call => call[0] === "connect")?.[1];
    expect(connect).toBeTypeOf("function"); connect(client);
    expect(() => client.emit("error", new Error("PRIVATE_EARLY_SOCKET_ERROR"))).not.toThrow();
  });
  it("destroys an active connection once on cancellation and never returns a late result", async () => {
    let begun!: () => void; let reject!: (error: Error) => void;
    const started = new Promise<void>(resolve => { begun = resolve; });
    driver.query.mockImplementation((sql: string) => sql.includes("resolve_lineup")
      ? new Promise((_, fail) => { reject = fail; begun(); }) : Promise.resolve({ rows: [{ safe: true }] }));
    driver.release.mockImplementation(() => reject(new Error("PRIVATE_DRIVER_FAILURE")));
    const resolve = publicPostgresResolver(config), abort = new AbortController();
    const pending = resolve(input, config, abort.signal); const result = expect(pending).rejects.toThrow("Unavailable");
    await started; abort.abort(); await result;
    expect(driver.release).toHaveBeenCalledExactlyOnceWith(true); await resolve.close();
  });
  it("does not acquire a backend for an already aborted request", async () => {
    const resolve = publicPostgresResolver(config), abort = new AbortController(); abort.abort();
    await expect(resolve(input, config, abort.signal)).rejects.toThrow("Unavailable");
    expect(driver.connect).not.toHaveBeenCalled(); await resolve.close();
  });
  it("fails closed on a checked-out socket error before sending a bearer", async () => {
    let error!: (error: Error) => void;
    driver.connect.mockResolvedValue({ query: driver.query, release: driver.release,
      on: (_name: string, listener: typeof error) => { error = listener; }, removeListener: vi.fn() });
    driver.query.mockImplementation(async () => { error(new Error("PRIVATE_SOCKET_ERROR")); return { rows: [] }; });
    const resolve = publicPostgresResolver(config);
    await expect(resolve(input, config)).rejects.toThrow("Unavailable");
    expect(driver.query).toHaveBeenCalledExactlyOnceWith("begin read only", undefined);
    expect(driver.release).toHaveBeenCalledExactlyOnceWith(true); await resolve.close();
  });
});
