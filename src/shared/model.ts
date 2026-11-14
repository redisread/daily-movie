import { z } from "zod";

export const Id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "须为真实日期");
export const MediaURL = z
  .string()
  .max(2048)
  .refine((s) => {
    if (/^\/(?!\/)/.test(s))
      return !/[\\\s]/.test(s) && ![...s].some((c) => c.charCodeAt(0) < 32);
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "媒体仅允许 HTTPS 或站内绝对路径");
// Never accept CSS functions that can fetch content, variable expansion, or declarations.
const color = "(?:#[a-fA-F0-9]{3,8}|(?:rgb|rgba|hsl|hsla)\\([0-9.,% /+-]+\\))";
const safeBackground = new RegExp(
  `^(?:${color}|linear-gradient\\((?:[0-9.]+deg,\\s*)?${color}(?:\\s+[0-9.]+%)?(?:,\\s*${color}(?:\\s+[0-9.]+%)?){1,5}\\))$`,
);
const Background = z
  .string()
  .max(300)
  .refine((s) => safeBackground.test(s), "不安全的背景颜色");
const OptionalText = z.string().max(500).optional();
const Director = z
  .object({ name: z.string().max(200), works: OptionalText })
  .strict();
export const Cover = z
  .object({
    url: MediaURL,
    bg: Background.default("#fafaf7"),
    video: MediaURL.optional(),
  })
  .strict();
export const Poster = z
  .object({ url: MediaURL, caption: OptionalText, video: MediaURL.optional() })
  .strict();
export const Cast = z
  .object({
    name: z.string().min(1).max(200),
    role: z.string().min(1).max(200),
    avatar: MediaURL.optional(),
  })
  .strict();
export const QuoteInput = z
  .object({
    text: z
      .string()
      .transform((s) => s.trim().normalize("NFC"))
      .pipe(z.string().min(1).max(2000)),
    speaker: z.string().max(100).nullable().optional(),
    timestamp: z
      .string()
      .regex(/^\d{2}:[0-5]\d:[0-5]\d$/)
      .nullable()
      .optional(),
    sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();
export const MovieInput = z
  .object({
    id: Id,
    type: z.enum(["movie", "tv"]).default("movie"),
    title: z.string().trim().min(1).max(300),
    titleOriginal: z.string().max(500).nullable().optional(),
    director: Director.default({ name: "" }),
    year: z.number().int().min(1888).max(2100).nullable().default(null),
    duration: z
      .number()
      .int()
      .positive()
      .max(1_000_000)
      .nullable()
      .default(null),
    rating: z.number().min(0).max(10).nullable().default(null),
    genre: z.array(z.string().min(1).max(100)).max(30).default([]),
    cover: Cover.nullable().default(null),
    posters: z.array(Poster).max(100).default([]),
    cast: z.array(Cast).max(100).default([]),
    synopsis: z.string().max(20000).default(""),
    whyThisMovie: z.string().max(200).nullable().optional(),
    editorialMarkdown: z.string().max(150000).default(""),
    publishedDate: Day.nullable().default(null),
    status: z.enum(["draft", "listed", "published"]).default("draft"),
    quotes: z.array(QuoteInput).max(100).default([]),
  })
  .strict();
// PATCH must not apply create-time defaults to omitted properties (Zod 4).
const PatchFields = MovieInput.omit({ id: true, quotes: true }).extend({
  type: MovieInput.shape.type.removeDefault(),
  director: MovieInput.shape.director.removeDefault(),
  year: MovieInput.shape.year.removeDefault(),
  duration: MovieInput.shape.duration.removeDefault(),
  rating: MovieInput.shape.rating.removeDefault(),
  genre: MovieInput.shape.genre.removeDefault(),
  cover: MovieInput.shape.cover.removeDefault(),
  posters: MovieInput.shape.posters.removeDefault(),
  cast: MovieInput.shape.cast.removeDefault(),
  synopsis: MovieInput.shape.synopsis.removeDefault(),
  editorialMarkdown: MovieInput.shape.editorialMarkdown.removeDefault(),
  publishedDate: MovieInput.shape.publishedDate.removeDefault(),
  status: MovieInput.shape.status.removeDefault(),
});
export const MoviePatch = PatchFields.partial().refine(
  (o) => Object.keys(o).length > 0,
  "没有更新字段",
);
export const QuotePatch = QuoteInput.partial().refine(
  (o) => Object.keys(o).length > 0,
  "没有更新字段",
);
export type Quote = z.output<typeof QuoteInput> & {
  id: string;
  movieId: string;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Movie = Omit<z.output<typeof MovieInput>, "quotes"> & {
  quotes: Quote[];
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type MovieCreate = z.output<typeof MovieInput>;
export function publicationErrors(m: MovieCreate | Movie): string[] {
  if (m.status === "draft") return [];
  const missing = [
    m.status === "published" && !m.publishedDate && "publishedDate",
    !m.director.name.trim() && "director.name",
    !m.year && "year",
    !m.duration && "duration",
    !m.genre.length && "genre",
    !m.synopsis.trim() && "synopsis",
    !m.cover && "cover",
    !m.quotes.length && "quotes",
  ].filter((x): x is string => !!x);
  return m.status === "listed" ? missing.filter((x) => x !== "publishedDate") : missing;
}
export function stateErrors(m: MovieCreate | Movie): string[] {
  if (m.status === "listed" && m.publishedDate !== null) return ["publishedDate"];
  return publicationErrors(m);
}
