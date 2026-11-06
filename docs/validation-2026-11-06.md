# Local validation / 2026-11-06

Initial phase (before17:12UTC launch authorization): React + Vite / Worker + D1 rebuild, Steven spec v1.2. Local workerd/D1 only at that point. See the production-preparation addendum for current status and separation of Jeff/Pi actions.

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

## Production preparation,17:12–17:25 UTC (after explicit launch authorization)

- Victor authorized production config + launch. Pi owns remote work; Jeff owns code/SQL only.
- Production config now targets existing daily-movie/custom domain and dedicated DB daily-movie-prod (38ad8d52-dadd-416d-8e16-e1e299706ddc), initially WRITES_PAUSED=1. Local scripts explicitly select wrangler.local.jsonc and --local; no runtime DB id substitution.
- Worker write guard changed to fail closed unless pause value is exactly0. Three additional real D1 tests cover1/missing/invalid flag. **npm run verify now55 tests PASS**, browser14 PASS, local live smoke PASS, production audit0, production-target dry-run PASS. Dry-run did not deploy remotely.
- Generated read-only full-field SQL executed locally:12/12 movies,12/12 full movie fields,37/37 quotes,37/37 full quote fields,0/0 orphans.
- Pi reports two identical remote import/verification passes, matching attachment SHA256 values, server key provisioned without disclosure and pause1 set on the old application. No new app/DB binding was published at that handoff. These are Pi's remote observations, separate from Jeff's local test results.
- Bootstrap attachment SHA256 a2afc2b95e3bebe6de1fb58e3bd21798f4204a88671b262812b92abee85a345c; verify4708c2112d7e1f0e1f9af8cb47128d383c7ef18b229eecbda0a6257229639d96. Generated by source manifest, no credentials.
- Final code CI, actual Worker launch/pause check, then an explicitly coordinated write-enable version remain separate rollout gates. See updated docs/cutover.md; no automatic second production approval request is implied after already authorized steps, but unique-operator and evidence gates remain.
