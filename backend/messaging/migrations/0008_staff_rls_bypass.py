from django.db import migrations

# Staff bypass for the FORCE-RLS tables in this app. See
# connections/migrations/0004_staff_rls_bypass.py for why this is needed:
# /admin/ runs with beedero.viewer_id = 0, every policy below is false, and a
# user delete fails the foreign key at COMMIT as a bare 500.
#
# messaging_messagereport is absent on purpose -- it has no RLS at all, for
# exactly this reason (see the MessageReport docstring in messaging/models.py).
# messaging_orgconversation and messaging_orgmessage are absent because they
# were never put under RLS.

ENABLE_SQL = """
CREATE POLICY staff_bypass ON messaging_conversation FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON messaging_message FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON messaging_userblock FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');
"""

DISABLE_SQL = """
DROP POLICY IF EXISTS staff_bypass ON messaging_userblock;
DROP POLICY IF EXISTS staff_bypass ON messaging_message;
DROP POLICY IF EXISTS staff_bypass ON messaging_conversation;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0007_alter_messagereport_conversation"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SQL, DISABLE_SQL),
    ]
