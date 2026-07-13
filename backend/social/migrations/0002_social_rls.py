from django.db import migrations

# Both tables reuse the activity_visibility logic (migration
# orgs.0014_activity_rls) via a subquery on orgs_activity, so a reaction or
# comment inherits its parent activity's visibility for free instead of
# needing its own visibility column.
ENABLE_RLS_SQL = """
ALTER TABLE social_reaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_reaction FORCE ROW LEVEL SECURITY;

CREATE POLICY reaction_visibility ON social_reaction
USING (
    EXISTS (
        SELECT 1 FROM orgs_activity a
        WHERE a.id = social_reaction.activity_id
          AND (
              a.visibility = 'public'
              OR a.org_id IS NULL
              OR EXISTS (
                  SELECT 1 FROM orgs_orgmembership m
                  WHERE m.org_id = a.org_id
                    AND m.user_id = current_setting('beedero.viewer_id', true)::int
              )
          )
    )
);

ALTER TABLE social_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comment FORCE ROW LEVEL SECURITY;

CREATE POLICY comment_visibility ON social_comment
USING (
    EXISTS (
        SELECT 1 FROM orgs_activity a
        WHERE a.id = social_comment.activity_id
          AND (
              a.visibility = 'public'
              OR a.org_id IS NULL
              OR EXISTS (
                  SELECT 1 FROM orgs_orgmembership m
                  WHERE m.org_id = a.org_id
                    AND m.user_id = current_setting('beedero.viewer_id', true)::int
              )
          )
    )
);
"""

DISABLE_RLS_SQL = """
DROP POLICY IF EXISTS comment_visibility ON social_comment;
ALTER TABLE social_comment NO FORCE ROW LEVEL SECURITY;
ALTER TABLE social_comment DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reaction_visibility ON social_reaction;
ALTER TABLE social_reaction NO FORCE ROW LEVEL SECURITY;
ALTER TABLE social_reaction DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("social", "0001_create_reaction_comment"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RLS_SQL, reverse_sql=DISABLE_RLS_SQL),
    ]
