import { sourceContent } from "../../scripts/content";
import {
  buildContentPlan,
  fingerprint,
} from "../../scripts/content-corrections";
import { movieColumns, movieValues } from "../../worker/store";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Movie, Quote } from "../../src/shared/model";
let script = "";
let mf: Miniflare, db: Awaited<ReturnType<Miniflare["getD1Database"]>>;
const KEY = "local-test-only-not-a-production-key-8134390948";
let sequence = 0;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  opts: {
    auth?: boolean;
    key?: string;
    match?: string;
    headers?: Record<string, string>;
    raw?: string;
  } = {},
) {
  const headers: Record<string, string> = {
    "CF-Connecting-IP": `192.0.2.${++sequence}`,
    ...opts.headers,
  };
  if (opts.auth !== false) headers.Authorization = `Bearer ${KEY}`;
  if (body !== undefined || opts.raw !== undefined)
    headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD"].includes(method))
    headers["Idempotency-Key"] = opts.key ?? crypto.randomUUID();
  if (opts.match) headers["If-Match"] = opts.match;
  return mf.dispatchFetch(`https://movie.test${path}`, {
    method,
    headers,
    body: opts.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}
const input = (id = "test-film") => ({
  id,
  title: "测试电影",
  type: "movie",
  director: { name: "测试导演" },
  year: 1994,
  duration: 120,
  genre: ["剧情"],
  cover: { url: "https://example.org/poster.jpg", bg: "#fafaf7" },
  synopsis: "这是一条测试用电影资料。",
  publishedDate: "2020-01-01",
  status: "draft",
  quotes: [{ text: "留下一句台词。" }],
});
async function create(id = "test-film", extra: Record<string, unknown> = {}) {
  const response = await request("/api/v1/movies", "POST", {
    ...input(id),
    ...extra,
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return ((await response.json()) as { data: Movie }).data;
}
async function movie(id = "test-film") {
  return request(`/api/v1/movies/${id}`);
}
const tag = (m: Movie | Quote) => `"${m.id}:v${m.version}"`;
beforeAll(async () => {
  const result = await build({
    entryPoints: ["worker/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    external: ["node:*"],
    target: "es2023",
  });
  script = result.outputFiles[0].text;
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script,
      compatibilityDate: "2026-11-06",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      bindings: { CONTENT_API_KEY: KEY, WRITES_PAUSED: "0" },
      serviceBindings: {
        ASSETS: async () =>
          new Response(
            '<!doctype html><html><head><title>每日电影</title><!--seo--></head><body><div id="root"></div></body></html>',
            { headers: { "Content-Type": "text/html" } },
          ),
      },
    }),
  );
  db = await mf.getD1Database("DB");
  for (const statement of readFileSync("migrations/0001_content.sql", "utf8")
    .replace(/^--.*$/gm, "")
    .split(";")
    .filter((s) => s.trim()))
    await db.prepare(statement).run();
  await db.prepare("INSERT INTO movies (id,type,title,directorJson,genreJson,coverJson,postersJson,castJson,synopsis,editorialMarkdown,status,createdAt,updatedAt) VALUES ('migration-fixture','movie','旧记录','{}','[]','null','[]','[]','保留内容','原笔记','draft','created','updated')").run();
  await db.prepare("INSERT INTO quotes (id,movieId,text,sortOrder,createdAt,updatedAt) VALUES ('migration-quote','migration-fixture','原金句',0,'created','updated')").run();
  const migration = readFileSync("migrations/0002_listed_catalog.sql", "utf8")
    .replace(/^--.*$/gm, "")
    .split(";")
    .filter((s) => s.trim());
  await db.batch(migration.map((statement) => db.prepare(statement)));
  const preserved = await db.prepare("SELECT m.status,m.synopsis,q.text FROM movies m JOIN quotes q ON q.movieId=m.id WHERE m.id='migration-fixture'").first<{ status: string; synopsis: string; text: string }>();
  if (!preserved || preserved.status !== "draft" || preserved.synopsis !== "保留内容" || preserved.text !== "原金句")
    throw Error("listed-state migration did not preserve movie and quote rows");
  let invalidListedRejected = false;
  try {
    await db.prepare("UPDATE movies SET status='listed',publishedDate='2020-01-01' WHERE id='migration-fixture'").run();
  } catch {
    invalidListedRejected = true;
  }
  if (!invalidListedRejected) throw Error("listed-state CHECK accepted a recommendation date");
  await db.batch([db.prepare("DELETE FROM quotes WHERE id='migration-quote'"), db.prepare("DELETE FROM movies WHERE id='migration-fixture'")]);
});
beforeEach(async () => {
  await db.batch(
    ["quotes", "movies", "api_requests", "rate_limits", "write_assertions"].map(
      (table) => db.prepare(`DELETE FROM ${table}`),
    ),
  );
});
afterAll(async () => {
  await mf?.dispose();
});

describe("Content API with real local D1 (Miniflare)", () => {
  it("rejects missing/wrong keys and does not leak them", async () => {
    for (const opts of [
      { auth: false },
      { headers: { Authorization: "Bearer wrong" } },
    ]) {
      // explicit auth:false preserves custom Authorization below
      const r = await request("/api/v1/movies", "POST", input(), {
        ...opts,
        auth: false,
      });
      expect(r.status).toBe(401);
      expect(await r.text()).not.toContain(KEY);
    }
  });
  it("creates minimal draft; private content never leaks to public reads/cache", async () => {
    const r = await request("/api/v1/movies", "POST", {
      id: "draft",
      title: "草稿",
    });
    expect(r.status).toBe(201);
    const privateRead = await request("/api/v1/movies/draft");
    expect(privateRead.headers.get("cache-control")).toBe("no-store");
    expect(
      (await request("/api/v1/movies/draft", "GET", undefined, { auth: false }))
        .status,
    ).toBe(404);
    const publicList = await request("/api/v1/movies", "GET", undefined, {
      auth: false,
    });
    expect(((await publicList.json()) as { data: Movie[] }).data).toHaveLength(
      0,
    );
    expect(publicList.headers.get("vary")).toBe("Authorization");
  });
  it("publishes and permits version-protected date changes without changing id URL", async () => {
    const m = await create();
    let r = await request(
      "/api/v1/movies/test-film",
      "PATCH",
      { status: "published" },
      { match: tag(m) },
    );
    expect(r.status).toBe(200);
    const published = ((await r.json()) as { data: Movie }).data;
    expect(
      (
        await request("/api/v1/movies/test-film", "GET", undefined, {
          auth: false,
        })
      ).status,
    ).toBe(200);
    r = await request(
      "/api/v1/movies/test-film",
      "PATCH",
      { publishedDate: "2020-02-29" },
      { match: tag(published) },
    );
    expect(r.status).toBe(200);
  });
  it("hides future releases and quote reads until Shanghai date", async () => {
    const m = await create("future", {
      status: "published",
      publishedDate: "2099-02-01",
    });
    expect(
      (
        await request("/api/v1/movies/future", "GET", undefined, {
          auth: false,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`/api/v1/quotes/${m.quotes[0].id}`, "GET", undefined, {
          auth: false,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request("/api/v1/movies?status=published", "GET", undefined, {
          auth: false,
        })
      ).status,
    ).toBe(401);
  });
  it("lists listed movies publicly without adding them to daily recommendations", async () => {
    const listed = await create("listed-film", {
      status: "listed",
      publishedDate: null,
    });
    await create("listed-film-two", { status: "listed", publishedDate: null });
    const catalog = await request("/api/v1/movies?scope=catalog", "GET", undefined, { auth: false });
    const daily = await request("/api/v1/movies?scope=daily", "GET", undefined, { auth: false });
    expect(((await catalog.json()) as { data: Movie[] }).data.map((m) => m.id)).toContain("listed-film");
    expect(((await daily.json()) as { data: Movie[] }).data.map((m) => m.id)).not.toContain("listed-film");
    expect((await request("/api/v1/movies/listed-film", "GET", undefined, { auth: false })).status).toBe(200);
    const listedDetail = (await (await request("/api/v1/movies/listed-film-two", "GET", undefined, { auth: false })).json()) as { meta: { previous: unknown; next: { id: string } | null } };
    expect(listedDetail.meta.previous).toBeNull();
    expect(listedDetail.meta.next?.id).toBe("listed-film");
    const libraryDetailPage = await request("/movies/listed-film", "GET", undefined, { auth: false });
    expect(libraryDetailPage.status).toBe(200);
    expect(await libraryDetailPage.text()).toContain("片库收录");
    const homeSelection = await request("/?movie=listed-film", "GET", undefined, { auth: false });
    expect(homeSelection.status).toBe(200);
    expect(await homeSelection.text()).toContain("片库收录");
    const withdrawnSelection = await request("/?movie=draft", "GET", undefined, { auth: false });
    expect(withdrawnSelection.headers.get("cache-control")).toBe("no-store");
    expect(await withdrawnSelection.text()).not.toContain("草稿");
    const withdrawn = await request("/api/v1/movies/draft", "GET", undefined, { auth: false });
    expect(withdrawn.status).toBe(404);
    expect(withdrawn.headers.get("cache-control")).toBe("no-store");
    expect((await request(`/api/v1/quotes/${listed.quotes[0].id}`, "GET", undefined, { auth: false })).status).toBe(200);
    const first = await request("/api/v1/movies?scope=catalog&limit=1", "GET", undefined, { auth: false });
    const firstBody = (await first.json()) as { meta: { nextCursor: string | null } };
    expect(firstBody.meta.nextCursor).toBeTruthy();
    expect((await request(`/api/v1/movies?scope=daily&limit=1&cursor=${firstBody.meta.nextCursor}`, "GET", undefined, { auth: false })).status).toBe(400);
    expect((await request("/api/v1/movies?scope=unknown", "GET", undefined, { auth: false })).status).toBe(400);
    expect((await request("/api/v1/movies?scope=catalog")).status).toBe(400);
  });
  it("requires listed state to clear its recommendation date without side effects", async () => {
    const m = await create("listed-date-check");
    const rejected = await request("/api/v1/movies/listed-date-check", "PATCH", { status: "listed" }, { match: tag(m) });
    expect(rejected.status).toBe(422);
    expect(((await (await movie("listed-date-check")).json()) as { data: Movie }).data.version).toBe(m.version);
    const accepted = await request("/api/v1/movies/listed-date-check", "PATCH", { status: "listed", publishedDate: null }, { match: tag(m) });
    expect(accepted.status).toBe(200);
    const listed = ((await accepted.json()) as { data: Movie }).data;
    expect(listed.publishedDate).toBeNull();
    expect((await request("/api/v1/movies/listed-date-check", "PATCH", { status: "published" }, { match: tag(listed) })).status).toBe(422);
    const published = await request("/api/v1/movies/listed-date-check", "PATCH", { status: "published", publishedDate: "2020-01-01" }, { match: tag(listed) });
    expect(published.status).toBe(200);
  });
  it("replays creation exactly; rejects mismatched payload under same key", async () => {
    const body = input(),
      key = "repeat-create";
    const a = await request("/api/v1/movies", "POST", body, { key });
    const text = await a.text();
    const b = await request("/api/v1/movies", "POST", body, { key });
    expect(b.status).toBe(201);
    expect(await b.text()).toBe(text);
    expect(
      (
        await request(
          "/api/v1/movies",
          "POST",
          { ...body, title: "不同" },
          { key },
        )
      ).status,
    ).toBe(409);
    expect(
      (await db.prepare("SELECT count(*) n FROM movies").first<{ n: number }>())
        ?.n,
    ).toBe(1);
  });
  it("same-key concurrent requests commit one movie and the same receipt", async () => {
    const rs = await Promise.all(
      Array.from({ length: 6 }, () =>
        request("/api/v1/movies", "POST", input(), {
          key: "simultaneous-create",
        }),
      ),
    );
    expect(rs.map((r) => r.status)).toEqual(Array(6).fill(201));
    const bodies = await Promise.all(rs.map((r) => r.text()));
    expect(new Set(bodies).size).toBe(1);
    expect(
      (await db.prepare("SELECT count(*) n FROM movies").first<{ n: number }>())
        ?.n,
    ).toBe(1);
    expect(
      (
        await db
          .prepare("SELECT count(*) n FROM api_requests")
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });
  it("PATCH replay wins over stale If-Match; changed conditions conflict", async () => {
    const m = await create(),
      key = "patch-once";
    const a = await request(
      "/api/v1/movies/test-film",
      "PATCH",
      { title: "新标题" },
      { key, match: tag(m) },
    );
    expect(a.status).toBe(200);
    const text = await a.text();
    const b = await request(
      "/api/v1/movies/test-film",
      "PATCH",
      { title: "新标题" },
      { key, match: tag(m) },
    );
    expect(b.status).toBe(200);
    expect(await b.text()).toBe(text);
    expect(
      (
        await request(
          "/api/v1/movies/test-film",
          "PATCH",
          { title: "新标题" },
          { key, match: '"test-film:v2"' },
        )
      ).status,
    ).toBe(409);
  });
  it("enforces optimistic concurrency inside the D1 transaction", async () => {
    const m = await create();
    const rs = await Promise.all(
      ["甲", "乙"].map((title) =>
        request(
          "/api/v1/movies/test-film",
          "PATCH",
          { title },
          { match: tag(m) },
        ),
      ),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([200, 412]);
    expect(
      (await request("/api/v1/movies/test-film", "PATCH", { title: "丙" }))
        .status,
    ).toBe(428);
  });
  it("deduplicates NFC quote text within a movie but not across movies", async () => {
    await create();
    await create("other", { publishedDate: "2020-01-02" });
    const a = await request("/api/v1/movies/test-film/quotes", "POST", {
      text: "  Cafe\u0301  ",
    });
    expect(a.status).toBe(201);
    const q = ((await a.json()) as { data: Quote }).data;
    const b = await request("/api/v1/movies/test-film/quotes", "POST", {
      text: "Café",
    });
    expect(b.status).toBe(200);
    expect(((await b.json()) as { data: Quote }).data.id).toBe(q.id);
    const c = await request("/api/v1/movies/other/quotes", "POST", {
      text: "Café",
    });
    expect(c.status).toBe(201);
    expect(((await c.json()) as { data: Quote }).data.id).not.toBe(q.id);
  });
  it("concurrent different-key duplicate quotes return one stable resource", async () => {
    await create();
    const rs = await Promise.all(
      Array.from({ length: 4 }, () =>
        request("/api/v1/movies/test-film/quotes", "POST", {
          text: "并发添加",
        }),
      ),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
    const qs = await Promise.all(
      rs.map(async (r) => ((await r.json()) as { data: Quote }).data.id),
    );
    expect(new Set(qs).size).toBe(1);
  });
  it("quotes have their own ETag, update order, and parent movie version", async () => {
    const m = await create(),
      q = m.quotes[0];
    const read = await request(`/api/v1/quotes/${q.id}`);
    expect(read.headers.get("etag")).toBe(tag(q));
    const r = await request(
      `/api/v1/quotes/${q.id}`,
      "PATCH",
      { speaker: "角色", timestamp: "00:01:02", sortOrder: 9 },
      { match: tag(q) },
    );
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: Quote }).data.sortOrder).toBe(9);
    expect(
      ((await (await movie()).json()) as { data: Movie }).data.version,
    ).toBe(2);
    expect(
      (
        await request(
          `/api/v1/quotes/${q.id}`,
          "PATCH",
          { text: "过期更新" },
          { match: tag(q) },
        )
      ).status,
    ).toBe(412);
  });
  it("rolls back all fields/quotes/receipt on database uniqueness failure", async () => {
    await create("first");
    const r = await request("/api/v1/movies", "POST", input("second"), {
      key: "rollback",
    });
    expect(r.status).toBe(409);
    expect((await movie("second")).status).toBe(404);
    expect(
      (
        await db
          .prepare("SELECT count(*) n FROM quotes WHERE movieId='second'")
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    expect(
      (
        await db
          .prepare(
            "SELECT count(*) n FROM api_requests WHERE idempotencyKey='rollback'",
          )
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
  });
  it("rejects duplicate nested quotes rather than partially creating", async () => {
    expect(
      (
        await request("/api/v1/movies", "POST", {
          ...input(),
          quotes: [{ text: "a" }, { text: " a " }],
        })
      ).status,
    ).toBe(422);
    expect((await movie()).status).toBe(404);
  });
  it.each([
    { publishedDate: "2026-02-30" },
    { rating: 11 },
    { year: 1800 },
    { unknown: "x" },
    { cover: { url: "javascript:alert(1)" } },
    { cover: { url: "//evil.test/a" } },
    { cover: { url: "https://safe.test/x", bg: "url(https://evil.test)" } },
    { quotes: [{ text: "  " }] },
    { quotes: [{ text: "a", timestamp: "01:99:00" }] },
  ])("validates unsafe/unknown/invalid data %#", async (extra) => {
    expect(
      (await request("/api/v1/movies", "POST", { ...input(), ...extra }))
        .status,
    ).toBe(422);
  });
  it("enforces JSON/body limits, keys, same-origin writes, and method allow-list", async () => {
    expect(
      (await request("/api/v1/movies", "POST", undefined, { raw: "{" })).status,
    ).toBe(400);
    expect(
      (await request("/api/v1/movies", "POST", { title: "a".repeat(270000) }))
        .status,
    ).toBe(413);
    expect(
      (await request("/api/v1/movies", "POST", input(), { key: "" })).status,
    ).toBe(422);
    expect(
      (
        await request("/api/v1/movies", "POST", input(), {
          headers: { Origin: "https://evil.test" },
        })
      ).status,
    ).toBe(403);
    expect((await request("/api/v1/movies", "DELETE")).status).toBe(405);
  });
  it("rejects publishing incomplete drafts without changing version", async () => {
    const r = await request("/api/v1/movies", "POST", {
      id: "blank",
      title: "不完整",
    });
    const m = ((await r.json()) as { data: Movie }).data;
    expect(
      (
        await request(
          "/api/v1/movies/blank",
          "PATCH",
          { status: "published" },
          { match: tag(m) },
        )
      ).status,
    ).toBe(422);
    expect(
      ((await (await movie("blank")).json()) as { data: Movie }).data.version,
    ).toBe(1);
  });
  it("has opaque stable pagination and invalidates cursor on filter change", async () => {
    for (let i = 1; i <= 3; i++)
      await create(`movie-${i}`, {
        publishedDate: `2020-01-0${i}`,
        status: "published",
      });
    const first = await request("/api/v1/movies?limit=2", "GET", undefined, {
      auth: false,
    });
    const a = (await first.json()) as {
      data: Movie[];
      meta: { nextCursor: string };
    };
    expect(a.data.map((m) => m.id)).toEqual(["movie-3", "movie-2"]);
    const second = await request(
      `/api/v1/movies?limit=2&cursor=${a.meta.nextCursor}`,
      "GET",
      undefined,
      { auth: false },
    );
    const secondBody = (await second.json()) as { data: Movie[]; meta: { previousCursor: string | null } };
    expect(secondBody.data.map((m) => m.id)).toEqual(["movie-1"]);
    expect(secondBody.meta.previousCursor).toBeTruthy();
    const back = await request(`/api/v1/movies?limit=2&cursor=${secondBody.meta.previousCursor}`, "GET", undefined, { auth: false });
    expect(((await back.json()) as { data: Movie[] }).data.map((m) => m.id)).toEqual(["movie-3", "movie-2"]);
    expect(
      (
        await request(
          `/api/v1/movies?q=x&cursor=${a.meta.nextCursor}`,
          "GET",
          undefined,
          { auth: false },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/api/v1/movies?cursor=invalid", "GET", undefined, {
          auth: false,
        })
      ).status,
    ).toBe(400);
  });
  it("serves correct deep-link status/SEO, escaped text, no legacy compatibility shell", async () => {
    const title = "电影 $& <script>alert(1)</script>";
    await create("safe", { title, status: "published" });
    const r = await request("/movies/safe", "GET", undefined, { auth: false }),
      html = await r.text();
    expect(r.status).toBe(200);
    expect(html).toContain(
      "电影 $&amp; &lt;script&gt;alert(1)&lt;/script&gt; | 每日电影",
    );
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain('rel="canonical"');
    expect(html).toContain("留下一句台词。");
    expect(html).not.toContain(KEY);
    expect(
      (await request("/movies/absent", "GET", undefined, { auth: false }))
        .status,
    ).toBe(404);
    expect(
      (await request("/movie/2020-01-01/", "GET", undefined, { auth: false }))
        .status,
    ).toBe(404);
    expect(
      (await request("/rss.xml", "GET", undefined, { auth: false })).status,
    ).toBe(404);
  });
  it("rate limits authentication attempts in D1 and sends Retry-After", async () => {
    const headers = { "CF-Connecting-IP": "198.51.100.1" };
    for (let i = 0; i < 40; i++)
      expect(
        (
          await request("/api/v1/movies", "POST", input(), {
            auth: false,
            headers,
          })
        ).status,
      ).toBe(401);
    const r = await request("/api/v1/movies", "POST", input(), {
      auth: false,
      headers,
    });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("expires old idempotency receipts, exposes OpenAPI, returns genuine API 404", async () => {
    await create();
    await db.prepare("UPDATE api_requests SET createdAt=0").run();
    const r = await request(
      "/api/v1/movies/test-film",
      "PATCH",
      { title: "更新" },
      { match: '"test-film:v1"' },
    );
    expect(r.status).toBe(200);
    expect(
      (
        await db
          .prepare("SELECT count(*) n FROM api_requests WHERE createdAt=0")
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    const spec = await request("/api/openapi.json", "GET", undefined, {
      auth: false,
    });
    expect(((await spec.json()) as { openapi: string }).openapi).toBe("3.1.0");
    const absent = await request("/api/nope", "GET", undefined, {
      auth: false,
    });
    expect(absent.status).toBe(404);
    expect(absent.headers.get("content-type")).toContain("json");
  });
  it("partial updates preserve all omitted fields and cannot replace nested quotes", async () => {
    const m = await create();
    const r = await request(
      "/api/v1/movies/test-film",
      "PATCH",
      { title: "只改片名" },
      { match: tag(m) },
    );
    expect(r.status).toBe(200);
    const updated = ((await r.json()) as { data: Movie }).data;
    for (const field of [
      "director",
      "genre",
      "cover",
      "quotes",
      "publishedDate",
      "year",
      "duration",
      "status",
      "synopsis",
    ] as const)
      expect(updated[field]).toEqual(m[field]);
    expect(
      (
        await request(
          "/api/v1/movies/test-film",
          "PATCH",
          { quotes: [] },
          { match: tag(updated) },
        )
      ).status,
    ).toBe(422);
  });
  it("survives a Worker runtime restart on the same persisted D1", async () => {
    const persist = mkdtempSync(join(tmpdir(), "daily-movie-d1-"));
    const factory = () =>
      new Miniflare({
        ...convertV4MiniflareOptions({
          modules: true,
          script,
          compatibilityDate: "2026-11-06",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "persistent-test-db" },
          bindings: { CONTENT_API_KEY: KEY, WRITES_PAUSED: "0" },
        }),
        resourcePersistencePath: persist,
      });
    let instance = factory();
    try {
      const storage = await instance.getD1Database("DB");
      for (const statement of readFileSync(
        "migrations/0001_content.sql",
        "utf8",
      )
        .replace(/^--.*$/gm, "")
        .split(";")
        .filter((s) => s.trim()))
        await storage.prepare(statement).run();
      const r = await instance.dispatchFetch(
        "https://movie.test/api/v1/movies",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": "persistent-create",
          },
          body: JSON.stringify({ ...input("persistent"), status: "published" }),
        },
      );
      expect(r.status).toBe(201);
      await instance.dispose();
      instance = factory();
      const read = await instance.dispatchFetch(
        "https://movie.test/api/v1/movies/persistent",
      );
      expect(read.status).toBe(200);
      expect(((await read.json()) as { data: Movie }).data.quotes[0].text).toBe(
        "留下一句台词。",
      );
      const repeat = await instance.dispatchFetch(
        "https://movie.test/api/v1/movies",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": "persistent-create",
          },
          body: JSON.stringify({ ...input("persistent"), status: "published" }),
        },
      );
      expect(repeat.status).toBe(201);
    } finally {
      await instance.dispose();
      rmSync(persist, { recursive: true, force: true });
    }
  });
  it.each(["1", undefined, "unexpected"])(
    "fails closed when pause binding is %s",
    async (mode) => {
      const instance = new Miniflare(
        convertV4MiniflareOptions({
          modules: true,
          script,
          compatibilityDate: "2026-11-06",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          bindings: {
            CONTENT_API_KEY: KEY,
            ...(mode === undefined ? {} : { WRITES_PAUSED: mode }),
          },
        }),
      );
      try {
        const storage = await instance.getD1Database("DB");
        for (const statement of readFileSync(
          "migrations/0001_content.sql",
          "utf8",
        )
          .replace(/^--.*$/gm, "")
          .split(";")
          .filter((s) => s.trim()))
          await storage.prepare(statement).run();
        const r = await instance.dispatchFetch(
          "https://movie.test/api/v1/movies",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": "paused",
            },
            body: JSON.stringify(input()),
          },
        );
        expect(r.status).toBe(503);
        expect(r.headers.get("Retry-After")).toBe("300");
        expect(
          (
            await storage
              .prepare("SELECT count(*) n FROM movies")
              .first<{ n: number }>()
          )?.n,
        ).toBe(0);
      } finally {
        await instance.dispose();
      }
    },
  );
});

it("reviewed corrections and changed-field rollback preserve all37 original quotes in real D1", async () => {
  const originals = sourceContent().map((x) => x.movie);
  await db.batch(
    originals.flatMap((m) => [
      db
        .prepare(
          `INSERT INTO movies (${movieColumns.join(",")}) VALUES (${movieColumns.map(() => "?").join(",")})`,
        )
        .bind(...movieValues(m)),
      ...m.quotes.map((q) =>
        db
          .prepare(
            "INSERT INTO quotes(id,movieId,text,speaker,timestamp,sortOrder,createdAt,updatedAt,version) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            q.id,
            q.movieId,
            q.text,
            q.speaker,
            q.timestamp,
            q.sortOrder,
            q.createdAt,
            q.updatedAt,
            q.version,
          ),
      ),
    ]),
  );
  const plan = buildContentPlan(originals, "https://daily-movie.jiahongw.com");
  for (const e of plan.entries) {
    const response = await request(`/api/v1/movies/${e.id}`, "PATCH", e.patch, {
      key: e.idempotencyKey,
      match: e.expectedEtag,
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const updated = ((await response.json()) as { data: Movie }).data,
      before = originals.find((m) => m.id === e.id)!;
    expect(fingerprint(updated.quotes)).toBe(e.quotesHash);
    expect({
      ...updated,
      ...e.rollback,
      updatedAt: before.updatedAt,
      version: before.version,
    }).toEqual(before);
    const replay = await request(`/api/v1/movies/${e.id}`, "PATCH", e.patch, {
      key: e.idempotencyKey,
      match: e.expectedEtag,
    });
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { data: Movie }).data.version).toBe(2);
  }
  expect(
    (await db.prepare("SELECT COUNT(*) n FROM quotes").first<{ n: number }>())
      ?.n,
  ).toBe(37);
  const e = plan.entries.find((e) => e.id === "the-godfather")!;
  const rollback = await request(
    `/api/v1/movies/${e.id}`,
    "PATCH",
    e.rollback,
    { match: `"${e.id}:v2"` },
  );
  expect(rollback.status).toBe(200);
  const restored = ((await rollback.json()) as { data: Movie }).data;
  expect(restored.posters).toEqual(e.before.posters);
  expect(fingerprint(restored.quotes)).toBe(e.quotesHash);
});
