import { shanghaiDay, etag } from "../src/shared/format";
import { catalogVisible } from "../src/shared/visibility";
import { z } from "zod";
import {
  MovieInput,
  MoviePatch,
  QuoteInput,
  QuotePatch,
  publicationErrors,
  type Movie,
  type Quote,
} from "../src/shared/model";
import {
  getMovie,
  getQuote,
  neighbors,
  movieJson,
  quoteJson,
  insertMovie,
  insertQuote,
  assertVersion,
  movieColumns,
  movieValues,
} from "./store";
import {
  authenticate,
  bodyJSON,
  canonical,
  HttpError,
  json,
  rateLimit,
  sha256,
} from "./http";
import { openapi } from "./openapi";

type Receipt = {
  requestHash: string;
  responseStatus: number;
  responseBody: string;
  responseEtag: string | null;
};
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "字段校验失败",
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  return parsed.data;
}
function ensurePublicState(m: Movie) {
  if (m.status === "listed" && m.publishedDate !== null)
    throw new HttpError(422, "INVALID_PUBLICATION_STATE", "片库收录状态不能设置每日推荐日期", ["publishedDate"]);
  const fields = publicationErrors(m);
  if (fields.length)
    throw new HttpError(
      422,
      m.status === "listed" ? "LISTING_INCOMPLETE" : "PUBLISH_INCOMPLETE",
      m.status === "listed" ? "公开收录前请补齐资料与至少一条金句" : "每日推荐前请补齐资料、推荐日期与至少一条金句",
      fields,
    );
}
function requireMatch(req: Request, resource: Movie | Quote) {
  const match = req.headers.get("if-match");
  if (!match)
    throw new HttpError(
      428,
      "PRECONDITION_REQUIRED",
      "更新须提供 GET 返回的 ETag，放入 If-Match",
    );
  if (match !== etag(resource))
    throw new HttpError(
      412,
      "VERSION_CONFLICT",
      "内容已更新，请重新读取后再编辑",
    );
}
function receiptResponse(r: Receipt) {
  return new Response(r.responseBody, {
    status: r.responseStatus,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(r.responseEtag ? { ETag: r.responseEtag } : {}),
    },
  });
}
async function getReceipt(
  db: D1Database,
  key: string,
  method: string,
  path: string,
  hash: string,
) {
  const r = await db
    .prepare(
      "SELECT requestHash,responseStatus,responseBody,responseEtag FROM api_requests WHERE idempotencyKey=? AND method=? AND path=? AND createdAt>=?",
    )
    .bind(key, method, path, Date.now() - 7 * 86400000)
    .first<Receipt>();
  if (r && r.requestHash !== hash)
    throw new HttpError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "相同幂等键不能用于不同请求",
    );
  return r;
}
function quoteFrom(
  input: z.output<typeof QuoteInput>,
  movieId: string,
  index: number,
  now: string,
): Quote {
  return {
    ...input,
    id: crypto.randomUUID(),
    movieId,
    sortOrder: input.sortOrder ?? index,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
export async function listMovies(req: Request, db: D1Database, auth: boolean) {
  const url = new URL(req.url),
    p = url.searchParams;
  const limit = parse(
    z.coerce.number().int().min(1).max(100),
    p.get("limit") ?? 20,
  );
  const q = parse(z.string().max(200), p.get("q") ?? "");
  if (auth && p.has("scope"))
    throw new HttpError(400, "INVALID_SCOPE", "鉴权列表不能使用公开范围参数");
  const requestedScope = p.get("scope") ?? "daily";
  if (!auth && requestedScope !== "catalog" && requestedScope !== "daily")
    throw new HttpError(400, "INVALID_SCOPE", "公开列表范围须为 catalog 或 daily");
  const scope = auth ? null : requestedScope;
  const type = p.get("type"),
    status = p.get("status");
  const where: string[] = [],
    args: (string | number)[] = [];
  if (!auth) {
    if (scope === "catalog") {
      where.push("(m.status='listed' OR (m.status='published' AND m.publishedDate<=?))");
      args.push(shanghaiDay());
    } else {
      where.push("m.status='published' AND m.publishedDate<=?");
      args.push(shanghaiDay());
    }
  }
  if (type) {
    parse(z.enum(["movie", "tv"]), type);
    where.push("m.type=?");
    args.push(type);
  }
  if (status) {
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "筛选发布状态需要鉴权");
    parse(z.enum(["draft", "listed", "published"]), status);
    where.push("m.status=?");
    args.push(status);
  }
  if (q) {
    where.push(
      "(m.title LIKE ? ESCAPE '\\' OR COALESCE(m.titleOriginal,'') LIKE ? ESCAPE '\\')",
    );
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    args.push(pattern, pattern);
  }
  const cursorScope = await sha256(canonical({ q, type, status, auth, scope }));
  const legacyDailyScope = scope === "daily"
    ? await sha256(canonical({ q, type, status, auth }))
    : null;
  let direction: "after" | "before" = "after";
  let hasCursor = false;
  if (p.has("cursor")) {
    let value: unknown;
    try {
      const token = p.get("cursor")!;
      if (token.length > 2048) throw Error();
      value = JSON.parse(atob(token.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      throw new HttpError(400, "INVALID_CURSOR", "分页游标无效");
    }
    const c = parse(
      z
        .object({ date: z.string(), id: z.string(), scope: z.string(), direction: z.enum(["after", "before"]).optional() })
        .strict(),
      value,
    );
    if (c.scope !== cursorScope && c.scope !== legacyDailyScope)
      throw new HttpError(
        400,
        "INVALID_CURSOR",
        "筛选条件改变后请从第一页开始",
      );
    direction = c.direction ?? "after";
    hasCursor = true;
    const operator = direction === "before" ? ">" : "<";
    where.push(`(COALESCE(m.publishedDate,'') ${operator} ? OR (COALESCE(m.publishedDate,'')=? AND m.id${operator}?))`);
    args.push(c.date, c.date, c.id);
  }
  const order = direction === "before" ? "ASC" : "DESC";
  const r = await db
    .prepare(
      `SELECT ${movieJson()} AS value FROM movies m ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY COALESCE(m.publishedDate,'') ${order},m.id ${order} LIMIT ?`,
    )
    .bind(...args, limit + 1)
    .all<{ value: string }>();
  const hasMore = r.results.length > limit;
  let movies = r.results
    .slice(0, limit)
    .map((row) => JSON.parse(row.value) as Movie);
  if (direction === "before") movies = movies.reverse();
  const last = movies.at(-1);
  const first = movies[0];
  const encodeCursor = (movie: Movie, cursorDirection: "after" | "before") =>
    btoa(JSON.stringify({ date: movie.publishedDate ?? "", id: movie.id, scope: cursorScope, direction: cursorDirection }))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const nextCursor = direction === "before"
    ? last ? encodeCursor(last, "after") : null
    : hasMore && last ? encodeCursor(last, "after") : null;
  const previousCursor = direction === "after"
    ? hasCursor && first ? encodeCursor(first, "before") : null
    : hasMore && first ? encodeCursor(first, "before") : null;
  return json(
    { data: movies, meta: { nextCursor, previousCursor, limit } },
    200,
    auth
      ? {}
      : { "Cache-Control": "public, max-age=30", Vary: "Authorization" },
  );
}
export async function api(
  req: Request,
  env: Env,
  appendAttempt = 0,
): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path === "/api/openapi.json") {
    if (req.method !== "GET")
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 GET", undefined, {
        Allow: "GET",
      });
    return json(openapi);
  }
  if (path === "/api/health") {
    if (req.method !== "GET")
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "仅支持 GET", undefined, {
        Allow: "GET",
      });
    await env.DB.prepare("SELECT 1").first();
    return json({
      data: { status: "ok", timestamp: new Date().toISOString() },
    });
  }
  const collection = path === "/api/v1/movies";
  const movieMatch = /^\/api\/v1\/movies\/([a-z0-9-]+)$/.exec(path);
  const quoteCollection = /^\/api\/v1\/movies\/([a-z0-9-]+)\/quotes$/.exec(
    path,
  );
  const quoteMatch = /^\/api\/v1\/quotes\/([a-zA-Z0-9-]+)$/.exec(path);
  if (!collection && !movieMatch && !quoteCollection && !quoteMatch)
    throw new HttpError(404, "NOT_FOUND", "接口不存在");
  await rateLimit(req, env.DB);
  const auth = await authenticate(req, env);
  if (req.method === "GET" && (collection || movieMatch || quoteMatch)) {
    if (collection) return listMovies(req, env.DB, auth);
    if (movieMatch) {
      const movie = await getMovie(env.DB, movieMatch[1]);
      if (!movie || (!auth && !catalogVisible(movie)))
        throw new HttpError(404, "NOT_FOUND", "电影不存在");
      return json(
        { data: movie, meta: await neighbors(env.DB, movie, auth) },
        200,
        {
          ETag: etag(movie),
          ...(auth
            ? {}
            : { "Cache-Control": "public, max-age=30", Vary: "Authorization" }),
        },
      );
    }
    const quote = await getQuote(env.DB, quoteMatch![1]);
    const movie = quote ? await getMovie(env.DB, quote.movieId) : null;
    if (!quote || !movie || (!auth && !catalogVisible(movie)))
      throw new HttpError(404, "NOT_FOUND", "金句不存在");
    return json({ data: quote }, 200, { ETag: etag(quote) });
  }
  const allowed = collection
    ? "GET, POST"
    : movieMatch || quoteMatch
      ? "GET, PATCH"
      : "POST";
  if (
    !((collection || quoteCollection) && req.method === "POST") &&
    !((movieMatch || quoteMatch) && req.method === "PATCH")
  )
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "不支持此方法", undefined, {
      Allow: allowed,
    });
  if (!auth) throw new HttpError(401, "UNAUTHORIZED", "鉴权失败");
  if (String(env.WRITES_PAUSED) !== "0")
    throw new HttpError(503, "WRITES_PAUSED", "内容写入暂时暂停", undefined, {
      "Retry-After": "300",
    });
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "ORIGIN_DENIED", "不允许跨站写入");
  const key = req.headers.get("Idempotency-Key");
  if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
    throw new HttpError(
      422,
      "IDEMPOTENCY_KEY_REQUIRED",
      "请提供 1–128 字符的 Idempotency-Key",
    );
  const raw = await bodyJSON(req);
  const hash = await sha256(
    canonical({ body: raw, ifMatch: req.headers.get("If-Match") }),
  );
  const prior = await getReceipt(env.DB, key, req.method, path, hash);
  if (prior) return receiptResponse(prior);
  const now = new Date().toISOString();
  let status = 201,
    targetId = "",
    target: "movies" | "quotes" = "movies";
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM api_requests WHERE createdAt<?").bind(
      Date.now() - 7 * 86400000,
    ),
    env.DB.prepare(
      "INSERT INTO api_requests(idempotencyKey,method,path,requestHash,responseStatus,responseBody,createdAt) VALUES (?,?,?,?,0,'',?)",
    ).bind(key, req.method, path, hash, Date.now()),
  ];
  if (collection) {
    const input = parse(MovieInput, raw);
    const movie: Movie = {
      ...input,
      quotes: input.quotes.map((q, i) => quoteFrom(q, input.id, i, now)),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    ensurePublicState(movie);
    if (new Set(movie.quotes.map((q) => q.text)).size !== movie.quotes.length)
      throw new HttpError(422, "DUPLICATE_QUOTES", "嵌套金句不能重复");
    statements.push(
      insertMovie(env.DB, movie),
      ...movie.quotes.map((q) => insertQuote(env.DB, q)),
    );
    targetId = movie.id;
  } else if (movieMatch) {
    const patch = parse(MoviePatch, raw),
      movie = await getMovie(env.DB, movieMatch[1]);
    if (!movie) throw new HttpError(404, "NOT_FOUND", "电影不存在");
    requireMatch(req, movie);
    const updated: Movie = {
      ...movie,
      ...patch,
      version: movie.version + 1,
      updatedAt: now,
    };
    ensurePublicState(updated);
    statements.push(
      assertVersion(env.DB, "movies", movie.id, movie.version),
      env.DB.prepare(
        `UPDATE movies SET ${movieColumns
          .slice(1)
          .map((k) => `${k}=?`)
          .join(",")} WHERE id=?`,
      ).bind(...movieValues(updated).slice(1), movie.id),
    );
    status = 200;
    targetId = movie.id;
  } else if (quoteCollection) {
    const input = parse(QuoteInput, raw),
      movie = await getMovie(env.DB, quoteCollection[1]);
    if (!movie) throw new HttpError(404, "NOT_FOUND", "电影不存在");
    // Duplicate by (movieId, NFC text) is handled in SQL, including concurrent callers.
    const quote = quoteFrom(
      input,
      movie.id,
      Math.max(-1, ...movie.quotes.map((q) => q.sortOrder)) + 1,
      now,
    );
    const existing = movie.quotes.find((q) => q.text === quote.text);
    target = "quotes";
    targetId = existing?.id ?? quote.id;
    status = existing ? 200 : 201;
    // A parent CAS ensures append order and prevents overwriting a concurrently edited movie.
    statements.push(assertVersion(env.DB, "movies", movie.id, movie.version));
    if (!existing)
      statements.push(
        insertQuote(env.DB, quote),
        env.DB.prepare(
          "UPDATE movies SET version=version+1,updatedAt=? WHERE id=?",
        ).bind(now, movie.id),
      );
  } else if (quoteMatch) {
    const patch = parse(QuotePatch, raw),
      quote = await getQuote(env.DB, quoteMatch[1]);
    if (!quote) throw new HttpError(404, "NOT_FOUND", "金句不存在");
    requireMatch(req, quote);
    const movie = await getMovie(env.DB, quote.movieId);
    if (!movie) throw new HttpError(404, "NOT_FOUND", "电影不存在");
    const updated = { ...quote, ...patch };
    statements.push(
      assertVersion(env.DB, "quotes", quote.id, quote.version),
      assertVersion(env.DB, "movies", movie.id, movie.version),
      env.DB.prepare(
        "UPDATE quotes SET text=?,speaker=?,timestamp=?,sortOrder=?,version=version+1,updatedAt=? WHERE id=?",
      ).bind(
        updated.text,
        updated.speaker ?? null,
        updated.timestamp ?? null,
        updated.sortOrder,
        now,
        quote.id,
      ),
      env.DB.prepare(
        "UPDATE movies SET version=version+1,updatedAt=? WHERE id=?",
      ).bind(now, movie.id),
    );
    target = "quotes";
    targetId = quote.id;
    status = 200;
  }
  const alias = target === "movies" ? "m" : "q",
    value = target === "movies" ? movieJson() : quoteJson();
  statements.push(
    env.DB.prepare(
      `UPDATE api_requests SET responseStatus=?,responseBody=(SELECT json_object('data',json(${value})) FROM ${target} ${alias} WHERE ${alias}.id=?),responseEtag=(SELECT '"'||id||':v'||version||'"' FROM ${target} WHERE id=?) WHERE idempotencyKey=? AND method=? AND path=?`,
    ).bind(status, targetId, targetId, key, req.method, path),
    env.DB.prepare("DELETE FROM write_assertions"),
    env.DB.prepare(
      "SELECT requestHash,responseStatus,responseBody,responseEtag FROM api_requests WHERE idempotencyKey=? AND method=? AND path=?",
    ).bind(key, req.method, path),
  );
  try {
    const results = await env.DB.batch(statements);
    return receiptResponse(results.at(-1)!.results[0] as Receipt);
  } catch (err) {
    // Unique-key loser observes the committed winner, never reruns the mutation.
    const replay = await getReceipt(env.DB, key, req.method, path, hash);
    if (replay) return receiptResponse(replay);
    const message = err instanceof Error ? err.message : "";
    if (
      quoteCollection &&
      appendAttempt < 2 &&
      (message.includes("write_assertions") ||
        message.includes("UNIQUE constraint"))
    ) {
      return api(
        new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(raw),
        }),
        env,
        appendAttempt + 1,
      );
    }
    if (message.includes("write_assertions")) {
      if (req.method === "PATCH")
        throw new HttpError(412, "VERSION_CONFLICT", "内容已更新，请重新读取");
      // Concurrent append can safely be retried with the SAME key. Never invent a new key.
      throw new HttpError(
        409,
        "WRITE_CONFLICT",
        "电影刚被更新，请使用原幂等键重试",
      );
    }
    if (message.includes("UNIQUE constraint"))
      throw new HttpError(
        409,
        "RESOURCE_CONFLICT",
        "标识、日期或同片金句已经存在",
      );
    throw err;
  }
}
