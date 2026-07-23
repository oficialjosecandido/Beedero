from django.db import migrations

# Visible to either side of the pair, not just the blocker — services.is_blocked()
# needs to see the row regardless of which of the two users is the current
# viewer (mirrors messaging_conversation's own policy for the same reason).
# messaging_messagereport has no policy: it's only ever read via /admin
# (see MessageReport's docstring), never through a viewer-scoped API.
ENABLE_RLS_SQL = """
ALTER TABLE messaging_userblock ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_userblock FORCE ROW LEVEL SECURITY;

CREATE POLICY user_block_participants ON messaging_userblock
USING (
    blocker_id = current_setting('beedero.viewer_id', true)::int
    OR blocked_id = current_setting('beedero.viewer_id', true)::int
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS user_block_participants ON messaging_userblock;
ALTER TABLE messaging_userblock NO FORCE ROW LEVEL SECURITY;
ALTER TABLE messaging_userblock DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0005_user_block_and_message_report"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
