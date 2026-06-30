import type { APIContext } from 'astro';

export function GET(_context: APIContext) {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
