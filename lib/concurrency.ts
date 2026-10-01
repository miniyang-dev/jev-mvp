/** Runs `worker` over `items` with at most `limit` running concurrently.
 * Results are returned in the same order as `items`; each item's outcome
 * is reported to `onSettled` as soon as it finishes, regardless of order. */
export async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (index: number, result: { ok: true; value: R } | { ok: false; error: unknown }) => void
): Promise<({ ok: true; value: R } | { ok: false; error: unknown })[]> {
  const results: ({ ok: true; value: R } | { ok: false; error: unknown })[] = new Array(items.length);
  let nextIndex = 0;

  async function runOne() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        const value = await worker(items[index], index);
        const outcome = { ok: true as const, value };
        results[index] = outcome;
        onSettled?.(index, outcome);
      } catch (error) {
        const outcome = { ok: false as const, error };
        results[index] = outcome;
        onSettled?.(index, outcome);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, runOne));
  return results;
}
