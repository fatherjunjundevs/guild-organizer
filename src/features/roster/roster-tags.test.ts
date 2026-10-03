import { describe, expect, it } from "vitest";
import {
  parseRosterTagIds,
  parseRosterTagName,
} from "@/features/roster/roster-tags";

const id1 = "10000000-0000-4000-8000-000000000001";
const id2 = "10000000-0000-4000-8000-000000000002";

describe("roster tag validation", () => {
  it("trims a valid roster tag name", () => {
    expect(parseRosterTagName("  Raid Team  ")).toEqual({
      ok: true,
      value: "Raid Team",
    });
  });

  it("rejects empty and overly long tag names", () => {
    expect(parseRosterTagName("   ").ok).toBe(false);
    expect(parseRosterTagName("x".repeat(41)).ok).toBe(false);
  });

  it("accepts an empty character tag selection", () => {
    expect(parseRosterTagIds([])).toEqual({
      ok: true,
      value: [],
    });
  });

  it("deduplicates valid tag ids", () => {
    expect(parseRosterTagIds([id1, id1, id2])).toEqual({
      ok: true,
      value: [id1, id2],
    });
  });

  it("rejects invalid tag ids", () => {
    expect(parseRosterTagIds(["bad-id"]).ok).toBe(false);
  });
});
