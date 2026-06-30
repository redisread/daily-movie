import type { APIContext } from 'astro';
import { movies } from '../data/schema';

export function GET(_context: APIContext) {
  return new Response(JSON.stringify(movies, null, 2), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
