export const PUBLICATION_HISTORY_PAGE_SIZE = 10;
export const PUBLICATION_SNAPSHOT_PAGE_SIZE = 500;

type CountedPage<T> = {
  data: T[] | null;
  count: number | null;
  error: unknown;
};

// Snapshot rows are sealed and immutable. Exact counts also detect a lower API
// row cap, interrupted reads, and visibility changes instead of accepting a
// successful but incomplete response. Callers must order every batch by id.
export async function readCompletePublicationRows<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<CountedPage<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<string>();
  let total: number | null = null;

  do {
    const page = await fetchPage(
      rows.length,
      rows.length + PUBLICATION_SNAPSHOT_PAGE_SIZE - 1,
    );
    if (page.error || page.count === null || !page.data) {
      throw new Error("Publication snapshot batch unavailable");
    }
    total ??= page.count;
    if (
      page.count !== total ||
      page.data.length !== Math.min(PUBLICATION_SNAPSHOT_PAGE_SIZE, total - rows.length)
    ) {
      throw new Error("Publication snapshot batch incomplete");
    }
    for (const row of page.data) {
      if (ids.has(row.id)) throw new Error("Publication snapshot batch repeated");
      ids.add(row.id);
      rows.push(row);
    }
  } while (rows.length < total);

  return rows;
}
