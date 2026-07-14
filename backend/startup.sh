#!/bin/bash
set -e

PORT="${PORT:-8000}"

python manage.py createcachetable 2>/dev/null || true
python manage.py migrate --noinput

exec gunicorn beedero.wsgi \
  --bind="0.0.0.0:${PORT}" \
  --workers=3 \
  --timeout=90 \
  --access-logfile=- \
  --error-logfile=-
