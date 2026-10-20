from django.db import migrations

# Staff bypass for the FORCE-RLS tables in this app. See
# connections/migrations/0004_staff_rls_bypass.py for why this is needed:
# /admin/ runs with beedero.viewer_id = 0, every policy below is false, and a
# user delete fails the foreign key at COMMIT as a bare 500.
#
# social_reaction and social_comment inherit their visibility from the parent
# orgs_activity row, so with viewer_id = 0 they are readable only where that
# activity is public or org-less. A test user's reaction inside a private org
# is invisible and undeletable without this.

ENABLE_SQL = """
CREATE POLICY staff_bypass ON social_reaction FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON social_comment FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON social_eventparticipation FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');
"""

DISABLE_SQL = """
DROP POLICY IF EXISTS staff_bypass ON social_eventparticipation;
DROP POLICY IF EXISTS staff_bypass ON social_comment;
DROP POLICY IF EXISTS staff_bypass ON social_reaction;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("social", "0006_linkpreview_mention"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SQL, DISABLE_SQL),
    ]
