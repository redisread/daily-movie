import { api } from "./api";
import { ensureDailyRecommendation } from "./recommendations";
import { page } from "./pages";
import { HttpError, json } from "./http";
const security = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self'; media-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await ensureDailyRecommendation(env.DB);
  },
  async fetch(req: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const url = new URL(req.url);
      if (
        url.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(url.hostname)
      )
        throw new HttpError(400, "HTTPS_REQUIRED", "请使用 HTTPS");
      if (url.pathname.startsWith("/api/")) response = await api(req, env);
      else if (!["GET", "HEAD"].includes(req.method))
        throw new HttpError(
          405,
          "METHOD_NOT_ALLOWED",
          "不支持此方法",
          undefined,
          { Allow: "GET, HEAD" },
        );
      else if (
        url.pathname.startsWith("/assets/") ||
        /^\/covers\/original\/[a-zA-Z0-9_-]+\.png$/.test(url.pathname) ||
        /^\/(?:favicon\.(?:png|svg)|logo\.png|fallback-poster\.svg|robots\.txt|sw\.js|manifest\.webmanifest)$/.test(
          url.pathname,
        )
      ) {
        response = await env.ASSETS.fetch(req);
        if (url.pathname === "/sw.js") {
          response = new Response(response.body, response);
          response.headers.set("Cache-Control", "no-store");
        }
      } else
        response = await page(
          req.method === "HEAD"
            ? new Request(req.url, { headers: req.headers })
            : req,
          env,
        );
    } catch (e) {
      if (e instanceof HttpError)
        response = json(
          {
            error: {
              code: e.code,
              message: e.message,
              ...(e.fields ? { fields: e.fields } : {}),
            },
            requestId,
          },
          e.status,
          e.headers,
        );
      else {
        // Never log request bodies, credentials, raw SQL exceptions, or database content.
        console.error(JSON.stringify({ event: "request_failed", requestId }));
        response = json(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "服务暂不可用，请稍后重试",
            },
            requestId,
          },
          503,
          { "Retry-After": "30" },
        );
      }
    }
    const out = new Response(
      req.method === "HEAD" ? null : response.body,
      response,
    );
    Object.entries(security).forEach(([k, v]) => out.headers.set(k, v));
    out.headers.set("X-Request-Id", requestId);
    return out;
  },
} satisfies ExportedHandler<Env>;
