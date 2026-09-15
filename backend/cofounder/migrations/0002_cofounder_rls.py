from django.db import migrations

# Layer 1 for the co-founder module (docs/rls_postgres.sql).
#
# cofounder_builderprofile: an inactive profile is a private draft — only its
# owner can see it, at the database level. The stricter reading of doc §7
# ("visible only to others who are also active") stays at the app layer
# (DeckView refuses to build a deck for someone who hasn't opted in), because
# a policy that hid active rows from non-builders would also hide them from
# services.active_builder_count() — and that count is exactly what the
# density gate asks a *non-builder* to read.
#
# cofounder_cofounderinterest: readable by both sides, writable only by the
# actor. Both directions are needed because the reciprocity check in
# record_interest() looks up the row where the viewer is the *target*; the
# API never exposes it, which is what keeps one-sided interest private
# (same trade-off as messaging_userblock).
#
# cofounder_cofoundermatch: the two people in it, nobody else.
ENABLE_RLS_SQL = """
ALTER TABLE cofounder_builderprofile ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_builderprofile FORCE ROW LEVEL SECURITY;

CREATE POLICY builder_profile_access ON cofounder_builderprofile
FOR ALL
USING (
    is_active
    OR user_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
)
WITH CHECK (
    user_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
);

ALTER TABLE cofounder_cofounderinterest ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_cofounderinterest FORCE ROW LEVEL SECURITY;

CREATE POLICY cofounder_interest_access ON cofounder_cofounderinterest
FOR ALL
USING (
    actor_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
    OR target_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
)
WITH CHECK (
    actor_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
);

ALTER TABLE cofounder_cofoundermatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_cofoundermatch FORCE ROW LEVEL SECURITY;

CREATE POLICY cofounder_match_access ON cofounder_cofoundermatch
FOR ALL
USING (
    user_a_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
    OR user_b_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
)
WITH CHECK (
    user_a_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
    OR user_b_id = NULLIF(current_setting('beedero.viewer_id', true), '')::int
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS cofounder_match_access ON cofounder_cofoundermatch;
ALTER TABLE cofounder_cofoundermatch NO FORCE ROW LEVEL SECURITY;
ALTER TABLE cofounder_cofoundermatch DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cofounder_interest_access ON cofounder_cofounderinterest;
ALTER TABLE cofounder_cofounderinterest NO FORCE ROW LEVEL SECURITY;
ALTER TABLE cofounder_cofounderinterest DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS builder_profile_access ON cofounder_builderprofile;
ALTER TABLE cofounder_builderprofile NO FORCE ROW LEVEL SECURITY;
ALTER TABLE cofounder_builderprofile DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("cofounder", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
