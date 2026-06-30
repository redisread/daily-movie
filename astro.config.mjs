import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://daily-movie.pages.dev',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
