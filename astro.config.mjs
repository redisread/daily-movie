import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  output: 'server',
  session: false,
  compressHTML: true,
  site: 'https://daily-movie.jiahongw.com',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
