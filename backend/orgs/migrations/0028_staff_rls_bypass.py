from django.db import migrations

# Staff bypass for the FORCE-RLS tables in this app. See
# connections/migrations/0004_staff_rls_bypass.py for why this is needed:
# /admin/ runs with beedero.viewer_id = 0, every policy below is false, and a
# user delete fails the foreign key at COMMIT as a bare 500.
#
# orgs_activity is the one that also gates social_reaction and social_comment
# through a subquery, so staff reading those depends on this policy too.

ENABLE_SQL = """
CREATE POLICY staff_bypass ON orgs_activity FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON orgs_orgfield FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');
"""

DISABLE_SQL = """
DROP POLICY IF EXISTS staff_bypass ON orgs_orgfield;
DROP POLICY IF EXISTS staff_bypass ON orgs_activity;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("orgs", "0027_experience_description"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SQL, DISABLE_SQL),
    ]
