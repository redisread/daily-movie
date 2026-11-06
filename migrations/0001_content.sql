PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS movies (
 id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('movie','tv')), title TEXT NOT NULL,
 titleOriginal TEXT, directorJson TEXT NOT NULL CHECK(json_valid(directorJson)),
 year INTEGER CHECK(year BETWEEN 1888 AND 2100), duration INTEGER CHECK(duration > 0), rating REAL CHECK(rating BETWEEN 0 AND 10),
 genreJson TEXT NOT NULL CHECK(json_valid(genreJson)), coverJson TEXT NOT NULL CHECK(json_valid(coverJson)),
 postersJson TEXT NOT NULL CHECK(json_valid(postersJson)), castJson TEXT NOT NULL CHECK(json_valid(castJson)),
 synopsis TEXT NOT NULL, whyThisMovie TEXT, editorialMarkdown TEXT NOT NULL,
 publishedDate TEXT UNIQUE, status TEXT NOT NULL CHECK(status IN ('draft','published')),
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0)
);
CREATE INDEX IF NOT EXISTS movies_public ON movies(status,publishedDate DESC,id DESC);
CREATE TABLE IF NOT EXISTS quotes (
 id TEXT PRIMARY KEY, movieId TEXT NOT NULL REFERENCES movies(id), text TEXT NOT NULL,
 speaker TEXT, timestamp TEXT, sortOrder INTEGER NOT NULL CHECK(sortOrder >= 0),
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
 UNIQUE(movieId,text)
);
CREATE INDEX IF NOT EXISTS quotes_ordered ON quotes(movieId,sortOrder,id);
CREATE TABLE IF NOT EXISTS api_requests (
 idempotencyKey TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, requestHash TEXT NOT NULL,
 responseStatus INTEGER NOT NULL, responseBody TEXT NOT NULL, responseEtag TEXT,
 createdAt INTEGER NOT NULL, PRIMARY KEY(idempotencyKey,method,path)
);
CREATE INDEX IF NOT EXISTS requests_expiry ON api_requests(createdAt);
-- Assertions run INSIDE D1 batch transactions. Failure rolls back business + receipt.
-- A NOT NULL constraint is intentional: a missing resource must not pass a NULL CHECK.
CREATE TABLE IF NOT EXISTS write_assertions (ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expiresAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expiresAt);
