import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { sourceContent } from "./content";
import { movieJson } from "../worker/store";
import type { Movie } from "../src/shared/model";
const result = execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--config",
    "wrangler.local.jsonc",
    "--local",
    "--command",
    `SELECT ${movieJson()} AS value FROM movies m ORDER BY m.id`,
    "--json",
  ],
  { encoding: "utf8" },
);
const rows = (JSON.parse(result) as { results: { value: string }[] }[])[0]
  .results;
const actual = rows.map((r) => JSON.parse(r.value) as Movie);
const source = sourceContent();
for (const { movie } of source) {
  const migrated = actual.find((m) => m.id === movie.id);
  assert(migrated, `Missing ${movie.id}`);
  assert.deepEqual(migrated, movie, `Full-field mismatch: ${movie.id}`);
}
assert.equal(
  actual.length,
  source.length,
  "Unexpected extra movies in migration database",
);
const orphan = execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--config",
    "wrangler.local.jsonc",
    "--local",
    "--command",
    "SELECT count(*) AS n FROM quotes WHERE movieId NOT IN (SELECT id FROM movies)",
    "--json",
  ],
  { encoding: "utf8" },
);
assert.equal(JSON.parse(orphan)[0].results[0].n, 0, "Orphan quotes");
const report = {
  movies: source.length,
  quotes: source.reduce((n, x) => n + x.movie.quotes.length, 0),
  fullFieldMatch: true,
  orphanQuotes: 0,
  checkedAt: new Date().toISOString(),
};
writeFileSync(
  "artifacts/import-verification.json",
  JSON.stringify(report, null, 2),
);
process.stdout.write(JSON.stringify(report) + "\n");
