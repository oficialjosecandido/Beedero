from django.db import migrations

# Staff bypass for the FORCE-RLS tables in this app.
#
# /admin/ is session-authenticated, so orgs.middleware._viewer_id() finds no
# Firebase JWT and sets beedero.viewer_id = 0. No row has id 0, so every policy
# here is false and the tables read as empty to staff. Browsing survives that;
# deleting does not. Django emulates cascade in Python -- it issues
# `DELETE FROM connections_connection WHERE user_one_id IN (...)`, a normal
# statement subject to these policies -- so the child delete removes nothing,
# and `DELETE FROM accounts_user` then violates the foreign key at COMMIT
# (Django creates FKs DEFERRABLE INITIALLY DEFERRED on Postgres). The admin
# shows a bare 500 with no statement to blame. That is what this fixes.
#
# Permissive policies are OR'd, so this only adds staff access. It changes
# nothing for anyone else: current_setting(..., true) is NULL when the GUC is
# unset -- management commands, tests, the _RLS_EXEMPT_PATH_PREFIXES routes --
# and `NULL = '1'` is NULL, which RLS treats as false.
#
# connections_orgconnectionrequest is deliberately absent: migration
# 0003_delete_orgconnectionrequest dropped that table.

ENABLE_SQL = """
CREATE POLICY staff_bypass ON connections_connection FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON connections_connectionrequest FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');
"""

DISABLE_SQL = """
DROP POLICY IF EXISTS staff_bypass ON connections_connectionrequest;
DROP POLICY IF EXISTS staff_bypass ON connections_connection;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("connections", "0003_delete_orgconnectionrequest"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SQL, DISABLE_SQL),
    ]
