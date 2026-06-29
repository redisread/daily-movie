import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://daily-movie.jiahongw.com',
  integrations: [sitemap()],
});
