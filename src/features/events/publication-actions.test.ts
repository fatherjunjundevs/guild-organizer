import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), state: vi.fn(), snapshot: vi.fn(), history: vi.fn(), rpc: vi.fn(), visible: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./publication-server", () => ({ loadEventPublicationState: mocks.state,
  loadEventPublicationVersionSnapshot: mocks.snapshot, loadEventPublicationHistoryPage: mocks.history }));
import { loadEventPublicationHistoryAction, loadEventPublicationVersionAction, publishEventAction, updateEventPublicationAction, unpublishEventAction, refreshEventPublicationAction } from "./publication-actions";
import { publicationState } from "@/test/publication-fixtures";

const guildId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
let filters: [string, string][];
function input() {
  const data = new FormData(); data.set("guildId", guildId); data.set("eventId", eventId); data.set("versionId", versionId); return data;
}
beforeEach(() => {
  vi.resetAllMocks(); filters = [];
  const query = { select: () => query, eq: (key: string, value: string) => { filters.push([key, value]); return query; }, maybeSingle: mocks.visible };
  mocks.visible.mockResolvedValue({ data: { id: eventId }, error: null });
  mocks.createClient.mockResolvedValue({ from: () => query, rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: versionId, error: null });
});

describe("publication action security and recovery", () => {
  it.each([publishEventAction, updateEventPublicationAction, unpublishEventAction])("preserves confirmed mutation success when its status read rejects", async (action) => {
    mocks.state.mockRejectedValue(new Error("read interrupted"));
    expect(await action(input())).toMatchObject({ ok: true, publication: null, historyCount: null });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    mocks.state.mockResolvedValue({ status: "ready", publication: publicationState, historyCount: 2 });
    expect(await refreshEventPublicationAction(input())).toEqual({ publication: publicationState, historyCount: 2 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("requires an RLS-visible Guild-scoped Event for every read entry point", async () => {
    mocks.visible.mockResolvedValue({ data: null, error: null });
    expect(await loadEventPublicationVersionAction(input())).toMatchObject({ ok: false });
    expect(await loadEventPublicationHistoryAction(input())).toMatchObject({ ok: false });
    expect(await refreshEventPublicationAction(input())).toBeNull();
    expect(filters).toContainEqual(["guild_id", guildId]); expect(filters).toContainEqual(["id", eventId]);
    expect(mocks.snapshot).not.toHaveBeenCalled(); expect(mocks.history).not.toHaveBeenCalled(); expect(mocks.state).not.toHaveBeenCalled();
  });

  it("passes all validated scope identifiers to snapshot reads and rejects invalid cursors before querying", async () => {
    mocks.snapshot.mockResolvedValue({ status: "not-found", snapshot: null });
    expect(await loadEventPublicationVersionAction(input())).toMatchObject({ ok: false });
    expect(mocks.snapshot).toHaveBeenCalledWith(guildId, eventId, versionId);
    const data = input(); data.set("beforeVersion", "-1");
    mocks.visible.mockClear();
    expect(await loadEventPublicationHistoryAction(data)).toMatchObject({ ok: false });
    expect(mocks.visible).not.toHaveBeenCalled();
    data.set("beforeVersion", "1.5");
    expect(await loadEventPublicationHistoryAction(data)).toMatchObject({ ok: false });
    data.set("beforeVersion", "Infinity");
    expect(await loadEventPublicationHistoryAction(data)).toMatchObject({ ok: false });
  });
});
