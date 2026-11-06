# Local validation / 2026-11-06

Scope: React + Vite / Worker + D1 rebuild, Steven spec v1.2. Local workerd/D1 only. No production database, secret, domain, deployment, or main-branch merge performed.

## Passed

- `npm run verify`: CSS mapping freshness, ESLint, TypeScript, Wrangler generated binding check, **52 tests** (30 API integration tests on actual Miniflare D1, 6 new schema/import tests, 16 legacy-import/writer contract tests), Vite build.
- API tests include missing/wrong key, no public draft/future content, create/publish/change schedule, exact idempotency replay including concurrent same-key create, payload conflict, stale/missing ETag, same-movie quote NFC dedup and cross-movie independence, concurrent different-key duplicate quotes, atomic rollback on uniqueness failure, unknown fields/unsafe media/invalid dates/rating/timestamps, malformed/oversize JSON, source rate limit/Retry-After, seven-day receipt expiry, and persistent D1 across Worker runtime restart.
- `npx playwright test`: **14 browser tests**. Real local Worker/D1, 1440/1280/768/375/320 widths, actual 420ms transition measurement, keyboard/reduced-motion 0ms, rapid reverse changes, drag/cancel, search/empty/retry/fallback, full detail/copy/back navigation, real404/SEO, mobile collections 0/1/2/3/4/5/6/15 without invented entries.
- Additional eight-round combination: repeated reverse/forward switching + toggling reduced motion + opening selected detail + back. All passed; did not reproduce the design review's intermittent “stays on homepage” report.
- Cold-start server run on an alternate local port: **13 browser tests** passed with no existing server reused (before the added combination test). Uses same migrate/import startup sequence as CI.
- Source import: **12 works, 37 quotes**, all fields/ordered children/body/ids exactly matched normalized database representation, no orphan quotes. Re-import performed and full-field verification repeated. Missing optional nullable fields are represented as SQL NULL; original files and full frontmatter/file/body hashes are preserved.
- Local live API smoke: create draft → append quote → GET ETag → publish → public GET and server-rendered page → independent D1 disk query. Passed; test movie/quote/receipts cleaned afterward. Import verification passed again.
- `npm audit --omit=dev --audit-level=high`: **0 production vulnerabilities**. Full development audit has moderate minimatch/toolchain advisories; not concealed as a fully clean development dependency audit.
- `wrangler deploy --dry-run`: passed, bundle ~1949 KiB / ~345 KiB gzip. Preview/local placeholder database only, no production route configured.
- Initial client JavaScript ~285.6 KiB / ~91.3 KiB gzip, Markdown rendering split into an on-demand chunk.

## Design acceptance

Steven independently checked local desktop1440/mobile375/320 overflow, 420ms ordinary rotation, rapid reverse selection consistency, keyboard/reduced-motion 0ms, and five mobile posters, and approved the core direction. A nonblocking mobile whitespace suggestion was applied afterward: controls move up48px only with >=6 films, preserving room for small collections.

## Not claimed / next gates

- GitHub CI result is separate from local checks; inspect PR checks after push.
- Human/engineering review and final preview approval required; production deployment is NOT authorized by passing tests or PR creation.
- No remote D1 provisioning/import, production Worker version or error-log inspection, or production switch has been performed. Default config cannot be used as a production deployment config.
- Named-device/network LCP/CLS, VoiceOver/screen-reader real-device behavior, remote staging persistence and rollback drill are not measured here. Local tests are not a production acceptance substitute.
- See docs/cutover.md for approval, impact, binding, write-pause/export and rollback requirements. main has automatic Workers Builds: do not merge without separate production approval and final production config.
