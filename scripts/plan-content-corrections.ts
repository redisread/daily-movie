import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import type { Movie } from "../src/shared/model";
import { buildContentPlan } from "./content-corrections";
const input = process.argv.indexOf("--input"),
  base = "https://daily-movie.jiahongw.com";
const movies: Movie[] = [];
if (input >= 0) {
  const snapshot = JSON.parse(
    readFileSync(process.argv[input + 1], "utf8"),
  ) as { data: Movie[] };
  movies.push(...snapshot.data);
} else {
  let cursor: string | null = null;
  const cursors = new Set<string>();
  do {
    const url = new URL("/api/v1/movies", base);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw Error(`Public read HTTP ${response.status}`);
    const body = (await response.json()) as {
      data: Movie[];
      meta: { nextCursor: string | null };
    };
    movies.push(...body.data);
    cursor = body.meta.nextCursor;
    if (cursor) {
      if (cursors.has(cursor) || movies.length >= 1000)
        throw Error("Invalid/oversize public pagination");
      cursors.add(cursor);
    }
  } while (cursor);
}
const plan = buildContentPlan(movies, base);
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/content-correction-plan.json",
  JSON.stringify(plan, null, 2),
);
let report =
  "# Content correction before / after,2026-11-07\n\n**Preview only, no production mutation performed by this script.**\n\nOriginal target: " +
  plan.originalMovieCount +
  " works / " +
  plan.originalQuoteCount +
  " quotes. Quote objects are fingerprinted and NEVER included in a PATCH. All writes require original ETag and stable idempotency key. Rollback contains only changed fields, not an entire database.\n\n";
for (const e of plan.entries) {
  report += `## ${e.id} / ${e.title}\n- Expected ETag: ${e.expectedEtag}\n- Fields: ${Object.keys(e.patch).join(", ")}\n- Quotes retained: ${e.quoteCount}\n`;
  if (e.patch.posters)
    report += `- posters: ${e.before.posters.length} → ${e.patch.posters.length}\n${e.patch.posters.map((p) => `  - ${p.caption}: ${p.url}`).join("\n")}\n`;
  if (e.patch.whyThisMovie)
    report += `- whyThisMovie before: ${e.before.whyThisMovie ?? "(empty)"}\n- after: ${e.patch.whyThisMovie}\n`;
  if (e.patch.synopsis)
    report += `- synopsis before: ${e.before.synopsis}\n- after: ${e.patch.synopsis}\n`;
  report += "\n";
}
report +=
  "## Honest image completion boundary\n- Existing covers12 were already working; no claim of repairing12 broken covers.\n- Planned distinct new image:1, NBC1973 Brando/Corleone publicity photo, not a story still. Source/use basis: content-patches/2026-11-07-media-sources.json.\n- Other11 have no newly admitted distinct poster/still in this patch; clean duplicates/false captions only. Optional actor avatars remain text-only. Existing media rights not comprehensively audited.\n- Seven supplied editorials are original curator copy, not quotations. Two precise synopsis corrections; TV duration is only an entry-recorded duration; ratings unchanged.\n- Before live use, review this plan and the source evidence. Version conflict412 requires reread/review, never force overwrite or use a key from another rollout.\n";
writeFileSync("artifacts/content-correction-diff.md", report);
process.stdout.write(
  `Prepared ${plan.entries.length} record patches; ${plan.originalQuoteCount} quotes protected. No writes.\n`,
);
