#!/bin/bash
set -e

PORT="${PORT:-8000}"

# DATABASE_URL's role intentionally only has USAGE (not CREATE) on the public
# schema, so schema-changing setup runs against MIGRATE_DATABASE_URL's more
# privileged role instead. createcachetable is a no-op if the table already
# exists, so this is safe to run on every startup.
if [ -n "$MIGRATE_DATABASE_URL" ]; then
  RUNTIME_DATABASE_URL="$DATABASE_URL"
  export DATABASE_URL="$MIGRATE_DATABASE_URL"
fi

python manage.py createcachetable
python manage.py migrate --noinput

if [ -n "$MIGRATE_DATABASE_URL" ]; then
  export DATABASE_URL="$RUNTIME_DATABASE_URL"
fi

exec gunicorn beedero.wsgi \
  --bind="0.0.0.0:${PORT}" \
  --workers=3 \
  --timeout=90 \
  --access-logfile=- \
  --error-logfile=-
