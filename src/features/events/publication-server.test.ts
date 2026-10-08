import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: client }));
import { loadEventPublicationHistoryPage, loadEventPublicationState, loadEventPublicationVersionSnapshot } from "./publication-server";

type Row = Record<string, string | number | boolean | null>;
type Result = { data: Row[] | Row | null; count: number | null; error: null };
let tables: Record<string, Row[]>;
let calls: Query[];

// Model the Data API's row cap, filters and exact counts independently of the
// loader. Tests assert both results and the queries actually issued.
class Query {
  filters: [string, string, string | number][] = [];
  head = false;
  counted = false;
  single = false;
  ordering = "id";
  ascending = true;
  from = 0;
  to = 999;
  constructor(public table: string) { calls.push(this); }
  select(_columns: string, options?: { count?: string; head?: boolean }) {
    this.head = options?.head ?? false; this.counted = options?.count === "exact"; return this;
  }
  eq(key: string, value: string) { this.filters.push(["eq", key, value]); return this; }
  lt(key: string, value: number) { this.filters.push(["lt", key, value]); return this; }
  lte(key: string, value: number) { this.filters.push(["lte", key, value]); return this; }
  not(key: string) { this.filters.push(["not", key, ""]); return this; }
  order(key: string, options?: { ascending: boolean }) { this.ordering = key; this.ascending = options?.ascending ?? true; return this; }
  limit(size: number) { this.to = size - 1; return this; }
  range(from: number, to: number) { this.from = from; this.to = to; return this; }
  maybeSingle() { this.single = true; return this; }
  then(resolve: (result: Result) => unknown, reject?: (error: unknown) => unknown) {
    const rows = (tables[this.table] ?? []).filter((row) => this.filters.every(([op, key, value]) =>
      op === "eq" ? row[key] === value : op === "not" ? row[key] !== null :
      op === "lt" ? Number(row[key]) < Number(value) : Number(row[key]) <= Number(value),
    )).sort((a, b) => {
      const x = a[this.ordering], y = b[this.ordering];
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return this.ascending ? order : -order;
    });
    return Promise.resolve({
      data: this.head ? null : this.single ? rows[0] ?? null : rows.slice(this.from, Math.min(this.to + 1, this.from + 1000)),
      count: this.counted ? rows.length : null, error: null,
    }).then(resolve, reject);
  }
}

const scope = { guild_id: "guild", event_id: "event" };
function seed(versionCount = 1001) {
  tables = {
    events: [{ ...scope, id: "event" }],
    event_publications: [{ ...scope, id: "publication", status: "published", current_version_id: "v1", published_at: "now", unpublished_at: null }],
    event_publication_versions: Array.from({ length: versionCount }, (_, i) => ({
      ...scope, id: `v${i + 1}`, publication_id: "publication", version_number: i + 1,
      sealed_at: "2026-10-08T12:00:00Z", created_at: "2026-10-08T12:00:00Z",
      event_name_snapshot: "Siege", event_description_snapshot: "Sealed description",
      event_type_name_snapshot: "League", template_name_snapshot: "Template", uses_areas: false,
    })),
    event_publication_sections: [{ ...scope, id: "team", publication_version_id: "v1", area_id: null, name: "Team", sort_order: 0 }],
    event_publication_parties: [{ ...scope, id: "party", publication_version_id: "v1", section_id: "team", name: "Party", sort_order: 0 }],
    event_publication_slots: Array.from({ length: 1001 }, (_, i) => ({
      ...scope, id: `s${String(i).padStart(4, "0")}`, publication_version_id: "v1", party_id: "party", name: `Seat ${i}`, role_label: null, sort_order: i,
    })),
    event_publication_assignments: Array.from({ length: 1001 }, (_, i) => ({
      ...scope, id: `a${String(i).padStart(4, "0")}`, publication_version_id: "v1", slot_id: `s${String(i).padStart(4, "0")}`,
      source_character_id: "stable-character", character_ign_snapshot: "Sealed IGN", character_class_snapshot: "Knight",
      character_role_snapshot: "Tank", character_designation_snapshot: "main", character_status_snapshot: "inactive",
    })),
  };
}

beforeEach(() => { calls = []; seed(); client.mockResolvedValue({ from: (table: string) => new Query(table) }); });

describe("publication read boundaries", () => {
  it("loads exact totals and independently resolves an old current pointer without fetching history children", async () => {
    const result = await loadEventPublicationState("guild", "event");
    expect(result).toMatchObject({ status: "ready", historyCount: 1001,
      publication: { currentVersionNumber: 1, latestVersionNumber: 1001 } });
    expect(calls).toHaveLength(3);
    expect(calls.some((call) => call.table === "event_publication_slots")).toBe(false);
    expect(calls.find((call) => call.counted)?.to).toBe(0);
  });

  it("pages all versions deterministically and counts seats beyond the API cap without downloading them", async () => {
    const first = await loadEventPublicationHistoryPage("guild", "event");
    expect(first?.versions.map((v) => v.versionNumber)).toEqual([1001, 1000, 999, 998, 997, 996, 995, 994, 993, 992]);
    expect(first).toMatchObject({ totalVersions: 1001, nextBeforeVersion: 992, maxVersionNumber: 1001 });
    tables.event_publication_versions.push({ ...tables.event_publication_versions[0], id: "v1002", version_number: 1002 });
    const second = await loadEventPublicationHistoryPage("guild", "event", first!.nextBeforeVersion, first!.maxVersionNumber);
    expect(second?.versions[0].versionNumber).toBe(991);
    expect(second?.totalVersions).toBe(1001);
    const last = await loadEventPublicationHistoryPage("guild", "event", 2, 1001);
    expect(last).toMatchObject({ nextBeforeVersion: null, versions: [{ versionNumber: 1, slotCount: 1001, assignmentCount: 1001, isCurrent: true }] });
    const childQueries = calls.filter((call) => ["event_publication_slots", "event_publication_assignments"].includes(call.table));
    expect(childQueries.every((call) => call.head && call.counted)).toBe(true);
  });

  it("assembles a complete snapshot beyond 1000 rows and preserves sealed inactive duplicate assignments", async () => {
    const result = await loadEventPublicationVersionSnapshot("guild", "event", "v1");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("snapshot missing");
    expect(result.snapshot.version).toMatchObject({ slotCount: 1001, assignmentCount: 1001 });
    expect(result.snapshot.structure.rootSections[0].parties[0].slots).toHaveLength(1001);
    expect(result.snapshot.characters).toHaveLength(1);
    expect(result.snapshot.characters[0]).toMatchObject({ ign: "Sealed IGN", status: "inactive" });
    expect(result.snapshot.characters[0].assignedSlotIds).toHaveLength(1001);
    for (const call of calls) {
      expect(call.filters).toContainEqual(["eq", "guild_id", "guild"]);
      expect(call.filters).toContainEqual(["eq", "event_id", "event"]);
      if (!["event_publications", "event_publication_versions"].includes(call.table)) {
        expect(call.filters).toContainEqual(["eq", "publication_version_id", "v1"]);
        expect(call.ordering).toBe("id");
        expect(call.to - call.from + 1).toBe(500);
      }
    }
  });

  it("rejects foreign Guild or Event version identifiers before child reads", async () => {
    expect(await loadEventPublicationVersionSnapshot("foreign", "event", "v1")).toEqual({ status: "not-found", snapshot: null });
    expect(await loadEventPublicationVersionSnapshot("guild", "foreign", "v1")).toEqual({ status: "not-found", snapshot: null });
    expect(calls.every((call) => call.table === "event_publication_versions")).toBe(true);
  });
});
