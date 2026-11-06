import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { MovieSchema } from "./legacy-schema";
import { MovieInput, publicationErrors, type Movie } from "../src/shared/model";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function quoteId(movie: string, index: number, text: string) {
  const h = hash(`${movie}:${index}:${text}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function sourceContent() {
  const ids = new Set<string>(),
    dates = new Set<string>();
  const all = readdirSync("src/data/movies")
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((filename) => {
      const content = readFileSync(`src/data/movies/${filename}`, "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/.exec(content);
      if (!match) throw Error(`Missing frontmatter: ${filename}`);
      const frontmatter = parse(match[1]);
      const legacy = MovieSchema.strict().parse(frontmatter);
      if (ids.has(legacy.id) || dates.has(legacy.publishedDate))
        throw Error(`Duplicate id/date: ${filename}`);
      ids.add(legacy.id);
      dates.add(legacy.publishedDate);
      const editorialMarkdown = content.slice(match[0].length);
      const input = MovieInput.parse({
        ...legacy,
        editorialMarkdown,
        status: "published",
      });
      const errors = publicationErrors(input);
      if (errors.length)
        throw Error(`${filename}: incomplete ${errors.join(",")}`);
      // Lossless import: normalizing a source quote must not silently change old content.
      input.quotes.forEach((q, i) => {
        if (q.text !== legacy.quotes[i].text)
          throw Error(
            `${filename}: quote ${i} needs explicit normalization review`,
          );
      });
      if (new Set(input.quotes.map((q) => q.text)).size !== input.quotes.length)
        throw Error(`${filename}: duplicate quotes`);
      const now = "2026-11-06T00:00:00.000Z";
      const movie: Movie = {
        ...input,
        titleOriginal: input.titleOriginal ?? null,
        whyThisMovie: input.whyThisMovie ?? null,
        createdAt: now,
        updatedAt: now,
        version: 1,
        quotes: input.quotes.map((q, i) => ({
          ...q,
          speaker: q.speaker ?? null,
          timestamp: q.timestamp ?? null,
          id: quoteId(input.id, i, q.text),
          movieId: input.id,
          sortOrder: i,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })),
      };
      return {
        movie,
        manifest: {
          filename,
          id: movie.id,
          date: movie.publishedDate,
          frontmatter,
          bodyHash: hash(editorialMarkdown),
          fileHash: hash(content),
          quotes: movie.quotes.length,
          cast: movie.cast.length,
          posters: movie.posters.length,
        },
      };
    });
  return all;
}
