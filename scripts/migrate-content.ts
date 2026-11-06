import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sourceContent } from "./content";
import { movieColumns, movieValues } from "../worker/store";
const content = sourceContent();
const quote = (s: string | number | null) =>
  s === null
    ? "NULL"
    : typeof s === "number"
      ? String(s)
      : `'${s.replace(/'/g, "''")}'`;
const sql = ["PRAGMA foreign_keys=ON;"];
for (const { movie: m } of content) {
  sql.push(
    `INSERT INTO movies (${movieColumns.join(",")}) VALUES (${movieValues(m).map(quote).join(",")}) ON CONFLICT(id) DO NOTHING;`,
  );
  for (const q of m.quotes)
    sql.push(
      `INSERT INTO quotes(id,movieId,text,speaker,timestamp,sortOrder,createdAt,updatedAt,version) VALUES (${[q.id, q.movieId, q.text, q.speaker ?? null, q.timestamp ?? null, q.sortOrder, q.createdAt, q.updatedAt, q.version].map(quote).join(",")}) ON CONFLICT(id) DO NOTHING;`,
    );
}
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/import-manifest.json",
  JSON.stringify(
    content.map((x) => x.manifest),
    null,
    2,
  ),
);
writeFileSync("artifacts/import.sql", sql.join("\n"));
if (process.argv.includes("--apply-local")) {
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--config",
      "wrangler.local.jsonc",
      "--local",
      "--file",
      "artifacts/import.sql",
    ],
    { stdio: "inherit" },
  );
}
process.stdout.write(
  `Validated ${content.length} movies / ${content.reduce((n, x) => n + x.movie.quotes.length, 0)} quotes. Manifest and local-only SQL: artifacts/\n`,
);

// A single read-only query for Cloudflare's SQL console: compares every source
// field, body, nullable value and ordered quote against the actual imported rows.
// Run on the new, unused DB BEFORE accepting any API writes.
const quoteColumns = [
  "id",
  "movieId",
  "text",
  "speaker",
  "timestamp",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "version",
];
const movieRows = content
  .map(({ movie: m }) => `(${movieValues(m).map(quote).join(",")})`)
  .join(",\n");
const quotes = content.flatMap(({ movie: m }) => m.quotes);
const quoteRows = quotes
  .map(
    (q) =>
      `(${[q.id, q.movieId, q.text, q.speaker ?? null, q.timestamp ?? null, q.sortOrder, q.createdAt, q.updatedAt, q.version].map(quote).join(",")})`,
  )
  .join(",\n");
const checkSQL = `WITH expected_movies(${movieColumns.join(",")}) AS (VALUES\n${movieRows}),\nexpected_quotes(${quoteColumns.join(",")}) AS (VALUES\n${quoteRows})\nSELECT 'movie_total' AS check_name,${content.length} AS expected,(SELECT count(*) FROM movies) AS actual\nUNION ALL SELECT 'movie_all_fields',${content.length},count(*) FROM expected_movies e JOIN movies a ON e.id=a.id WHERE ${movieColumns.map((c) => `a.${c} IS e.${c}`).join(" AND ")}\nUNION ALL SELECT 'quote_total',${quotes.length},(SELECT count(*) FROM quotes)\nUNION ALL SELECT 'quote_all_fields',${quotes.length},count(*) FROM expected_quotes e JOIN quotes a ON e.id=a.id WHERE ${quoteColumns.map((c) => `a.${c} IS e.${c}`).join(" AND ")}\nUNION ALL SELECT 'orphan_quotes',0,count(*) FROM quotes q LEFT JOIN movies m ON m.id=q.movieId WHERE m.id IS NULL;\n`;
if (Buffer.byteLength(checkSQL) > 100 * 1024)
  throw Error(
    "Verification query exceeds D1 query limit; split it explicitly before remote use.",
  );
writeFileSync("artifacts/import-verification.sql", checkSQL);
