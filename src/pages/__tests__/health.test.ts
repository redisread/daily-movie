import { describe, expect, it } from 'vitest';
import { GET } from '../health.json';

describe('GET /health.json', () => {
  it('returns an uncached runtime health response', async () => {
    const response = GET();
    const body = await response.json() as { status: string; timestamp: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
