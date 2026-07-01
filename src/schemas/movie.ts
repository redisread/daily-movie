import { z } from "zod";

const urlOrPath = z.string().refine(
  (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/'),
  { message: "Must be a valid URL or path starting with /" }
);

export const PosterSchema = z.object({
  url: urlOrPath,
  caption: z.string().optional(),
  video: urlOrPath.optional(),  // 微动预览视频（可选，3-5 秒）
});

export const CastSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  avatar: urlOrPath.optional(),
});

export const QuoteSchema = z.object({
  text: z.string().min(1),
  speaker: z.string().optional(),
  timestamp: z.string().optional(),  // e.g. "01:23:45"
});

export const MovieSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),  // kebab-case
  type: z.enum(["movie", "tv"]).default("movie"),  // 类型: movie | tv 剧集
  title: z.string().min(1),
  titleOriginal: z.string().optional(),
  director: z.object({
    name: z.string().min(1),
    works: z.string().optional(),  // 代表作
  }),
  year: z.number().int().min(1888).max(2100),
  duration: z.number().int().min(1),  // 分钟
  genre: z.array(z.string()).min(1),
  rating: z.number().min(0).max(10),
  cover: z.object({
    url: urlOrPath,
    bg: z.string(),  // CSS gradient or hex
    video: urlOrPath.optional(),  // 首屏海报微动预览（可选，3-5 秒）
  }),
  posters: z.array(PosterSchema).min(3).max(5),  // 3-5 张
  cast: z.array(CastSchema).min(3).max(5),  // 3-5 位
  quotes: z.array(QuoteSchema).min(3).max(10),  // 3-10 条
  synopsis: z.string().min(1),
  publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type Movie = z.infer<typeof MovieSchema>;
