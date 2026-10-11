// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/features/events/public-event-handler", async importOriginal => {
  const actual = await importOriginal<typeof import("@/features/events/public-event-handler")>();
  return { ...actual, publicHandlerConfig: () => null };
});
import { POST, GET, HEAD, OPTIONS, runtime, dynamic } from "./route";
it("keeps the actual Node route closed before inspecting a body when configuration is missing", async () => {
  expect(runtime).toBe("nodejs"); expect(dynamic).toBe("force-dynamic");
  const response = await POST(new Request("http://127.0.0.1/api/share/event", { method: "POST", body: "not JSON" }));
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: "unavailable" });
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it("rejects non-POST methods at the actual route boundary", async () => {
  for (const [method, handler] of [["GET", GET], ["HEAD", HEAD], ["OPTIONS", OPTIONS]] as const) {
    const response = await handler(new Request("http://127.0.0.1/api/share/event", { method }));
    expect(response.status).toBe(405); expect(response.headers.get("allow")).toBe("POST");
  }
});
