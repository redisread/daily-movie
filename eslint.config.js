import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astroEslintParser from 'astro-eslint-parser';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroEslintParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },
];
