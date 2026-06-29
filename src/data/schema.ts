import { z } from 'zod';

export const MovieSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleEn: z.string().optional(),
  director: z.string(),
  year: z.number(),
  duration: z.number(), // 分钟
  rating: z.number().min(0).max(10),
  category: z.string(),
  desc: z.string(),
  coverBg: z.string(),
  coverTitle: z.string(),
  coverDirector: z.string(),
  publishedDate: z.string().nullable().optional(),
  poster: z.string().optional(),
  cast: z.array(z.string()).optional(),
  quotes: z.array(z.object({
    text: z.string(),
    character: z.string().optional(),
  })).optional(),
});

export type Movie = z.infer<typeof MovieSchema>;

export const movies: Movie[] = [];
