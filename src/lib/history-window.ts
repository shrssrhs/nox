export interface HistoryCursor { id: string; created_at: string }

/** Keyset pages stay below PostgREST's row cap, even after loading a long chat. */
export async function readHistoryWindow<T extends HistoryCursor>(
  size: number,
  fetchPage: (limit: number, cursor: HistoryCursor | null) => Promise<T[]>,
) {
  const rows: T[] = [];
  let cursor: HistoryCursor | null = null;
  while (rows.length <= size) {
    const limit = Math.min(1000, size + 1 - rows.length);
    const page = await fetchPage(limit, cursor);
    rows.push(...page);
    if (page.length < limit) break;
    cursor = page.at(-1) ?? null;
  }
  return { records: rows.slice(0, size), hasMore: rows.length > size };
}
