from django.db import migrations

# Re-creates field_visibility with the archived_at guard that 0006 always
# intended to ship with. Production ended up with an older, drifted
# definition of this policy applied outside of django_migrations' bookkeeping
# (a mid-deploy container timeout left the DDL applied but unrecorded, later
# reconciled with `migrate orgs 0006 --fake`) — this migration is what
# actually converges it, rather than editing 0006's SQL after the fact.
FIX_SQL = """
DROP POLICY IF EXISTS field_visibility ON orgs_orgfield;

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
            -- archived sections (closed round) never grant access here,
            -- matching layer 2 (VisibilityResolver filters
            -- section__archived_at__isnull=True).
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

REVERT_SQL = """
DROP POLICY IF EXISTS field_visibility ON orgs_orgfield;

CREATE POLICY field_visibility ON orgs_orgfield
USING (
    visibility = 'public'
    OR EXISTS (
        SELECT 1
        FROM orgs_orgsection s
        JOIN orgs_orgmembership m ON m.org_id = s.org_id
        WHERE s.id = orgs_orgfield.section_id
          AND m.user_id = current_setting('beedero.viewer_id', true)::int
    )
    OR (
        visibility = 'restricted' AND EXISTS (
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


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0006_enable_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(FIX_SQL, reverse_sql=REVERT_SQL),
    ]
