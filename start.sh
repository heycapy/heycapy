#!/bin/sh
set -e

if [ -z "$LITESTREAM_BUCKET" ]; then
  exec node server.js
fi

database_url="${DATABASE_URL:-file:heycapy.db}"
export LITESTREAM_DB_PATH="${database_url#file:}"
export LITESTREAM_PATH="${LITESTREAM_PATH:-heycapy}"

# A lost volume comes back from the bucket before the app opens the database
litestream restore -if-db-not-exists -if-replica-exists "$LITESTREAM_DB_PATH"
exec litestream replicate
