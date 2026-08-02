# Spec: daily-movie SPA Refactor

## Objective
Convert the daily-movie multi-page static site into a single-page application (SPA) where all content is displayed within one HTML page without server round-trips.

## Tech Stack
- Astro ^6.4.8 (retained — static build output for Cloudflare Pages)
- TypeScript ^6.0.3
- Zod ^4.4.3 (data validation, unchanged)
- YAML ^2.9.0 (Markdown frontmatter parser)
- Vitest ^4.1.9 (unit tests)
- Playwright ^1.61.0 (e2e tests)

## Commands
```bash
dev:     npm run dev
build:   npm run build
preview: npm run preview
test:    npm test          # vitest run
e2e:     npm run test:e2e  # playwright test
lint:    npm run lint
```

## Project Structure
```
src/
  components/
    MovieCard.astro        # Movie card component
    MovieDetail.astro      # Movie detail view component
    MovieList.astro        # Movie list/grid view
    TodayHero.astro        # Today's movie hero section
  data/
    movies.ts              # Markdown frontmatter loader
    movies/*.md            # one Markdown document per movie
  layouts/
    Layout.astro           # shell layout (updated for SPA)
  pages/
    index.astro            # SPA entry point — all views in one page
    movies.json.ts         # JSON API (kept for external consumers)
    rss.xml.ts             # RSS feed (kept)
    health.json.ts         # health check (kept)
    404.astro              # 404 page (kept)
  schemas/
    movie.ts               # Zod schemas (unchanged)
tests/
  e2e/
    home.spec.ts           # updated e2e tests
  src/schemas/__tests__/   # Schema 与 Agent 文档测试
```

## Code Style
- TypeScript strict mode
- Astro components for markup + scoped CSS
- Client-side logic in vanilla TypeScript (no framework — keeps bundle tiny)
- CSS custom properties from v2-theme.css
- 2-space indent, single quotes

## Testing Strategy
- **Unit tests:** Vitest — Zod schema validation (existing, unchanged)
- **E2E tests:** Playwright — test SPA navigation, view switching, search and quote rendering
- Tests must pass before commit

## Boundaries
- **Always:** Run `npm test` and `npm run build` after changes
- **Ask first:** Adding new npm dependencies, changing CI config
- **Never:** Break existing Zod schemas, bypass Markdown movie documents, remove Cloudflare Pages deployability

## Success Criteria
- [x] One HTML page (`index.html`) serves all views
- [x] Today's movie displays on load (hero section)
- [x] Movie detail is viewable without page reload
- [x] Browser back/forward buttons work (URL hash or history API)
- [x] Responsive design maintained (mobile + desktop)
- [x] `npm test` passes
- [x] `npm run build` succeeds with static output
- [x] Existing JSON API and RSS endpoints still work
- [x] No new runtime dependencies added

## Open Questions
None — requirements are clear.
