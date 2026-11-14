-- Rebuild the status CHECK without changing existing movie or quote values.
-- D1 supports deferred foreign-key checks within this migration transaction.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE movies_new (
 id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('movie','tv')), title TEXT NOT NULL,
 titleOriginal TEXT, directorJson TEXT NOT NULL CHECK(json_valid(directorJson)),
 year INTEGER CHECK(year BETWEEN 1888 AND 2100), duration INTEGER CHECK(duration > 0), rating REAL CHECK(rating BETWEEN 0 AND 10),
 genreJson TEXT NOT NULL CHECK(json_valid(genreJson)), coverJson TEXT NOT NULL CHECK(json_valid(coverJson)),
 postersJson TEXT NOT NULL CHECK(json_valid(postersJson)), castJson TEXT NOT NULL CHECK(json_valid(castJson)),
 synopsis TEXT NOT NULL, whyThisMovie TEXT, editorialMarkdown TEXT NOT NULL,
 publishedDate TEXT UNIQUE, status TEXT NOT NULL CHECK(status IN ('draft','listed','published'))
 CHECK(status != 'listed' OR publishedDate IS NULL),
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)
);
INSERT INTO movies_new (
 id,type,title,titleOriginal,directorJson,year,duration,rating,genreJson,coverJson,postersJson,castJson,
 synopsis,whyThisMovie,editorialMarkdown,publishedDate,status,createdAt,updatedAt,version
)
SELECT id,type,title,titleOriginal,directorJson,year,duration,rating,genreJson,coverJson,postersJson,castJson,
 synopsis,whyThisMovie,editorialMarkdown,publishedDate,status,createdAt,updatedAt,version
FROM movies;
CREATE TABLE quotes_new (
 id TEXT PRIMARY KEY, movieId TEXT NOT NULL REFERENCES movies_new(id), text TEXT NOT NULL,
 speaker TEXT, timestamp TEXT, sortOrder INTEGER NOT NULL CHECK(sortOrder >= 0),
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
 UNIQUE(movieId,text)
);
INSERT INTO quotes_new (id,movieId,text,speaker,timestamp,sortOrder,createdAt,updatedAt,version)
SELECT id,movieId,text,speaker,timestamp,sortOrder,createdAt,updatedAt,version FROM quotes;
DROP TABLE quotes;
DROP TABLE movies;
ALTER TABLE movies_new RENAME TO movies;
ALTER TABLE quotes_new RENAME TO quotes;

CREATE INDEX movies_public ON movies(status,publishedDate DESC,id DESC);
CREATE INDEX quotes_ordered ON quotes(movieId,sortOrder,id);
