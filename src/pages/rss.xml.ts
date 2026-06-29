import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { movies } from '../data/schema';

export function GET(context: APIContext) {
  return rss({
    title: '每日一电影',
    description: '每日一电影推荐，发现经典好电影',
    site: context.site!,
    items: movies.map((movie) => ({
      title: movie.title,
      description: movie.desc,
      pubDate: movie.publishedDate ? new Date(movie.publishedDate) : new Date(),
      link: `/movie/${movie.id}/`,
    })),
  });
}
