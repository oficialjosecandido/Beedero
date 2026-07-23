-- Layer 1 (§3.1): Row-Level Security as a DB-level safety net.
--
-- Kept here as documentation only. The actual source of truth is the Django
-- migration orgs/migrations/0006_enable_row_level_security.py — `manage.py
-- migrate` applies this automatically, there's nothing to run by hand.
--
-- Assumes orgs.middleware.RLSViewerMiddleware is active (it already is,
-- it's a no-op outside of Postgres) to inject `beedero.viewer_id` per request via
-- SET LOCAL, and that the app runs with an unprivileged DB role (not the
-- superuser — RLS is ignored by table owners/superusers by definition).
--
-- Creating that role (run once per database, as the owning/superuser role;
-- DDL like `manage.py migrate` still needs to run as the owner — this role
-- only gets DML):
--   CREATE ROLE beedero_app LOGIN PASSWORD '...';
--   GRANT CONNECT ON DATABASE beedero_dev TO beedero_app;
--   GRANT USAGE ON SCHEMA public TO beedero_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beedero_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beedero_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beedero_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO beedero_app;
-- Then point the *running app's* DATABASE_URL at beedero_app; keep using the
-- owner role only for `manage.py migrate`. Verified locally end-to-end
-- (member sees a restricted field, unrelated authenticated user doesn't) —
-- see orgs/tests.py for the equivalent app-level guard tests. Production's
-- App Service needs the same split before this is a real safety net there,
-- not just locally — not done yet, needs a deliberate cutover.

ALTER TABLE orgs_orgfield ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs_orgfield FORCE ROW LEVEL SECURITY;

CREATE POLICY field_visibility ON orgs_orgfield
USING (
    visibility = 'public'
    OR EXISTS (  -- org member sees everything (including private)
        SELECT 1
        FROM orgs_orgsection s
        JOIN orgs_orgmembership m ON m.org_id = s.org_id
        WHERE s.id = orgs_orgfield.section_id
          AND m.user_id = current_setting('beedero.viewer_id', true)::int
    )
    OR (
        visibility = 'restricted' AND EXISTS (
            -- archived sections (closed round) never grant access here,
            -- matching layer 2 (VisibilityResolver filters
            -- section__archived_at__isnull=True).
            SELECT 1
            FROM orgs_orgsection s
            WHERE s.id = orgs_orgfield.section_id
              AND s.archived_at IS NULL
        ) AND EXISTS (
            SELECT 1 FROM orgs_visibilitygrant g
            WHERE (g.expires_at IS NULL OR g.expires_at > now())
              AND (
                    -- direct grant to the field
                    g.field_id = orgs_orgfield.id
                    -- or grant to the whole section (e.g. verified_investor when opening a round)
                    OR g.section_id = orgs_orgfield.section_id
              )
              AND (
                    (g.principal_type = 'user' AND g.principal_id = current_setting('beedero.viewer_id', true))
                 OR (g.principal_type = 'org' AND EXISTS (
                        SELECT 1 FROM orgs_orgmembership m2
                        WHERE m2.user_id = current_setting('beedero.viewer_id', true)::int
                          AND m2.org_id::text = g.principal_id
                    ))
                 OR (g.principal_type = 'role' AND g.principal_id = 'verified_investor' AND EXISTS (
                        SELECT 1 FROM accounts_investorprofile ip
                        WHERE ip.user_id = current_setting('beedero.viewer_id', true)::int
                          AND ip.is_verified = true
                    ))
              )
        )
    )
);

-- Direct messages (source of truth: messaging/migrations/0002_messaging_rls.py).
-- No public/org-membership branch like orgs_orgfield above — a conversation
-- has no audience beyond its two participants.

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

-- Blocks (source of truth: messaging/migrations/0006_user_block_rls.py).
-- Visible to either side of the pair, not just the blocker — services.is_blocked()
-- needs to see the row regardless of which of the two users is the current
-- viewer. messaging_messagereport has no policy: it's only ever read via
-- /admin (session-authenticated, so beedero.viewer_id is always 0 there —
-- see orgs.middleware._viewer_id), never through a viewer-scoped API.

ALTER TABLE messaging_userblock ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_userblock FORCE ROW LEVEL SECURITY;

CREATE POLICY user_block_participants ON messaging_userblock
USING (
    blocker_id = current_setting('beedero.viewer_id', true)::int
    OR blocked_id = current_setting('beedero.viewer_id', true)::int
);
