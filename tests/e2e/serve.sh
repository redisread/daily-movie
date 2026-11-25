#!/bin/sh
set -eu

state=.wrangler/e2e
config=wrangler.local.jsonc
npm run build
wrangler d1 migrations apply DB --config "$config" --local --persist-to "$state"
npm run db:manifest
wrangler d1 execute DB --config "$config" --local --persist-to "$state" --file artifacts/import.sql
# The imported fixtures represent the already-public catalog at cutover.
wrangler d1 execute DB --config "$config" --local --persist-to "$state" \
  --command "UPDATE movie_recommendation_starts SET eligible_on=date('now','+8 hours') WHERE movie_id IN (SELECT id FROM movies WHERE status='published' AND publishedDate<=date('now','+8 hours')) AND eligible_on>date('now','+8 hours')"
exec wrangler dev --config "$config" --local --persist-to "$state" --port 4321
