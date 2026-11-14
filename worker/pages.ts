import { renderToString } from "react-dom/server.browser";
import { StaticRouter } from "react-router-dom";
import { createElement } from "react";
import { App } from "../src/app/App";
import type { Seed } from "../src/app/data";
import type { Movie } from "../src/shared/model";
import { catalogVisible } from "../src/shared/visibility";
import { getMovie, neighbors } from "./store";
import { listMovies } from "./api";
import { HttpError } from "./http";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const serialize = (o: unknown) =>
  JSON.stringify(o)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export async function page(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url),
    path = url.pathname;
  let title = "每日电影 | 选一部，把时间交给电影",
    description = "电影与剧集的选片档案，一部电影，一句留在心里的话。",
    image: string | undefined,
    status = 200;
  const seed: Seed = {};
  const detail = /^\/movies\/([a-z0-9-]+)$/.exec(path);
  if (detail) {
    const m = await getMovie(env.DB, detail[1]);
    if (!m || !catalogVisible(m))
      status = 404;
    else {
      title = `${m.title} | 每日电影`;
      description = m.synopsis.slice(0, 160);
      image = m.cover?.url;
      seed[`/api/v1/movies/${detail[1]}`] = {
        data: m,
        meta: await neighbors(env.DB, m),
      };
    }
  } else if (path === "/" || path === "/library") {
    const params = new URLSearchParams();
    params.set("scope", path === "/" ? "daily" : "catalog");
    params.set("limit", path === "/" ? "12" : "20");
    if (path === "/library")
      for (const name of ["q", "type", "cursor"])
        if (url.searchParams.has(name))
          params.set(name, url.searchParams.get(name)!);
    const key = `/api/v1/movies?${params}`;
    const response = await listMovies(
      new Request(new URL(key, url.origin)),
      env.DB,
      false,
    );
    seed[key] = await response.json();
    if (path === "/library") title = "片库 | 每日电影";
    if (path === "/") {
      const movies = (seed[key] as { data: Movie[] }).data;
      const requestedId = url.searchParams.get("movie");
      let selected = movies.find((m) => m.id === requestedId) ?? null;
      if (requestedId && !selected) {
        const requested = await getMovie(env.DB, requestedId);
        if (!requested || !catalogVisible(requested)) selected = null;
        else {
          selected = requested;
          seed[`/api/v1/movies/${requestedId}`] = {
            data: requested,
            meta: await neighbors(env.DB, requested),
          };
        }
      }
      selected ??= movies[0] ?? null;
      if (selected) {
        title = `${selected.title} | 每日电影`;
        description = selected.synopsis.slice(0, 160);
        image = selected.cover?.url;
      }
    }
  } else if (path === "/about") title = "关于 | 每日电影";
  else if (path === "/api-docs") title = "API | 每日电影";
  else status = 404;
  if (status === 404) {
    title = "未收录的电影 | 每日电影";
    description = "这部电影尚未收录，或还未发布。";
  }
  const asset = await env.ASSETS.fetch(
    new Request(new URL("/index.html", req.url)),
  );
  if (!asset.ok)
    throw new HttpError(503, "ASSETS_UNAVAILABLE", "前端资源尚未就绪");
  let html = await asset.text();
  const markup = renderToString(
    createElement(
      StaticRouter,
      { location: path + url.search },
      createElement(App, { seed, notFound: status === 404 }),
    ),
  );
  html = html
    .replace(/<title>.*?<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(
      "<!--seo-->",
      () =>
        `<meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><link rel="canonical" href="${esc(url.origin + path)}">${image ? `<meta property="og:image" content="${esc(new URL(image, url.origin).href)}">` : ""}${status === 404 ? '<meta name="robots" content="noindex">' : ""}`,
    );
  html = html.replace(
    '<div id="root"></div>',
    () =>
      `<div id="root">${markup}</div><script id="bootstrap" type="application/json">${serialize({ seed, notFound: status === 404 })}</script>`,
  );
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
