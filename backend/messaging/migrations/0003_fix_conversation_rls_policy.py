from django.db import migrations

# Explicit WITH CHECK so new conversations can be inserted when the viewer is
# one of the two participants (Postgres RLS + FORCE ROW LEVEL SECURITY).
FIX_CONVERSATION_POLICY_SQL = """
DROP POLICY IF EXISTS conversation_participants ON messaging_conversation;

CREATE POLICY conversation_access ON messaging_conversation
FOR ALL
USING (
    participant_one_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
    OR participant_two_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
)
WITH CHECK (
    participant_one_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
    OR participant_two_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
);
"""

REVERT_CONVERSATION_POLICY_SQL = """
DROP POLICY IF EXISTS conversation_access ON messaging_conversation;

CREATE POLICY conversation_participants ON messaging_conversation
USING (
    participant_one_id = current_setting('beedero.viewer_id', true)::int
    OR participant_two_id = current_setting('beedero.viewer_id', true)::int
);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0002_messaging_rls"),
    ]

    operations = [
        migrations.RunSQL(FIX_CONVERSATION_POLICY_SQL, reverse_sql=REVERT_CONVERSATION_POLICY_SQL),
    ]
