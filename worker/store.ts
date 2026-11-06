import { shanghaiDay } from "../src/shared/format";
import type { Movie, Quote } from "../src/shared/model";

// JSON is built inside SQLite, so a write receipt captures the exact transaction's
// result, not a later read which could include another client's changes.
export const quoteJson = (q = "q") =>
  `json_object('id',${q}.id,'movieId',${q}.movieId,'text',${q}.text,'speaker',${q}.speaker,'timestamp',${q}.timestamp,'sortOrder',${q}.sortOrder,'createdAt',${q}.createdAt,'updatedAt',${q}.updatedAt,'version',${q}.version)`;
export const movieJson = (m = "m") =>
  `json_object('id',${m}.id,'type',${m}.type,'title',${m}.title,'titleOriginal',${m}.titleOriginal,'director',json(${m}.directorJson),'year',${m}.year,'duration',${m}.duration,'rating',${m}.rating,'genre',json(${m}.genreJson),'cover',json(${m}.coverJson),'posters',json(${m}.postersJson),'cast',json(${m}.castJson),'synopsis',${m}.synopsis,'whyThisMovie',${m}.whyThisMovie,'editorialMarkdown',${m}.editorialMarkdown,'publishedDate',${m}.publishedDate,'status',${m}.status,'createdAt',${m}.createdAt,'updatedAt',${m}.updatedAt,'version',${m}.version,'quotes',json(COALESCE((SELECT json_group_array(json(value)) FROM (SELECT ${quoteJson()} AS value FROM quotes q WHERE q.movieId=${m}.id ORDER BY q.sortOrder,q.id)),'[]')))`;
export async function getMovie(
  db: D1Database,
  id: string,
): Promise<Movie | null> {
  const row = await db
    .prepare(`SELECT ${movieJson()} AS value FROM movies m WHERE m.id=?`)
    .bind(id)
    .first<{ value: string }>();
  return row ? (JSON.parse(row.value) as Movie) : null;
}
export async function getQuote(
  db: D1Database,
  id: string,
): Promise<Quote | null> {
  const row = await db
    .prepare(`SELECT ${quoteJson()} AS value FROM quotes q WHERE q.id=?`)
    .bind(id)
    .first<{ value: string }>();
  return row ? (JSON.parse(row.value) as Quote) : null;
}
export const movieColumns = [
  "id",
  "type",
  "title",
  "titleOriginal",
  "directorJson",
  "year",
  "duration",
  "rating",
  "genreJson",
  "coverJson",
  "postersJson",
  "castJson",
  "synopsis",
  "whyThisMovie",
  "editorialMarkdown",
  "publishedDate",
  "status",
  "createdAt",
  "updatedAt",
  "version",
] as const;
export function movieValues(m: Movie): (string | number | null)[] {
  return [
    m.id,
    m.type,
    m.title,
    m.titleOriginal ?? null,
    JSON.stringify(m.director),
    m.year,
    m.duration,
    m.rating,
    JSON.stringify(m.genre),
    JSON.stringify(m.cover),
    JSON.stringify(m.posters),
    JSON.stringify(m.cast),
    m.synopsis,
    m.whyThisMovie ?? null,
    m.editorialMarkdown,
    m.publishedDate,
    m.status,
    m.createdAt,
    m.updatedAt,
    m.version,
  ];
}
export function insertMovie(db: D1Database, m: Movie): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO movies (${movieColumns.join(",")}) VALUES (${movieColumns.map(() => "?").join(",")})`,
    )
    .bind(...movieValues(m));
}
export function insertQuote(db: D1Database, q: Quote): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO quotes(id,movieId,text,speaker,timestamp,sortOrder,createdAt,updatedAt,version) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      q.id,
      q.movieId,
      q.text,
      q.speaker ?? null,
      q.timestamp ?? null,
      q.sortOrder,
      q.createdAt,
      q.updatedAt,
      q.version,
    );
}
export function assertVersion(
  db: D1Database,
  table: "movies" | "quotes",
  id: string,
  version: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO write_assertions(ok) VALUES ((SELECT version=? FROM ${table} WHERE id=?))`,
    )
    .bind(version, id);
}
export async function neighbors(
  db: D1Database,
  movie: Movie,
  authenticated = false,
) {
  const date = movie.publishedDate ?? "";
  const visibility = authenticated
    ? "1"
    : "status='published' AND publishedDate<=?";
  const visibleArgs = authenticated ? [] : [shanghaiDay()];
  const run = (operator: "<" | ">", order: "ASC" | "DESC") =>
    db
      .prepare(
        `SELECT id,title FROM movies WHERE ${visibility} AND (COALESCE(publishedDate,'') ${operator} ? OR (COALESCE(publishedDate,'')=? AND id ${operator} ?)) ORDER BY COALESCE(publishedDate,'') ${order},id ${order} LIMIT 1`,
      )
      .bind(...visibleArgs, date, date, movie.id)
      .first<{ id: string; title: string }>();
  const [previous, next] = await Promise.all([
    run("<", "DESC"),
    run(">", "ASC"),
  ]);
  return { previous, next };
}
