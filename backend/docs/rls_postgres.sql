-- Layer 1 (§3.1): Row-Level Security as a DB-level safety net.
--
-- NOT applied in the MVP because the database is SQLite (RLS is Postgres-only).
-- Apply after migrating DATABASES.default.ENGINE to postgresql:
--   psql $DATABASE_URL -f backend/docs/rls_postgres.sql
--
-- Assumes orgs.middleware.RLSViewerMiddleware is active (it already is,
-- it's a no-op outside of Postgres) to inject `beedero.viewer_id` per request via
-- SET LOCAL, and that the app runs with an unprivileged DB role (not the
-- superuser — RLS is ignored by table owners/superusers by definition).

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

-- Note: archived sections (closed round) are already excluded by layer 2
-- (VisibilityResolver filters section__archived_at__isnull=True). To
-- also enforce this here, add `AND s.archived_at IS NULL` to the EXISTS
-- clauses above.
