from django.db import migrations

# Layer 1 (§3.1 / Fase 0 §0.1): Postgres RLS as a safety net under the
# VisibilityResolver (layer 2, `orgs/visibility.py`). Mirrors
# `backend/docs/rls_postgres.sql`, which is kept as documentation only —
# this migration is now the actual source of truth for what's applied.
#
# Only enforced against a non-privileged DB role: RLS is bypassed by table
# owners and superusers by definition, so the app must connect as neither.
# Requires orgs.middleware.RLSViewerMiddleware (already active) to inject
# `beedero.viewer_id` per request via SET LOCAL.
ENABLE_RLS_SQL = """
ALTER TABLE orgs_orgfield ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs_orgfield FORCE ROW LEVEL SECURITY;

CREATE POLICY field_visibility ON orgs_orgfield
USING (
    visibility = 'public'
    OR EXISTS (  -- org member sees everything (including private)
        SELECT 1
        FROM orgs_orgsection s
        JOIN orgs_orgmembership m ON m.org_id = s.org_id
        WHERE s.id = orgs_orgfield.section_id
          AND m.user_id = current_setting('beedero.viewer_id', true)::int
    )
    OR (
        visibility = 'restricted' AND EXISTS (
            SELECT 1
            FROM orgs_orgsection s
            WHERE s.id = orgs_orgfield.section_id
              AND s.archived_at IS NULL
        ) AND EXISTS (
            SELECT 1 FROM orgs_visibilitygrant g
            WHERE (g.expires_at IS NULL OR g.expires_at > now())
              AND (
                    g.field_id = orgs_orgfield.id
                 OR g.section_id = orgs_orgfield.section_id
              )
              AND (
                    (g.principal_type = 'user' AND g.principal_id = current_setting('beedero.viewer_id', true))
                 OR (g.principal_type = 'org' AND EXISTS (
                        SELECT 1 FROM orgs_orgmembership m2
                        WHERE m2.user_id = current_setting('beedero.viewer_id', true)::int
                          AND m2.org_id::text = g.principal_id
                    ))
                 OR (g.principal_type = 'role' AND g.principal_id = 'verified_investor' AND EXISTS (
                        SELECT 1 FROM accounts_investorprofile ip
                        WHERE ip.user_id = current_setting('beedero.viewer_id', true)::int
                          AND ip.is_verified = true
                    ))
              )
        )
    )
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS field_visibility ON orgs_orgfield;
ALTER TABLE orgs_orgfield NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orgs_orgfield DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0005_organization_one_liner_organization_status"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
