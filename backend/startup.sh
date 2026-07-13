#!/bin/bash
set -e

# Explicit startup command for Azure App Service — without this, Oryx's
# auto-detected default falls back to a single sync worker, so one slow
# request (cold DB connection, etc.) queues every other request behind it,
# which is what has been making login look randomly "stuck".
# --timeout is above the frontend's AUTH_TIMEOUT_MS (60s) so gunicorn never
# kills a worker before the client itself times out.
PORT="${PORT:-8000}"

exec gunicorn beedero.wsgi \
  --bind="0.0.0.0:${PORT}" \
  --workers=3 \
  --timeout=90 \
  --access-logfile=- \
  --error-logfile=-
