import { movieHref, shanghaiDay } from "../src/shared/format";
import type { Movie } from "../src/shared/model";
import type { TodayRecommendation } from "../src/shared/recommendation";
import { movieJson } from "./store";

function drawRecommendation(db: D1Database, day: string) {
  // Candidate rows are unique by movie ID. A single write picks and persists
  // a winner only if no eligible incumbent exists, including under concurrency.
  return db
    .prepare(
      `
    INSERT INTO daily_movie_recommendations (day, movie_id)
    SELECT ?1, (
      SELECT movie_id FROM movie_recommendation_starts
      WHERE eligible_on <= ?1
      ORDER BY randomblob(16) LIMIT 1
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM daily_movie_recommendations r
      LEFT JOIN movie_recommendation_starts s ON s.movie_id = r.movie_id
      WHERE r.day = ?1 AND (r.movie_id IS NULL OR s.eligible_on <= ?1)
    )
    ON CONFLICT(day) DO UPDATE SET movie_id = excluded.movie_id
  `,
    )
    .bind(day);
}

export async function ensureDailyRecommendation(db: D1Database) {
  await drawRecommendation(db, shanghaiDay()).run();
}

export async function todayRecommendation(
  db: D1Database,
  day = shanghaiDay(),
): Promise<TodayRecommendation> {
  const read = db
    .prepare(
      `
    SELECT CASE WHEN m.id IS NOT NULL THEN ${movieJson()} END AS value
    FROM daily_movie_recommendations r
    LEFT JOIN movie_recommendation_starts s ON s.movie_id = r.movie_id AND s.eligible_on <= r.day
    LEFT JOIN movies m ON m.id = s.movie_id
    WHERE r.day = ? AND (r.movie_id IS NULL OR m.id IS NOT NULL)
  `,
    )
    .bind(day);
  type Row = { value: string | null };
  let row = await read.first<Row>();
  if (!row) {
    const [, result] = await db.batch<Row>([drawRecommendation(db, day), read]);
    row = result.results[0];
  }
  const movie = row?.value ? (JSON.parse(row.value) as Movie) : null;
  return {
    data: movie ? { movie, href: movieHref(movie.id) } : null,
    meta: { day },
  };
}
