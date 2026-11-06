# Daily Movie engineering guide

Read README.md, docs/rebuild-spec-v1.2.md, DESIGN.md and docs/engineering.md first.

- React + Vite + TypeScript; Worker + D1. CSS Modules + src/tokens.css only. No Astro, Tailwind, MCP, account UI, or browser write keys.
- Runtime content comes ONLY from D1. src/data/movies/*.md are preserved legacy backup/import input. Do not add new runtime content there; use authenticated HTTP API.
- Public routes /, /library, /movies/:id, /api-docs, /about; API /api/v1/*, /api/openapi.json, /api/health. No legacy route/response/RSS compatibility (Victor ec90f577).
- Server-only CONTENT_API_KEY. All writes require Idempotency-Key, PATCH requires current If-Match. D1 batch must atomically mutate business data and store exact receipt. Never add in-memory idempotency/authoritative rate limit.
- Preserve all content/cast/poster/video/quote fields. Do not invent media, ratings, quotes, or contact details.
- Source-import schema scripts/legacy-schema.ts describes the OLD 3–5 poster/cast, 3–10 quote requirement. NEW API schema src/shared/model.ts permits empty media/quotes in draft and >=1 quote when publishing. Do not impose legacy quotas on API callers.
- npm run verify; npm run test:e2e; npm run db:verify:local. Playwright uses real local Worker/D1. See README for local secret setup.
- Feature branches use raft/ prefix, PR review required, never push main or self-merge. main has external Workers Builds auto-deploy: no merge until explicit production approval.
- wrangler.jsonc is deliberately preview/local-only with placeholder DB and no production route. No remote database/secret/deployment changes without explicit scoped approval. See docs/cutover.md.
- Production custom domain https://daily-movie.jiahongw.com. Never use daily-movie.pages.dev (third-party-owned).
