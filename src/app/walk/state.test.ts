import { describe, it, expect } from "vitest";
import {
  advance,
  decodeWalk,
  goBack,
  MAX_HISTORY,
  newRound,
  nextId,
  reconcile,
  removeUnavailable,
  startWalk,
  shuffle,
  type WalkState,
} from "./state";
const ids = Array.from({ length: 12 }, (_, i) => `film-${i}`);
function rng(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function exhaust(state: WalkState) {
  const path: string[] = [];
  while (nextId(state)) {
    const id = nextId(state)!;
    path.push(id);
    state = advance(state, id);
  }
  return { state, path };
}
describe("without-replacement walk state", () => {
  it("draws the other11 exactly once and never immediately repeats across rounds", () => {
    const s = startWalk(ids, ids[0], rng(73));
    const { state, path } = exhaust(s);
    expect(path).toHaveLength(11);
    expect(new Set(path).size).toBe(11);
    expect(path).not.toContain(ids[0]);
    expect(state.seen).toHaveLength(12);
    const next = newRound(state, ids, rng(74));
    expect(nextId(next)).not.toBe(state.history.at(-1));
    expect(next.history).toEqual(state.history);
    expect(next.seen).toEqual([state.history.at(-1)]);
  });
  it("seeded Fisher–Yates is deterministic and every eligible item can be first", () => {
    expect(shuffle(ids, rng(8))).toEqual(shuffle(ids, rng(8)));
    const reachable = new Set(
      Array.from({ length: 2000 }, (_, i) =>
        nextId(startWalk(ids, ids[0], rng(i + 1))),
      ),
    );
    expect([...reachable].sort()).toEqual(ids.slice(1).sort());
  });
  it("back/forward replays the stored path without consuming or reshuffling", () => {
    let s = startWalk(ids, ids[0], rng(9));
    s = advance(s, nextId(s)!);
    s = advance(s, nextId(s)!);
    const last = s.history.at(-1),
      bag = [...s.unseen],
      seen = [...s.seen];
    const back = goBack(s);
    expect(nextId(back)).toBe(last);
    const forward = advance(back, last!);
    expect(forward.unseen).toEqual(bag);
    expect(forward.seen).toEqual(seen);
    expect(forward.history).toEqual(s.history);
  });
  it("caps actual path at100 without lowering unique encountered count", () => {
    const many = Array.from({ length: 120 }, (_, i) => `many-${i}`);
    let s = startWalk(many, many[0], rng(11));
    s = exhaust(s).state;
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.cursor).toBe(99);
    expect(s.seen).toHaveLength(120);
    expect(decodeWalk(JSON.stringify(s))).toEqual(s);
  });
  it("preserves duplicate history occurrence when refreshing an older round position", () => {
    let s = exhaust(startWalk(["a", "b"], "a", () => 0)).state;
    s = newRound(s, ["a", "b"], () => 0);
    s = advance(s, nextId(s)!);
    expect(s.history).toEqual(["a", "b", "a"]);
    s = goBack(goBack(s));
    expect(s.cursor).toBe(0);
    expect(reconcile(s, ["a", "b"], "a").cursor).toBe(0);
  });
  it("reconciles added/withdrawn pool ids without erasing valid history", () => {
    let s = startWalk(["a", "b", "c"], "a", () => 0);
    s = advance(s, nextId(s)!);
    const r = reconcile(s, ["a", s.history[1], "new"], "a", () => 0);
    expect(r.history).toEqual(s.history);
    expect([...r.seen, ...r.unseen].sort()).toEqual(
      ["a", s.history[1], "new"].sort(),
    );
    expect(r.unseen).toContain("new");
    expect(decodeWalk(JSON.stringify(r))).toEqual(r);
  });
  it("removes404 without losing current history position, including duplicated ids", () => {
    let s = exhaust(startWalk(["a", "b", "c"], "a", () => 0)).state;
    s = newRound(s, ["a", "b", "c"], () => 0);
    s = advance(s, nextId(s)!);
    const current = s.history[s.cursor];
    const remove = ["a", "b", "c"].find((id) => id !== current)!;
    const r = removeUnavailable(
      s,
      remove,
      ["a", "b", "c", "new"].filter((id) => id !== remove),
    );
    expect(r?.history[r.cursor]).toBe(current);
    expect(r?.unseen).not.toContain(remove);
    expect(decodeWalk(JSON.stringify(r))).toEqual(r);
  });
  it("handles1/2 members honestly and rejects empty/oversize/invalid roots", () => {
    const one = startWalk(["a"], "a");
    expect(nextId(one)).toBeNull();
    const two = startWalk(["a", "b"], "a");
    expect(nextId(two)).toBe("b");
    expect(nextId(advance(two, "b"))).toBeNull();
    expect(() => startWalk([], "a")).toThrow();
    expect(() => startWalk(["a"], "b")).toThrow();
    expect(() =>
      startWalk(
        Array(1001)
          .fill(0)
          .map((_, i) => `f-${i}`),
        "f-0",
      ),
    ).toThrow();
  });
  it.each([
    "{",
    "{}",
    "null",
    JSON.stringify({ ...startWalk(ids, ids[0]), cursor: 100 }),
    JSON.stringify({ ...startWalk(ids, ids[0]), unseen: [] }),
    JSON.stringify({ ...startWalk(ids, ids[0]), history: ["javascript:bad"] }),
  ])("safely resets corrupt session %#", (raw) =>
    expect(decodeWalk(raw)).toBeNull(),
  );
  it("serializes only ids/control metadata, never film details or images", () => {
    const s = startWalk(ids, ids[0], rng(6));
    expect(Object.keys(s).sort()).toEqual([
      "active",
      "cursor",
      "history",
      "poolVersion",
      "round",
      "seen",
      "unseen",
      "version",
    ]);
    expect(decodeWalk(JSON.stringify(s))).toEqual(s);
  });
});

it("removing several withdrawn ids preserves the exact surviving occurrence/cursor", () => {
  const s = {
    ...startWalk(["a", "b", "c", "d"], "a"),
    history: ["a", "b", "c", "b", "d"],
    cursor: 3,
    seen: ["a", "b", "c", "d"],
    unseen: [],
  };
  const r = removeUnavailable(s, "c", ["b", "d", "new"])!;
  expect(r.history).toEqual(["b", "b", "d"]);
  expect(r.cursor).toBe(1);
  expect(decodeWalk(JSON.stringify(r))).toEqual(r);
});
