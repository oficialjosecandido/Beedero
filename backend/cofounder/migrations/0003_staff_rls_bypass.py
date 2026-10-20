from django.db import migrations

# Staff bypass for the FORCE-RLS tables in this app. See
# connections/migrations/0004_staff_rls_bypass.py for why this is needed:
# /admin/ runs with beedero.viewer_id = 0, every policy below is false, and a
# user delete fails the foreign key at COMMIT as a bare 500.

ENABLE_SQL = """
CREATE POLICY staff_bypass ON cofounder_builderprofile FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON cofounder_cofounderinterest FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');

CREATE POLICY staff_bypass ON cofounder_cofoundermatch FOR ALL
USING (current_setting('beedero.is_staff', true) = '1')
WITH CHECK (current_setting('beedero.is_staff', true) = '1');
"""

DISABLE_SQL = """
DROP POLICY IF EXISTS staff_bypass ON cofounder_cofoundermatch;
DROP POLICY IF EXISTS staff_bypass ON cofounder_cofounderinterest;
DROP POLICY IF EXISTS staff_bypass ON cofounder_builderprofile;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("cofounder", "0002_cofounder_rls"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SQL, DISABLE_SQL),
    ]
