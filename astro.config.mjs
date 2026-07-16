import { defineConfig } from 'astro/config';

export default defineConfig({
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
