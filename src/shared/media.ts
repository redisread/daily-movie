import type { Movie } from "./model";
export function imageSourceKey(src: string): string {
  try {
    const url = new URL(src, "https://daily-movie.invalid");
    if (url.hostname === "images.weserv.nl" && url.searchParams.get("url"))
      return imageSourceKey(
        url.searchParams.get("url")!.replace(/^(?!https?:\/\/)/, "https://"),
      );
    return url.origin + url.pathname + url.search;
  } catch {
    return src;
  }
}
// Only resize the already-used, reviewed source hosts. Never proxy arbitrary URLs.
export function imageVariant(src: string, width: number): string {
  try {
    const url = new URL(src);
    if (url.hostname === "images.weserv.nl") {
      url.searchParams.set("w", String(width));
      url.searchParams.set("output", "webp");
      return url.href;
    }
    if (
      url.hostname === "upload.wikimedia.org" &&
      /^\/wikipedia\/(?:en|commons)\//.test(url.pathname)
    ) {
      const proxy = new URL("https://images.weserv.nl/");
      proxy.searchParams.set("url", url.hostname + url.pathname);
      proxy.searchParams.set("w", String(width));
      proxy.searchParams.set("output", "webp");
      return proxy.href;
    }
    if (
      url.hostname === "m.media-amazon.com" &&
      /\._V1_\.jpg$/.test(url.pathname)
    ) {
      url.pathname = url.pathname.replace("._V1_.jpg", `._V1_SX${width}_.jpg`);
      return url.href;
    }
  } catch {
    /* Local paths and unrecognized URLs retain the original source. */
  }
  return src;
}
export function imageSet(src: string, widths: number[]): string | undefined {
  const entries = widths.map((w) => [imageVariant(src, w), w] as const);
  return entries.some(([url]) => url !== src)
    ? entries.map(([url, w]) => `${url} ${w}w`).join(", ")
    : undefined;
}
export function galleryFor(movie: Pick<Movie, "posters" | "cover">) {
  const seen = new Set<string>();
  const posters = movie.posters.filter((p) => {
    const key = imageSourceKey(p.url);
    if (new URL(key, "https://daily-movie.invalid").hostname === "placehold.co")
      return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return posters.length === 1 &&
    movie.cover &&
    imageSourceKey(posters[0].url) === imageSourceKey(movie.cover.url) &&
    !posters[0].video
    ? []
    : posters;
}
