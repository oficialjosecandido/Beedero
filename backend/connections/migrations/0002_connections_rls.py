from django.db import migrations

# A connection/connection request is visible only to the two people it
# involves — same shape as messaging_conversation. An org connection
# request is visible to the requester or to any member of the org.
ENABLE_RLS_SQL = """
ALTER TABLE connections_connectionrequest ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections_connectionrequest FORCE ROW LEVEL SECURITY;

CREATE POLICY connection_request_participants ON connections_connectionrequest
USING (
    requester_id = current_setting('beedero.viewer_id', true)::int
    OR recipient_id = current_setting('beedero.viewer_id', true)::int
);

ALTER TABLE connections_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections_connection FORCE ROW LEVEL SECURITY;

CREATE POLICY connection_participants ON connections_connection
USING (
    user_one_id = current_setting('beedero.viewer_id', true)::int
    OR user_two_id = current_setting('beedero.viewer_id', true)::int
);

ALTER TABLE connections_orgconnectionrequest ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections_orgconnectionrequest FORCE ROW LEVEL SECURITY;

CREATE POLICY org_connection_request_visibility ON connections_orgconnectionrequest
USING (
    requester_id = current_setting('beedero.viewer_id', true)::int
    OR EXISTS (
        SELECT 1 FROM orgs_orgmembership m
        WHERE m.org_id = connections_orgconnectionrequest.org_id
          AND m.user_id = current_setting('beedero.viewer_id', true)::int
    )
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS org_connection_request_visibility ON connections_orgconnectionrequest;
ALTER TABLE connections_orgconnectionrequest NO FORCE ROW LEVEL SECURITY;
ALTER TABLE connections_orgconnectionrequest DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connection_participants ON connections_connection;
ALTER TABLE connections_connection NO FORCE ROW LEVEL SECURITY;
ALTER TABLE connections_connection DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connection_request_participants ON connections_connectionrequest;
ALTER TABLE connections_connectionrequest NO FORCE ROW LEVEL SECURITY;
ALTER TABLE connections_connectionrequest DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("connections", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
