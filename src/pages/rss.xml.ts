import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { movies } from '../data/movies';

export function GET(context: APIContext) {
  return rss({
    title: '每日一电影',
    description: '每日一电影推荐，发现经典好电影',
    site: context.site!,
    items: movies.map((movie) => ({
      title: movie.title,
      description: movie.synopsis,
      pubDate: new Date(movie.publishedDate),
      link: `/movie/${movie.publishedDate}/`,
    })),
  });
}
