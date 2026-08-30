import type { APIContext } from 'astro';
import { movies } from '../data/movies';

export const prerender = true;

export function GET(_context: APIContext) {
  return new Response(JSON.stringify({
    success: true,
    count: movies.length,
    movies: movies,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
