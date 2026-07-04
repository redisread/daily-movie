import type { APIContext } from 'astro';
import { movies } from '../data/movies';

const VALID_SORT = new Set(['date', 'rating', 'title', 'year']);
const VALID_ORDER = new Set(['asc', 'desc']);

export function GET(context: APIContext) {
  const { url } = context.request as Request & { url: string };
  const u = new URL(url);

  const typeParam = u.searchParams.get('type');
  let result = [...movies];

  // Filter by type
  if (typeParam === 'movie') result = result.filter(m => m.type !== 'tv');
  else if (typeParam === 'tv') result = result.filter(m => m.type === 'tv');

  // Filter by genre
  const genreParam = u.searchParams.get('genre');
  if (genreParam) {
    const genres = genreParam.split(',').map(g => g.trim()).filter(Boolean);
    result = result.filter(m => m.genre?.some(g => genres.includes(g)));
  }

  // Filter by year
  const yearFrom = u.searchParams.get('year_from');
  const yearTo = u.searchParams.get('year_to');
  if (yearFrom) result = result.filter(m => m.year >= Number(yearFrom));
  if (yearTo) result = result.filter(m => m.year <= Number(yearTo));

  // Filter by rating
  const ratingMin = u.searchParams.get('rating_min');
  const ratingMax = u.searchParams.get('rating_max');
  if (ratingMin) result = result.filter(m => m.rating >= Number(ratingMin));
  if (ratingMax) result = result.filter(m => m.rating <= Number(ratingMax));

  // Search by title/director/cast
  const q = u.searchParams.get('q');
  if (q) {
    const query = q.toLowerCase();
    result = result.filter(m => {
      return m.title.toLowerCase().includes(query)
        || m.titleOriginal?.toLowerCase().includes(query)
        || m.director?.name?.toLowerCase().includes(query)
        || m.cast?.some(c => c.name.toLowerCase().includes(query));
    });
  }

  // Sort
  const sort = u.searchParams.get('sort') || 'publishedDate';
  const order = VALID_ORDER.has(u.searchParams.get('order') || '') ? u.searchParams.get('order') : 'desc';
  if (VALID_SORT.has(sort)) {
    result.sort((a, b) => {
      let va: any, vb: any;
      switch (sort) {
        case 'date': va = a.publishedDate; vb = b.publishedDate; break;
        case 'rating': va = a.rating; vb = b.rating; break;
        case 'title': va = a.title; vb = b.title; break;
        case 'year': va = a.year; vb = b.year; break;
        default: va = a.publishedDate; vb = b.publishedDate;
      }
      if (typeof va === 'string') return order === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return order === 'asc' ? va - vb : vb - va;
    });
  }

  // Limit
  const limitParam = u.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100);
  const offsetParam = u.searchParams.get('offset');
  const offset = Math.max(Number(offsetParam) || 0, 0);

  const total = result.length;
  const sliced = result.slice(offset, offset + limit);

  return new Response(JSON.stringify({
    success: true,
    total,
    count: sliced.length,
    offset,
    limit,
    filters: {
      type: typeParam || null,
      genre: genreParam || null,
      year_from: yearFrom || null,
      year_to: yearTo || null,
      rating_min: ratingMin || null,
      rating_max: ratingMax || null,
      q: q || null,
      sort,
      order,
    },
    movies: sliced,
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
