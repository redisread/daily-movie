import type { Movie } from "../../shared/model";
import { MAX_POOL } from "./state";
export class MovieReadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readMovie(
  id: string,
  signal: AbortSignal,
): Promise<Movie> {
  const response = await fetch(`/api/v1/movies/${encodeURIComponent(id)}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new MovieReadError(
      response.status,
      response.status === 404
        ? "这部暂时不可浏览"
        : "读取失败，当前位置已保留，请重试",
    );
  const body = (await response.json()) as { data?: Movie };
  if (!body.data || body.data.id !== id || !["listed", "published"].includes(body.data.status))
    throw new MovieReadError(503, "影片资料暂不可用");
  return body.data;
}
export async function loadCatalogue(signal: AbortSignal): Promise<Movie[]> {
  const rows = new Map<string, Movie>(),
    cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ scope: "catalog", limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/v1/movies?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw Error("完整片库暂时无法读取，请重试");
    const body = (await response.json()) as {
      data?: Movie[];
      meta?: { nextCursor?: unknown };
    };
    if (
      !Array.isArray(body.data) ||
      !body.meta ||
      !(
        body.meta.nextCursor === null ||
        typeof body.meta.nextCursor === "string"
      )
    )
      throw Error("片库分页信息不完整，请重试");
    for (const movie of body.data) {
      if (
        !movie ||
        typeof movie.id !== "string" ||
        !["listed", "published"].includes(movie.status)
      )
        throw Error("片库内容暂不可用，请重试");
      if (rows.has(movie.id)) throw Error("片库分页发生变化，请重试");
      rows.set(movie.id, movie);
    }
    cursor = body.meta.nextCursor as string | null;
    if (rows.size > MAX_POOL || (rows.size === MAX_POOL && cursor))
      throw Error("片库已超过1000部，随机漫步暂不可用，请使用片库浏览");
    if (cursor) {
      if (cursors.has(cursor) || !body.data.length)
        throw Error("片库分页发生变化，请重试");
      cursors.add(cursor);
    }
  } while (cursor);
  return [...rows.values()];
}
export function reelWindow(recent: Movie[], selected: Movie): Movie[] {
  const unique = [...new Map(recent.map((m) => [m.id, m])).values()]
    .sort(
      (a, b) =>
        (b.publishedDate ?? "").localeCompare(a.publishedDate ?? "") ||
        b.id.localeCompare(a.id),
    )
    .slice(0, 12);
  const at = unique.findIndex((m) => m.id === selected.id);
  if (at >= 0) unique[at] = selected;
  else {
    if (unique.length === 12) unique.pop();
    unique.push(selected);
  }
  return unique.sort(
    (a, b) =>
      (a.publishedDate ?? "").localeCompare(b.publishedDate ?? "") ||
      a.id.localeCompare(b.id),
  );
}
