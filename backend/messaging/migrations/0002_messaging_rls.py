from django.db import migrations

# A conversation/message is visible only to its two participants — no
# public/org-membership branch like orgs_activity, since a DM has no
# audience beyond the two people in it.
ENABLE_RLS_SQL = """
ALTER TABLE messaging_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_conversation FORCE ROW LEVEL SECURITY;

CREATE POLICY conversation_participants ON messaging_conversation
USING (
    participant_one_id = current_setting('beedero.viewer_id', true)::int
    OR participant_two_id = current_setting('beedero.viewer_id', true)::int
);

ALTER TABLE messaging_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_message FORCE ROW LEVEL SECURITY;

CREATE POLICY message_participants ON messaging_message
USING (
    EXISTS (
        SELECT 1 FROM messaging_conversation c
        WHERE c.id = messaging_message.conversation_id
          AND (
              c.participant_one_id = current_setting('beedero.viewer_id', true)::int
              OR c.participant_two_id = current_setting('beedero.viewer_id', true)::int
          )
    )
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS message_participants ON messaging_message;
ALTER TABLE messaging_message NO FORCE ROW LEVEL SECURITY;
ALTER TABLE messaging_message DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_participants ON messaging_conversation;
ALTER TABLE messaging_conversation NO FORCE ROW LEVEL SECURITY;
ALTER TABLE messaging_conversation DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
