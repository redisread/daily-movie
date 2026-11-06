import { timingSafeEqual } from "node:crypto";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: unknown,
    public headers?: HeadersInit,
  ) {
    super(message);
  }
}
export function json(
  value: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function authenticate(req: Request, env: Env): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const match = /^Bearer ([^\s]+)$/.exec(auth);
  const candidate = match?.[1] ?? "";
  // Hash to equal lengths; fixed-time comparison provided by Workers Web Crypto.
  const [a, b] = await Promise.all(
    [candidate, env.CONTENT_API_KEY ?? ""].map((s) =>
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  );
  const valid = timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
  if (!match || !env.CONTENT_API_KEY || !valid)
    throw new HttpError(401, "UNAUTHORIZED", "鉴权失败");
  return true;
}
export async function bodyJSON(req: Request): Promise<unknown> {
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "请使用 application/json",
    );
  const max = 256 * 1024;
  if (Number(req.headers.get("content-length")) > max)
    throw new HttpError(413, "BODY_TOO_LARGE", "请求体不得超过 256 KiB");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_JSON", "请求体不是有效 JSON");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "BODY_TOO_LARGE", "请求体不得超过 256 KiB");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "请求体不是有效 JSON");
  }
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function rateLimit(req: Request, db: D1Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000),
    minute = Math.floor(now / 60);
  const ip = await sha256(req.headers.get("CF-Connecting-IP") ?? "local");
  const write = !["GET", "HEAD"].includes(req.method),
    limit = write ? 40 : 600;
  const bucket = `${ip}:${write ? "w" : "r"}:${minute}`;
  const result = await db.batch([
    db.prepare("DELETE FROM rate_limits WHERE expiresAt<?").bind(now),
    db
      .prepare(
        "INSERT INTO rate_limits(bucket,hits,expiresAt) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits",
      )
      .bind(bucket, (minute + 2) * 60),
  ]);
  const hits = (result[1].results[0] as { hits: number }).hits;
  if (hits > limit)
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "请求过于频繁，请稍后再试",
      undefined,
      { "Retry-After": String(60 - (now % 60)) },
    );
}
