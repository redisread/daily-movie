import { movies } from '../data/movies';

export async function GET() {
  const baseUrl = 'https://daily-movie.jiahongw.com';
  const lastMod = new Date().toISOString().split('T')[0];

  const urls = [
    { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/library/`, changefreq: 'daily', priority: '0.9' },
    { loc: `${baseUrl}/search/`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${baseUrl}/archive/`, changefreq: 'weekly', priority: '0.7' },
    ...movies.map(movie => ({
      loc: `${baseUrl}/movie/${movie.publishedDate}/`,
      changefreq: 'monthly',
      priority: '0.8',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
