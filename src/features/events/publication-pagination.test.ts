import { describe, expect, it, vi } from "vitest";
import { readCompletePublicationRows } from "./publication-pagination";

describe("complete sealed publication batches", () => {
  it.each([0, 499, 500, 501, 1000, 1001])("reads all %i rows across API boundaries", async (count) => {
    const data = Array.from({ length: count }, (_, id) => ({ id: String(id) }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: data.slice(from, to + 1), count, error: null,
    }));
    expect(await readCompletePublicationRows(fetchPage)).toEqual(data);
    expect(fetchPage).toHaveBeenCalledTimes(Math.max(1, Math.ceil(count / 500)));
    for (const [from, to] of fetchPage.mock.calls) expect(to - from + 1).toBe(500);
  });

  it("rejects a lower API cap instead of returning a partial snapshot", async () => {
    await expect(readCompletePublicationRows(async () => ({
      data: [{ id: "only-row" }], count: 501, error: null,
    }))).rejects.toThrow("incomplete");
  });

  it("discards completed batches if a later request fails", async () => {
    const first = Array.from({ length: 500 }, (_, id) => ({ id: String(id) }));
    await expect(readCompletePublicationRows(async (from) => from === 0
      ? { data: first, count: 501, error: null }
      : { data: null, count: null, error: new Error("offline") },
    )).rejects.toThrow("unavailable");
  });

  it("rejects changing visibility and repeated rows", async () => {
    const first = Array.from({ length: 500 }, (_, id) => ({ id: String(id) }));
    await expect(readCompletePublicationRows(async (from) => ({
      data: from === 0 ? first : [], count: from === 0 ? 501 : 0, error: null,
    }))).rejects.toThrow("incomplete");
    await expect(readCompletePublicationRows(async () => ({
      data: [{ id: "duplicate" }, { id: "duplicate" }], count: 2, error: null,
    }))).rejects.toThrow("repeated");
  });
});
