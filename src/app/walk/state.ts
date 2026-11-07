export const WALK_KEY = "daily-movie:walk:v1";
export const MAX_POOL = 1000;
export const MAX_HISTORY = 100;
export type WalkState = {
  version: 1;
  active: boolean;
  poolVersion: string;
  history: string[];
  cursor: number;
  unseen: string[];
  seen: string[];
  round: number;
};
const validId = (x: unknown): x is string =>
  typeof x === "string" &&
  x.length <= 100 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
const unique = (ids: string[]) => [...new Set(ids)];
export const poolVersion = (ids: string[]) => unique(ids).sort().join("~");
export function shuffle<T>(values: readonly T[], random = Math.random): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function startWalk(
  ids: string[],
  current: string,
  random = Math.random,
): WalkState {
  const pool = unique(ids);
  if (!pool.length || pool.length > MAX_POOL || !pool.includes(current))
    throw Error("Invalid walk pool");
  return {
    version: 1,
    active: true,
    poolVersion: poolVersion(pool),
    history: [current],
    cursor: 0,
    unseen: shuffle(
      pool.filter((id) => id !== current),
      random,
    ),
    seen: [current],
    round: 1,
  };
}
export function nextId(state: WalkState): string | null {
  return state.cursor < state.history.length - 1
    ? state.history[state.cursor + 1]
    : (state.unseen[0] ?? null);
}
export function advance(state: WalkState, id: string): WalkState {
  if (state.cursor < state.history.length - 1) {
    if (state.history[state.cursor + 1] !== id) throw Error("History mismatch");
    return { ...state, cursor: state.cursor + 1 };
  }
  if (state.unseen[0] !== id) throw Error("Candidate mismatch");
  const history = [...state.history, id].slice(-MAX_HISTORY);
  return {
    ...state,
    history,
    cursor: history.length - 1,
    unseen: state.unseen.slice(1),
    seen: unique([...state.seen, id]),
  };
}
export function goBack(state: WalkState): WalkState {
  return { ...state, cursor: Math.max(0, state.cursor - 1) };
}
export function newRound(
  state: WalkState,
  ids: string[],
  random = Math.random,
): WalkState {
  const current = state.history[state.cursor];
  return {
    ...state,
    active: true,
    poolVersion: poolVersion(ids),
    unseen: shuffle(
      unique(ids).filter((id) => id !== current),
      random,
    ),
    seen: [current],
    round: state.round + 1,
  };
}
export function reconcile(
  state: WalkState,
  ids: string[],
  current: string,
  random = Math.random,
): WalkState {
  const allowed = new Set(ids),
    history = state.history.filter((id) => allowed.has(id));
  if (!history.includes(current)) return startWalk(ids, current, random);
  const seen = state.seen.filter((id) => allowed.has(id));
  return {
    ...state,
    active: true,
    poolVersion: poolVersion(ids),
    history,
    cursor:
      state.history[state.cursor] === current
        ? state.history
            .slice(0, state.cursor + 1)
            .filter((id) => allowed.has(id)).length - 1
        : history.lastIndexOf(current),
    seen,
    unseen:
      state.poolVersion === poolVersion(ids)
        ? state.unseen.filter((id) => allowed.has(id) && !seen.includes(id))
        : shuffle(
            unique(ids).filter((id) => !seen.includes(id)),
            random,
          ),
  };
}
export function removeUnavailable(
  state: WalkState,
  id: string,
  ids: string[],
): WalkState | null {
  const current = state.history[state.cursor];
  const history = state.history.filter((x) => x !== id && ids.includes(x));
  if (!history.length || !ids.length) return null;
  const cursor = history.includes(current)
    ? state.history
        .slice(0, state.cursor + 1)
        .filter((x) => x !== id && ids.includes(x)).length - 1
    : Math.min(state.cursor, history.length - 1);
  const seen = state.seen.filter((x) => x !== id && ids.includes(x));
  const unseen =
    state.poolVersion === poolVersion(ids)
      ? state.unseen.filter((x) => x !== id && ids.includes(x))
      : shuffle(ids.filter((x) => !seen.includes(x)));
  return {
    ...state,
    poolVersion: poolVersion(ids),
    history,
    cursor,
    seen,
    unseen,
  };
}
export function decodeWalk(raw: string): WalkState | null {
  try {
    if (raw.length > 600000) return null;
    const s: unknown = JSON.parse(raw);
    if (!s || typeof s !== "object") return null;
    const v = s as Record<string, unknown>;
    const array = (x: unknown, max: number): x is string[] =>
      Array.isArray(x) && x.length <= max && x.every(validId);
    if (
      v.version !== 1 ||
      typeof v.active !== "boolean" ||
      typeof v.poolVersion !== "string" ||
      v.poolVersion.length > 101000 ||
      !array(v.history, MAX_HISTORY) ||
      !v.history.length ||
      !array(v.unseen, MAX_POOL) ||
      !array(v.seen, MAX_POOL) ||
      !Number.isSafeInteger(v.cursor) ||
      Number(v.cursor) < 0 ||
      Number(v.cursor) >= v.history.length ||
      !Number.isSafeInteger(v.round) ||
      Number(v.round) < 1 ||
      unique(v.seen).length !== v.seen.length ||
      unique(v.unseen).length !== v.unseen.length ||
      v.unseen.some((id) => (v.seen as string[]).includes(id))
    )
      return null;
    if (
      poolVersion([...v.seen, ...v.unseen]) !== v.poolVersion ||
      v.history.some(
        (id) =>
          ![...(v.seen as string[]), ...(v.unseen as string[])].includes(id),
      )
    )
      return null;
    return {
      version: 1,
      active: v.active,
      poolVersion: v.poolVersion,
      history: v.history,
      cursor: Number(v.cursor),
      unseen: v.unseen,
      seen: v.seen,
      round: Number(v.round),
    };
  } catch {
    return null;
  }
}
