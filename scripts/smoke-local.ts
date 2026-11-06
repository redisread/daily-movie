import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const origin = "http://127.0.0.1:4321";
const key = readFileSync(".dev.vars", "utf8").match(
  /^CONTENT_API_KEY=(.+)$/m,
)?.[1];
if (!key) throw Error("Local .dev.vars CONTENT_API_KEY missing");
const id = `smoke-${crypto.randomUUID()}`;
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  match?: string,
  publicRead = false,
) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      ...(!publicRead ? { Authorization: `Bearer ${key}` } : {}),
      ...(method !== "GET"
        ? {
            "Content-Type": "application/json",
            "Idempotency-Key": `${id}-${method}-${path}`,
          }
        : {}),
      ...(match ? { "If-Match": match } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = (await r.json()) as { data: Record<string, unknown> };
  assert(r.ok, `Local smoke failed ${path}: HTTP ${r.status}`);
  return { r, data: value.data };
}
try {
  await call("/api/v1/movies", "POST", {
    id,
    title: "本地端到端测试电影",
    director: { name: "测试导演" },
    year: 2026,
    duration: 99,
    genre: ["测试"],
    cover: { url: "/fallback-poster.svg" },
    synopsis: "只用于验证本地 API → D1 → 公开页面，不发布到生产。",
    publishedDate: "2001-11-06",
  });
  await call(`/api/v1/movies/${id}/quotes`, "POST", {
    text: "这是一句只用于本地联调的台词。",
  });
  const before = await call(`/api/v1/movies/${id}`);
  await call(
    `/api/v1/movies/${id}`,
    "PATCH",
    { status: "published" },
    before.r.headers.get("etag")!,
  );
  const published = await call(
    `/api/v1/movies/${id}`,
    "GET",
    undefined,
    undefined,
    true,
  );
  assert.equal(published.data.status, "published");
  const html = await (await fetch(`${origin}/movies/${id}`)).text();
  assert(html.includes("这是一句只用于本地联调的台词。"));
  const disk = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--config",
      "wrangler.local.jsonc",
      "--local",
      "--command",
      `SELECT title FROM movies WHERE id='${id}'`,
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.equal(JSON.parse(disk)[0].results[0].title, "本地端到端测试电影");
  const report = {
    apiCreate: true,
    appendQuote: true,
    publish: true,
    publicRead: true,
    serverHtml: true,
    persistedD1: true,
    environment: "local only",
    checkedAt: new Date().toISOString(),
  };
  writeFileSync("artifacts/local-smoke.json", JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + "\n");
} finally {
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--config",
      "wrangler.local.jsonc",
      "--local",
      "--command",
      `DELETE FROM quotes WHERE movieId='${id}'; DELETE FROM movies WHERE id='${id}'; DELETE FROM api_requests WHERE idempotencyKey LIKE '${id}-%';`,
      "--json",
    ],
    { stdio: "pipe" },
  );
}
