import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { movies } from '../data/movies';
import { movieToRssContent } from '../data/movie-rss';

export function GET(context: APIContext) {
  return rss({
    title: '每日电影',
    description: '每天推荐一部经典电影',
    site: context.site!,
    items: movies.map(movie => ({
      title: movie.title,
      pubDate: new Date(movie.publishedDate),
      description: movie.synopsis,
      content: movieToRssContent(movie),
      link: `/movie/${movie.publishedDate}/`,
      categories: movie.genre,
    })),
    customData: '<language>zh-cn</language>',
  });
}
