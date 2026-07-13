from django.db import migrations

# Mirrors 0006_enable_row_level_security.py's field_visibility policy, but
# simpler: Activity has no VisibilityGrant-based "restricted" branch yet
# (plan §0 — VisibilityGrant is never org-wide today, so a restricted
# Activity falls back to members-only until that mechanism exists).
# Investor-authored activities (org_id IS NULL) are always public — matches
# InvestorPost's current behavior, which has no visibility concept at all.
ENABLE_RLS_SQL = """
ALTER TABLE orgs_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs_activity FORCE ROW LEVEL SECURITY;

CREATE POLICY activity_visibility ON orgs_activity
USING (
    visibility = 'public'
    OR org_id IS NULL
    OR EXISTS (
        SELECT 1 FROM orgs_orgmembership m
        WHERE m.org_id = orgs_activity.org_id
          AND m.user_id = current_setting('beedero.viewer_id', true)::int
    )
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS activity_visibility ON orgs_activity;
ALTER TABLE orgs_activity NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orgs_activity DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0013_backfill_activity"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
