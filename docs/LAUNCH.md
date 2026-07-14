# Beedero — Launch operations checklist

Use this after deploying the launch-readiness changes.

## Production secrets (Azure App Settings)

| Variable | Service | Purpose |
|---|---|---|
| `MANAGEMENT_SECRET` | API | Protects `/api/internal/run-job/` |
| `BEEDERO_API_URL` | GitHub Actions | Base URL for scheduled jobs (e.g. `https://beedero-api.azurewebsites.net`) |
| `SENTRY_DSN` | API | Backend error monitoring |
| `NEXT_PUBLIC_SENTRY_DSN` | Web | Frontend error monitoring |
| `NEXT_PUBLIC_SITE_URL` | Web | Canonical URL for Open Graph (`https://beedero.com`) |

## Scheduled jobs (GitHub Actions)

Configure repository secrets:

- `BEEDERO_API_URL`
- `MANAGEMENT_SECRET`

Workflows:

- `.github/workflows/scheduled-expire-verifications.yml` — daily 02:00 UTC
- `.github/workflows/scheduled-prune-profile-views.yml` — weekly Sunday 03:00 UTC

Verify in production logs after the first run.

## Database

- `startup.sh` runs `createcachetable` and `migrate` on boot.
- Confirm Azure Postgres automated backups are enabled.
- Perform one documented restore test before public launch.

## Email deliverability

Configure on the sending domain used by Azure Communication Services:

- SPF
- DKIM
- DMARC

Check with: `dig TXT <your-domain>`

## Sentry smoke test

```bash
curl -X POST "$BEEDERO_API_URL/api/internal/run-job/" \
  -H "X-Management-Secret: $MANAGEMENT_SECRET" \
  -H "X-Management-Job: sentry_test"
```

Trigger a frontend test error in production after `NEXT_PUBLIC_SENTRY_DSN` is set.

## CI required checks (GitHub branch protection)

Require these checks on `master` before merge:

- `CI / backend`
- `CI / frontend`

## Legal

Privacy and Terms render from `prepareLegalMarkdown()` with entity details in `frontend/lib/legal-content.ts`. Update company NIF and registered address when the lawyer provides final values.

## Frontend startup (Azure `beedero-web`)

Startup command:

```
node server.js
```

Deploy uses standalone zip with `.next/static` included (see `deploy-frontend.yml`).
