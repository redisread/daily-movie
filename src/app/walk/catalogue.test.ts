import { afterEach, describe, it, expect, vi } from "vitest";
import { sourceContent } from "../../../scripts/content";
import {
  loadCatalogue,
  MovieReadError,
  readMovie,
  reelWindow,
} from "./catalogue";
const sample = sourceContent()[0].movie;
const movie = (i: number) => ({
  ...sample,
  id: `film-${String(i).padStart(4, "0")}`,
  title: `电影${i}`,
  publishedDate: `${2000 + Math.floor(i / 28)}-01-${String((i % 28) + 1).padStart(2, "0")}`,
});
afterEach(() => vi.unstubAllGlobals());
describe("public catalogue and preview window", () => {
  it("fetches every page beyond100; all items eligible, preview remains12", async () => {
    const all = Array.from({ length: 137 }, (_, i) => movie(i));
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        seen.push(input);
        const cursor = new URL(input, "https://movie.test").searchParams.get(
          "cursor",
        );
        const offset = cursor ? Number(cursor) : 0;
        return Response.json({
          data: all.slice(offset, offset + 100),
          meta: {
            nextCursor: offset + 100 < all.length ? String(offset + 100) : null,
          },
        });
      }),
    );
    const rows = await loadCatalogue(new AbortController().signal);
    expect(rows).toHaveLength(137);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain("cursor=100");
    const window = reelWindow(all.slice(-12).reverse(), all[0]);
    expect(window).toHaveLength(12);
    expect(window.some((m) => m.id === all[0].id)).toBe(true);
    expect(window.map((m) => m.publishedDate)).toEqual(
      window.map((m) => m.publishedDate).sort(),
    );
  });
  it("does not use a partial first page when later pages fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ data: [movie(1)], meta: { nextCursor: "next" } }),
        )
        .mockResolvedValueOnce(new Response("", { status: 503 })),
    );
    await expect(loadCatalogue(new AbortController().signal)).rejects.toThrow(
      "完整片库",
    );
  });
  it("guards cyclic cursors/missing metadata and explicit1000 limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ data: [movie(1)], meta: { nextCursor: "loop" } }),
      ),
    );
    await expect(loadCatalogue(new AbortController().signal)).rejects.toThrow(
      "分页",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [movie(1)] })),
    );
    await expect(loadCatalogue(new AbortController().signal)).rejects.toThrow(
      "分页",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: Array.from({ length: 1000 }, (_, i) => movie(i)),
          meta: { nextCursor: "more" },
        }),
      ),
    );
    await expect(loadCatalogue(new AbortController().signal)).rejects.toThrow(
      "1000",
    );
  });
  it("distinguishes404 from recoverable server/network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(
      readMovie("gone", new AbortController().signal),
    ).rejects.toMatchObject({ status: 404 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    await expect(
      readMovie("film", new AbortController().signal),
    ).rejects.toBeInstanceOf(MovieReadError);
  });
});

it("rejects overlapping pages instead of silently admitting an incomplete pool", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ data: [movie(1)], meta: { nextCursor: "second" } }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: [movie(1)], meta: { nextCursor: null } }),
      ),
  );
  await expect(loadCatalogue(new AbortController().signal)).rejects.toThrow(
    "分页",
  );
});
