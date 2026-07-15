from django.db import migrations

VIEWER_ID = "NULLIF(current_setting('beedero.viewer_id', true), '')::int"

ACTIVITY_VISIBLE = f"""
    EXISTS (
        SELECT 1 FROM orgs_activity a
        WHERE a.id = {{table}}.activity_id
          AND (
              a.visibility = 'public'
              OR a.org_id IS NULL
              OR EXISTS (
                  SELECT 1 FROM orgs_orgmembership m
                  WHERE m.org_id = a.org_id
                    AND m.user_id = {VIEWER_ID}
              )
          )
    )
"""

FIX_REACTION_POLICY_SQL = f"""
DROP POLICY IF EXISTS reaction_visibility ON social_reaction;

CREATE POLICY reaction_access ON social_reaction
FOR ALL
USING ({ACTIVITY_VISIBLE.format(table="social_reaction")})
WITH CHECK (
    social_reaction.user_id = {VIEWER_ID}
    AND {ACTIVITY_VISIBLE.format(table="social_reaction")}
);
"""

FIX_COMMENT_POLICY_SQL = f"""
DROP POLICY IF EXISTS comment_visibility ON social_comment;

CREATE POLICY comment_access ON social_comment
FOR ALL
USING ({ACTIVITY_VISIBLE.format(table="social_comment")})
WITH CHECK (
    social_comment.author_id = {VIEWER_ID}
    AND {ACTIVITY_VISIBLE.format(table="social_comment")}
);
"""

REVERT_REACTION_POLICY_SQL = """
DROP POLICY IF EXISTS reaction_access ON social_reaction;

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
"""

REVERT_COMMENT_POLICY_SQL = """
DROP POLICY IF EXISTS comment_access ON social_comment;

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


class Migration(migrations.Migration):
    dependencies = [
        ("social", "0002_social_rls"),
    ]

    operations = [
        migrations.RunSQL(FIX_REACTION_POLICY_SQL, reverse_sql=REVERT_REACTION_POLICY_SQL),
        migrations.RunSQL(FIX_COMMENT_POLICY_SQL, reverse_sql=REVERT_COMMENT_POLICY_SQL),
    ]
