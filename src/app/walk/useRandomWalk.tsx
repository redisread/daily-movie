import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Movie } from "../../shared/model";
import {
  advance,
  decodeWalk,
  goBack,
  newRound,
  nextId,
  reconcile,
  removeUnavailable,
  startWalk,
  WALK_KEY,
  type WalkState,
} from "./state";
import { loadCatalogue, MovieReadError, readMovie } from "./catalogue";
type Memory = {
  snapshot: WalkState | null;
  loaded: boolean;
  available: boolean;
  pool: Movie[] | null;
  poolAt: number;
};
const MemoryContext = createContext<Memory | null>(null);
export function WalkMemoryProvider({ children }: { children: ReactNode }) {
  const memory = useRef<Memory>({
    snapshot: null,
    loaded: false,
    available: true,
    pool: null,
    poolAt: 0,
  });
  return (
    <MemoryContext.Provider value={memory.current}>
      {children}
    </MemoryContext.Provider>
  );
}
export function useRandomWalk({
  current,
  urlId,
  urlMode,
  onSelect,
}: {
  current: Movie;
  urlId: string | null;
  urlMode: boolean;
  onSelect: (movie: Movie, motion: boolean, walk: boolean) => void;
}) {
  const memory = useContext(MemoryContext);
  if (!memory) throw Error("Walk provider missing");
  const [snapshot, setSnapshot] = useState<WalkState | null>(null),
    [poolSize, setPoolSize] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [announcement, setAnnouncement] = useState("");
  const state = useRef<WalkState | null>(null),
    seq = useRef(0),
    controller = useRef<AbortController | null>(null);
  const latest = useRef({ current, onSelect });
  latest.current = { current, onSelect };
  const expected = useRef<{ id: string; walk: boolean } | null>(null);
  const retryAction = useRef<() => void>(() => {});
  function save(value: WalkState | null) {
    state.current = value;
    memory!.snapshot = value;
    setSnapshot(value);
    try {
      if (value) sessionStorage.setItem(WALK_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(WALK_KEY);
    } catch {
      memory!.available = false;
      setWarning("浏览器未能保存漫步记录，刷新会重置；当前仍可继续。");
    }
  }
  function loadSaved() {
    if (!memory!.loaded) {
      memory!.loaded = true;
      try {
        const raw = sessionStorage.getItem(WALK_KEY);
        memory!.snapshot = raw ? decodeWalk(raw) : null;
        if (raw && !memory!.snapshot)
          setWarning("漫步记录已重置，可以重新开始。");
      } catch {
        memory!.available = false;
        setWarning("浏览器未能保存漫步记录，刷新会重置；当前仍可继续。");
      }
    }
    if (!memory!.available)
      setWarning("浏览器未能保存漫步记录，刷新会重置；当前仍可继续。");
    state.current = memory!.snapshot;
    setSnapshot(memory!.snapshot);
  }
  function begin() {
    controller.current?.abort();
    controller.current = new AbortController();
    seq.current++;
    setError("");
    return { number: seq.current, signal: controller.current.signal };
  }
  function valid(number: number) {
    return number === seq.current && !controller.current?.signal.aborted;
  }
  async function pool(signal: AbortSignal) {
    if (memory!.pool && Date.now() - memory!.poolAt < 30000) {
      setPoolSize(memory!.pool.length);
      return memory!.pool;
    }
    setPreparing(true);
    const movies = await loadCatalogue(signal);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    memory!.pool = movies;
    memory!.poolAt = Date.now();
    setPoolSize(movies.length);
    setPreparing(false);
    return movies;
  }
  function select(movie: Movie, motion: boolean, walk: boolean) {
    expected.current = { id: movie.id, walk };
    latest.current.onSelect(movie, motion, walk);
  }
  function fail(e: unknown, number: number, candidate?: string) {
    if (!valid(number)) return;
    if (e instanceof MovieReadError && e.status === 404 && candidate) {
      memory!.pool = memory!.pool?.filter((m) => m.id !== candidate) ?? null;
      const ids = memory!.pool?.map((m) => m.id) ?? [];
      setPoolSize(ids.length);
      if (state.current) {
        const lostCurrent =
          state.current.history[state.current.cursor] === candidate;
        const trimmed = removeUnavailable(state.current, candidate, ids);
        save(trimmed && lostCurrent ? { ...trimmed, active: false } : trimmed);
        if (lostCurrent) {
          const fallback =
            memory!.pool?.find((m) => m.id === latest.current.current.id) ??
            memory!.pool?.[0];
          if (fallback) select(fallback, false, false);
        }
      }
      setError("这部暂时不可浏览，已从本次范围移除，可再遇见一部。");
    } else if (e instanceof DOMException && e.name === "TimeoutError")
      setError("读取超时，当前位置已保留，请重试");
    else if (e instanceof TypeError)
      setError("网络暂时不可用，当前位置已保留，请重试");
    else if (e instanceof SyntaxError)
      setError("片库返回了无法读取的资料，请重试");
    else setError(e instanceof Error ? e.message : "暂时无法读取，请重试");
  }
  async function restore(id: string | null, walk: boolean) {
    retryAction.current = () => void restore(id, walk);
    const op = begin();
    loadSaved();
    if (!walk) {
      if (state.current?.active) save({ ...state.current, active: false });
      if (!id || id === latest.current.current.id) return;
      setBusy(true);
      try {
        select(await readMovie(id, op.signal), false, false);
      } catch (e) {
        if (valid(op.number)) {
          setError(
            e instanceof MovieReadError && e.status === 404
              ? "未找到这部电影，已保留最近发布的选片。"
              : "读取选片失败，当前位置已保留，请重试",
          );
        }
      } finally {
        if (valid(op.number)) {
          setBusy(false);
          setPreparing(false);
        }
      }
      return;
    }
    setBusy(true);
    try {
      const movies = await pool(op.signal);
      if (!valid(op.number)) return;
      const target = id ?? latest.current.current.id;
      if (!movies.length) {
        setError("目前没有可浏览的电影");
        save(null);
        return;
      }
      const movie = await readMovie(target, op.signal);
      if (!valid(op.number)) return;
      const ids = movies.map((m) => m.id);
      const saved = state.current;
      const next = saved?.active
        ? reconcile(saved, ids, movie.id)
        : startWalk(ids, movie.id);
      save(next);
      select(movie, false, true);
      setAnnouncement(
        `已恢复《${movie.title}》，本轮已遇见 ${next.seen.length} 部`,
      );
    } catch (e) {
      fail(e, op.number, id ?? undefined);
    } finally {
      if (valid(op.number)) {
        setBusy(false);
        setPreparing(false);
      }
    }
  }
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  useEffect(() => {
    if (expected.current?.id === urlId && expected.current.walk === urlMode) {
      expected.current = null;
      return;
    }
    void restoreRef.current(urlId, urlMode);
  }, [urlId, urlMode]);
  useEffect(
    () => () => {
      controller.current?.abort();
      seq.current++;
    },
    [],
  );
  async function next(keyboard = false) {
    retryAction.current = () => void next(keyboard);
    const op = begin();
    setBusy(true);
    let candidate: string | undefined;
    try {
      const movies = await pool(op.signal);
      if (!valid(op.number)) return;
      const ids = movies.map((m) => m.id);
      if (ids.length < 2) {
        setError(ids.length ? "目前只有这一部" : "目前没有可浏览的电影");
        return;
      }
      if (!ids.includes(latest.current.current.id))
        throw Error("当前选片已不在公开片库，请先选择另一部");
      let value = state.current?.active
        ? reconcile(
            state.current,
            ids,
            state.current.history[state.current.cursor],
          )
        : startWalk(ids, latest.current.current.id);
      candidate = nextId(value) ?? undefined;
      if (!candidate) {
        value = newRound(value, ids);
        candidate = nextId(value) ?? undefined;
      }
      if (!candidate) return;
      const movie = await readMovie(candidate, op.signal);
      if (!valid(op.number)) return;
      const nextState = advance(value, candidate);
      save(nextState);
      select(movie, !keyboard, true);
      setAnnouncement(
        `已遇见《${movie.title}》，本轮已遇见 ${nextState.seen.length} 部`,
      );
    } catch (e) {
      fail(e, op.number, candidate);
    } finally {
      if (valid(op.number)) {
        setBusy(false);
        setPreparing(false);
      }
    }
  }
  async function back(keyboard = false) {
    retryAction.current = () => void back(keyboard);
    if (!state.current?.active || !state.current.cursor) return;
    const op = begin();
    setBusy(true);
    const value = goBack(state.current),
      id = value.history[value.cursor];
    try {
      const movie = await readMovie(id, op.signal);
      if (valid(op.number)) {
        save(value);
        select(movie, !keyboard, true);
        setAnnouncement(
          `回看《${movie.title}》，本轮已遇见 ${value.seen.length} 部`,
        );
      }
    } catch (e) {
      fail(e, op.number, id);
    } finally {
      if (valid(op.number)) setBusy(false);
    }
  }
  function stop(target: Movie = latest.current.current) {
    controller.current?.abort();
    seq.current++;
    setBusy(false);
    setPreparing(false);
    setError("");
    if (state.current) save({ ...state.current, active: false });
    expected.current = { id: target.id, walk: false };
  }
  function end() {
    stop();
    select(latest.current.current, false, false);
    setAnnouncement("已结束漫步，保留当前选片");
  }
  function restart() {
    const ids = memory!.pool?.map((m) => m.id) ?? [];
    if (!ids.length) return;
    stop();
    const value = startWalk(ids, latest.current.current.id);
    save(value);
    select(latest.current.current, false, true);
    setAnnouncement("已重新开始，本轮已遇见 1 部");
  }
  return {
    snapshot,
    poolSize,
    busy,
    preparing,
    error,
    warning,
    announcement,
    next,
    back,
    end,
    restart,
    stop,
    retry: () => retryAction.current(),
  };
}
