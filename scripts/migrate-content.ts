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
