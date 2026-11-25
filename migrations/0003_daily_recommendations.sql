CREATE TABLE movie_recommendation_starts (
  movie_id TEXT PRIMARY KEY NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  eligible_on TEXT CHECK (date(eligible_on, '+0 days') IS eligible_on)
);
CREATE INDEX movie_recommendation_starts_day ON movie_recommendation_starts(eligible_on);

CREATE TABLE daily_movie_recommendations (
  day TEXT PRIMARY KEY NOT NULL CHECK (date(day, '+0 days') IS day),
  movie_id TEXT REFERENCES movies(id) ON DELETE SET NULL
);

-- The published catalog can participate on the first day. A scheduled
-- publication that is still private joins one day after becoming public.
INSERT INTO movie_recommendation_starts (movie_id, eligible_on)
SELECT id, CASE
  WHEN status = 'listed' OR publishedDate <= date('now', '+8 hours')
    THEN date('now', '+8 hours')
  ELSE date(publishedDate, '+1 day')
END
FROM movies WHERE status IN ('listed', 'published')
  AND (status = 'listed' OR publishedDate IS NOT NULL);

CREATE TRIGGER movie_recommendation_start_on_insert
AFTER INSERT ON movies
WHEN NEW.status = 'listed' OR (NEW.status = 'published' AND NEW.publishedDate IS NOT NULL)
BEGIN
  INSERT INTO movie_recommendation_starts (movie_id, eligible_on)
  VALUES (NEW.id, CASE
    WHEN NEW.status = 'listed' THEN date('now', '+8 hours', '+1 day')
    ELSE max(date('now', '+8 hours', '+1 day'), date(NEW.publishedDate, '+1 day'))
  END);
END;

CREATE TRIGGER movie_recommendation_start_on_visibility_change
AFTER UPDATE OF status, publishedDate ON movies
WHEN NEW.status IS NOT OLD.status OR NEW.publishedDate IS NOT OLD.publishedDate
BEGIN
  -- Preserve the first eligible day when an already-public movie stays public.
  DELETE FROM movie_recommendation_starts WHERE movie_id = NEW.id
    AND (NEW.status = 'draft' OR (NEW.status = 'published' AND NEW.publishedDate IS NULL));

  INSERT INTO movie_recommendation_starts (movie_id, eligible_on)
  SELECT NEW.id, CASE
    WHEN NEW.status = 'listed' THEN date('now', '+8 hours', '+1 day')
    ELSE max(date('now', '+8 hours', '+1 day'), date(NEW.publishedDate, '+1 day'))
  END
  WHERE NEW.status = 'listed' OR (NEW.status = 'published' AND NEW.publishedDate IS NOT NULL)
  ON CONFLICT(movie_id) DO UPDATE SET eligible_on = excluded.eligible_on
    WHERE NOT (
      (OLD.status = 'listed' OR (OLD.status = 'published' AND OLD.publishedDate <= date('now', '+8 hours')))
      AND (NEW.status = 'listed' OR (NEW.status = 'published' AND NEW.publishedDate <= date('now', '+8 hours')))
    );

  -- The incumbent and candidate pool change in the same movie write and receipt
  -- transaction. Only today's recommendation is affected by a withdrawal.
  UPDATE daily_movie_recommendations
  SET movie_id = (
    SELECT movie_id FROM movie_recommendation_starts
    WHERE eligible_on <= daily_movie_recommendations.day
    ORDER BY randomblob(16) LIMIT 1
  )
  WHERE day = date('now', '+8 hours') AND movie_id = NEW.id
    AND NOT EXISTS (
      SELECT 1 FROM movie_recommendation_starts WHERE movie_id = NEW.id AND eligible_on <= daily_movie_recommendations.day
    );
END;
