# Production rollout / 2026-11-06

## Task #65 release delegation (2026-11-14)

After Jeff stated that production migration, deployment, and the ten reviewed draft-to-listed changes required authorization, the user explicitly authorized completing that scope in #proj-daily-movie msg=5069ce41. This supersedes the older Pi-only remote-operator assignment below for this Daily Movie release only. Jeff is the authorized operator for task #65 through its closure; all other project permissions remain unchanged. Preserve the user authorization reference in release evidence.

The 2026-11-06/07 facts and sequence below are historical snapshots. Before each production operation, use fresh Wrangler/D1 state; the live database now contains 23 movies and 48 quotes, so the original empty-database bootstrap steps do not apply.

## Historical authority and unique operators (2026-11-06)

Victor authorized “改完生产配置之后，部署新版上线” at17:12UTC (Raft msg1f47383c). At that time Pi was the sole remote resource/import/deployment operator; Jeff prepared code/config/SQL and tests. This historical operator assignment is superseded only as scoped by the task #65 addendum above. This document is a coordination checklist, not a claim that production deployment has already occurred.

## Live facts verified by Pi

- Worker **daily-movie**, custom domain **daily-movie.jiahongw.com**, existing domain remains unchanged.
- Old deployment **32c9e996-c59a-4cdc-ba0c-63eb696bc09f**, version **a8581460-20fb-4a92-a1b5-899bd3cd77fa**,100% before rollout, only ASSETS binding, no variables/secrets or D1 binding.
- Builds: redisread/daily-movie, main, build `npm run verify`, deploy `npx wrangler deploy`, root `/`.
- Pi created **daily-movie-prod**, id **38ad8d52-dadd-416d-8e16-e1e299706ddc**, empty0 tables, not yet bound at handoff. No other database modified and no paid plan upgrade. No second remote test DB required: validate the new unused DB before it receives production traffic.
- Previous network/control blockers have cleared. Do not use old timeout announcements as a deployment hold.

## Config / environment separation

Default `wrangler.jsonc` now targets the existing production Worker/domain and real DB, binding **DB**, assets **ASSETS**, required server secret **CONTENT_API_KEY**, bootstrap **WRITES_PAUSED=1**, then source target **0** after Pi reports the bootstrap checks below passed. Preserve original workers.dev/preview settings by not introducing new overrides. Every local script explicitly uses `wrangler.local.jsonc` and `--local`, whose DB id stays a dummy. No local script calls remote D1.

The handler fails closed: only the exact pause value `0` permits writes. Paused/missing/invalid values return503+Retry-After for authenticated writes. Unauthenticated writes still401. Never publish without the key provisioned. Keys stay with Pi and Cloudflare; don't paste them to chats, PRs or browser bundles.

## Ordered rollout gates

1. **Source backup**: keep main baselinea5f3306 and its Markdown in Git; import manifest has full frontmatter/file/body hashes. Preserve the old full Worker version/deployment above for rollback. This is a saved reference, not a claim of a separate provider export backup.
2. **New DB import before binding**: in the new daily-movie-prod only, execute schema `migrations/0001_content.sql` then `npm run db:manifest`'s `artifacts/import.sql`, or the equivalent combined bootstrap SQL supplied to Pi. DDL and inserts are rerunnable without overwriting existing ids.
3. **Full-field verification**: execute generated `artifacts/import-verification.sql`. Five rows expected/actual must match: movie_total12, movie_all_fields12, quote_total37, quote_all_fields37, orphan_quotes0. Repeat bootstrap+verification. This query compares every column including original body/JSON/quote ids and order, not only counts. Run before accepting API writes; later operational edits should not be overwritten to make this initial manifest match.
4. **Key and release configuration**: Pi securely generates/provisions CONTENT_API_KEY for the production Worker; no plaintext handoff. Confirm final code/config commit and CI. Do not merge a preview placeholder or an older commit. main auto-deploys, so merge and deployment must be coordinated by the unique operator.
5. **Bootstrap release**: publish the new Worker with DB binding and WRITES_PAUSED=1. Keep domain unchanged. Check homepage, library, details, /api/health, /api/openapi.json, actual404/SEO, no-key write401 and valid-key write503. Record new version/deployment id and live binding snapshot.
6. **Open writes only after read checks**: Jeff syncs production config to WRITES_PAUSED=0 after Pi reports the preceding gate passed; coordinate the final publish so file/config and live setting agree. Do not silently flip a dashboard value that the next main build would overwrite.
7. **Live acceptance**: Pi uses the key locally to create an explicitly labelled QA draft, add a quote, GET current ETag, publish, verify public read/page within30 seconds, then withdraw QA movie to draft. Keep QA id/receipts as audit data, not public content. Verify persisted data after the planned runtime version transition. Never send the key back; return statuses, ids, row checks and version ids only.

## Rollback

- First set writes paused and verify503+Retry-After. Stop overlapping automatic builds/releases; don't roll code back while still accepting writes.
- Export/backup the new D1 including post-cutover additions and receipts with the approved provider workflow. Keep the new DB; do not delete, reset, overwrite or “re-import over” runtime data.
- Pi restores old Worker version **a8581460-20fb-4a92-a1b5-899bd3cd77fa** and its prior assets/config, existing custom domain unchanged. Verify that the chosen old version remains available immediately before invoking rollback.
- Old static app is not required to display new D1 content, per user “no compatibility” decision; communicate API unavailability and preserve all new content for forward recovery. Record actual rollback deployment id and backup location.

## Remaining evidence

Pi must report remote import five-row results, key provisioned (no value), actual deployed commit/version, post-publish read/write results and pause state. Local/CI green does not replace these remote checks. No unverified production success claim.

## Paused bootstrap evidence /17:35 UTC

Pi reported main8cea62b505fa7d009e259e7216bb255384a578d3, Cloudflare build7eeecd7b-2d5b-4001-a619-7cfd738c48da, deployment1f98945e-d729-4334-b131-536220b0e211, versionc330cf15-35dc-480d-86ad-7993b57c6041 at100%. Correct DB/ASSETS/CONTENT_API_KEY/pause bindings present. Home/library/detail/health/OpenAPI200;12 public works; nonexistent route404; title/canonical correct; Chrome interactive page rendered. No-key POST401; valid-key POST503 + Retry-After300.

These provider/runtime facts are Pi's observations, not inferred from build success. They satisfy the paused release gate. The next source commit changes only the production pause target to0 and matching types/records; Pi remains sole merge/publish operator and must report the actual write-enabled version and authenticated QA acceptance before closure. Local config remains isolated.
