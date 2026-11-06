import { createContext, useContext, useEffect, useState } from "react";
export type ListResult<T> = {
  data: T[];
  meta: { nextCursor: string | null; limit: number };
};
export type Seed = Record<string, unknown>;
export const SeedContext = createContext<Seed>({});
export function useResource<T>(path: string) {
  const seed = useContext(SeedContext);
  const [state, setState] = useState<{
    path: string;
    data: T | undefined;
    error: string | null;
  }>(() => ({ path, data: seed[path] as T | undefined, error: null }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(path, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
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
      : { path, data: seed[path] as T | undefined, error: null };
  return { ...current, retry: () => setRetry((n) => n + 1) };
}
