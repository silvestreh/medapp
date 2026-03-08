#!/bin/bash
set -e

REMOTE_URL="$1"

if [ -z "$REMOTE_URL" ]; then
  echo "Usage: $0 <remote-postgres-connection-string>"
  echo "Example: $0 \"postgres://user:pass@host:port/railway\""
  exit 1
fi

LOCAL_URL="postgres://postgres:@localhost:5432/athelas_api"
DUMP_FILE="/tmp/athelas_dump.dump"

echo "==> Dropping generated columns from local DB before dump..."
psql "$LOCAL_URL" <<'SQL'
ALTER TABLE "personal_data" DROP COLUMN IF EXISTS "searchFirstName";
ALTER TABLE "personal_data" DROP COLUMN IF EXISTS "searchLastName";
ALTER TABLE "medications" DROP COLUMN IF EXISTS "searchText";
SQL
echo "    Done."

echo "==> Dumping local database..."
pg_dump -Fc --no-owner --no-acl "$LOCAL_URL" -f "$DUMP_FILE"
echo "    Done. Dump saved to $DUMP_FILE"

echo "==> Re-adding generated columns to local DB..."
psql "$LOCAL_URL" <<'SQL'
ALTER TABLE "personal_data"
ADD COLUMN "searchFirstName" text
GENERATED ALWAYS AS (immutable_unaccent(lower("firstName"))) STORED;

ALTER TABLE "personal_data"
ADD COLUMN "searchLastName" text
GENERATED ALWAYS AS (immutable_unaccent(lower("lastName"))) STORED;

ALTER TABLE "medications"
ADD COLUMN "searchText" text
GENERATED ALWAYS AS (immutable_unaccent(lower("commercialNamePresentation" || ' ' || "genericDrug"))) STORED;
SQL
echo "    Done."

echo "==> Wiping remote public schema..."
psql "$REMOTE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
echo "    Done."

echo "==> Restoring dump to remote..."
pg_restore --no-owner --no-acl --verbose -d "$REMOTE_URL" "$DUMP_FILE"
echo "    Done."

echo "==> Creating generated columns and indexes on remote..."
psql "$REMOTE_URL" <<'SQL'
ALTER TABLE "personal_data"
ADD COLUMN "searchFirstName" text
GENERATED ALWAYS AS (immutable_unaccent(lower("firstName"))) STORED;

ALTER TABLE "personal_data"
ADD COLUMN "searchLastName" text
GENERATED ALWAYS AS (immutable_unaccent(lower("lastName"))) STORED;

ALTER TABLE "medications"
ADD COLUMN "searchText" text
GENERATED ALWAYS AS (immutable_unaccent(lower("commercialNamePresentation" || ' ' || "genericDrug"))) STORED;

CREATE INDEX IF NOT EXISTS personal_data_search_first_name_idx ON "personal_data" USING gin ("searchFirstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS personal_data_search_last_name_idx ON "personal_data" USING gin ("searchLastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS medications_search_text_idx ON "medications" USING gin ("searchText" gin_trgm_ops);
SQL
echo "    Done."

echo "==> Cleaning up..."
rm -f "$DUMP_FILE"

echo "==> Migration complete!"
