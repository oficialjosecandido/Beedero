from django.db import migrations

ENABLE_RLS_SQL = """
ALTER TABLE social_eventparticipation ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_eventparticipation FORCE ROW LEVEL SECURITY;

CREATE POLICY event_participation_own ON social_eventparticipation
FOR ALL
USING (
    user_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
)
WITH CHECK (
    user_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS event_participation_own ON social_eventparticipation;
ALTER TABLE social_eventparticipation NO FORCE ROW LEVEL SECURITY;
ALTER TABLE social_eventparticipation DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("social", "0004_eventparticipation"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
