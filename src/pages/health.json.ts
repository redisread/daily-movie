import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
