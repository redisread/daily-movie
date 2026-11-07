import { createHash } from "node:crypto";
import type { Movie } from "../src/shared/model";
import { imageSourceKey } from "../src/shared/media";
import { etag } from "../src/shared/format";
import editorials from "../content-patches/2026-11-07-editorial.json" with { type: "json" };
import media from "../content-patches/2026-11-07-media-sources.json" with { type: "json" };
export type ContentFields = Pick<
  Movie,
  "posters" | "whyThisMovie" | "synopsis"
>;
export type ContentEntry = {
  id: string;
  title: string;
  expectedEtag: string;
  idempotencyKey: string;
  before: ContentFields;
  patch: Partial<ContentFields>;
  rollback: Partial<ContentFields>;
  quotesHash: string;
  quoteCount: number;
};
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
const targetIds = [
  "cinema-paradiso",
  "lonesome-dove",
  "breaking-bad",
  "fight-club",
  "the-shawshank-redemption",
  "forrest-gump",
  "leon-the-professional",
  "the-godfather",
  "schindlers-list",
  "inception",
  "interstellar",
  "the-dark-knight",
];
export function correctedFields(movie: Movie): Partial<ContentFields> {
  const posters: Movie["posters"] = [],
    keys = new Map<string, number>();
  for (const p of movie.posters) {
    const key = imageSourceKey(p.url);
    if (
      new URL(key, "https://daily-movie.invalid").hostname === "placehold.co"
    ) {
      if (p.video)
        throw Error(
          `${movie.id}: placeholder has a video; manual review required`,
        );
      continue;
    }
    const existing = keys.get(key);
    if (existing !== undefined) {
      if (
        p.video &&
        posters[existing].video &&
        p.video !== posters[existing].video
      )
        throw Error(
          `${movie.id}: duplicate URL has distinct videos; manual review required`,
        );
      if (p.video) posters[existing].video = p.video;
      continue;
    }
    keys.set(key, posters.length);
    posters.push({
      ...p,
      caption: movie.type === "tv" ? "剧集海报" : "电影海报",
    });
  }
  const newMedia = media.added.find((m) => m.movieId === movie.id);
  if (
    newMedia &&
    !posters.some(
      (p) => imageSourceKey(p.url) === imageSourceKey(newMedia.mediaUrl),
    )
  )
    posters.push({ url: newMedia.mediaUrl, caption: newMedia.caption });
  // Keep the admitted photo's specific credit/caption on rerun, not a generic poster label.
  if (newMedia)
    for (const p of posters)
      if (imageSourceKey(p.url) === imageSourceKey(newMedia.mediaUrl))
        p.caption = newMedia.caption;
  let synopsis = movie.synopsis;
  if (movie.id === "the-godfather")
    synopsis = synopsis.replace("父亲被暗杀后", "父亲遇刺受伤后");
  if (movie.id === "forrest-gump")
    synopsis = synopsis.replace(
      "阿甘是一名智商只有75的低能儿，但在母亲的爱护下，他纯朴善良，",
      "阿甘认知能力有限，却一直受到母亲的爱护与鼓励。他纯朴善良，",
    );
  const editorial = editorials[movie.id as keyof typeof editorials];
  const patch: Partial<ContentFields> = {};
  if (canonical(posters) !== canonical(movie.posters)) patch.posters = posters;
  if (editorial && !movie.whyThisMovie?.trim()) patch.whyThisMovie = editorial;
  if (synopsis !== movie.synopsis) patch.synopsis = synopsis;
  return patch;
}
export function buildContentPlan(movies: Movie[], base: string) {
  const entries: ContentEntry[] = [];
  const missing = targetIds.filter((id) => !movies.some((m) => m.id === id));
  if (missing.length)
    throw Error(
      "Public target missing; review before patch: " + missing.join(", "),
    );
  for (const id of targetIds) {
    const movie = movies.find((m) => m.id === id)!;
    const patch = correctedFields(movie);
    if (!Object.keys(patch).length) continue;
    const before: ContentFields = {
      posters: movie.posters,
      whyThisMovie: movie.whyThisMovie ?? null,
      synopsis: movie.synopsis,
    };
    const rollback = Object.fromEntries(
      Object.keys(patch).map((k) => [k, before[k as keyof ContentFields]]),
    ) as Partial<ContentFields>;
    entries.push({
      id,
      title: movie.title,
      expectedEtag: etag(movie),
      idempotencyKey: `content-correction-2026-11-07-${id}-${fingerprint(patch).slice(0, 12)}`,
      before,
      patch,
      rollback,
      quotesHash: fingerprint(movie.quotes),
      quoteCount: movie.quotes.length,
    });
  }
  return {
    schemaVersion: 1,
    apiBase: base,
    generatedAt: new Date().toISOString(),
    entries,
    originalMovieCount: targetIds.length,
    originalQuoteCount: movies
      .filter((m) => targetIds.includes(m.id))
      .reduce((n, m) => n + m.quotes.length, 0),
    sourceNotes: media,
  };
}
