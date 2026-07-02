/**
 * History (Anti-Repeat) Module
 *
 * Tracks which movies the user has recently seen, so the "换一部" button
 * doesn't repeat within a rolling window.
 *
 * Storage: localStorage (per-browser, no cross-device sync).
 * Limit: 30 entries; older than 30 days are pruned on read.
 */

const HISTORY_KEY = "daily-movie-shown-history";
const HISTORY_LIMIT = 30;
const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface HistoryEntry {
  id: string;
  shownAt: number; // Date.now()
}

function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const test = "__test__";
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function readRaw(): HistoryEntry[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as HistoryEntry).id === "string" &&
        typeof (e as HistoryEntry).shownAt === "number"
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: HistoryEntry[]): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("[history] Failed to write history:", err);
  }
}

/** Returns the recent, in-window history (old entries pruned). */
export function getHistory(): HistoryEntry[] {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  const pruned = readRaw().filter((e) => e.shownAt >= cutoff);
  // Persist pruning
  if (pruned.length !== readRaw().length) {
    writeRaw(pruned);
  }
  return pruned;
}

/** Returns the set of movie IDs the user has seen recently. */
export function getHistoryIds(): Set<string> {
  return new Set(getHistory().map((e) => e.id));
}

/**
 * Add a movie ID to the history.
 * Maintains FIFO cap of HISTORY_LIMIT.
 */
export function addToHistory(id: string): void {
  if (!isStorageAvailable()) return;
  const now = Date.now();
  const current = readRaw();
  // Remove existing entry for this id (FIFO dedup)
  const filtered = current.filter((e) => e.id !== id);
  filtered.push({ id, shownAt: now });
  // Cap at HISTORY_LIMIT, keeping most recent
  const trimmed = filtered.slice(-HISTORY_LIMIT);
  writeRaw(trimmed);
}

/** Clear all history. Useful for testing or user-triggered reset. */
export function clearHistory(): void {
  if (!isStorageAvailable()) return;
  window.localStorage.removeItem(HISTORY_KEY);
}

export { HISTORY_LIMIT, HISTORY_TTL_MS };
