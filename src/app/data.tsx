import { createContext, useContext, useEffect, useState } from "react";
export type ListResult<T> = {
  data: T[];
  meta: { nextCursor: string | null; previousCursor?: string | null; limit: number };
};
export type Seed = Record<string, unknown>;
export const SeedContext = createContext<Seed>({});
export function useResource<T>(path: string | null) {
  const seed = useContext(SeedContext);
  const [state, setState] = useState<{
    path: string | null;
    data: T | undefined;
    error: string | null;
  }>(() => ({ path, data: path ? seed[path] as T | undefined : undefined, error: null }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) {
      setState({ path, data: undefined, error: null });
      return;
    }
    const controller = new AbortController();
    fetch(path, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok)
          throw Error(
            r.status === 404
              ? "未找到这部电影"
              : "暂时无法读取内容，请稍后重试",
          );
        setState({ path, data: body as T, error: null });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setState({
            path,
            data: undefined,
            error: e instanceof Error ? e.message : "暂时无法读取内容",
          });
      });
    return () => controller.abort();
  }, [path, retry]);
  const current =
    state.path === path
      ? state
      : { path, data: path ? seed[path] as T | undefined : undefined, error: null };
  return { ...current, retry: () => setRetry((n) => n + 1) };
}
