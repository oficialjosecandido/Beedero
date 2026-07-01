-- Camada 1 (§3.1): Row-Level Security como rede de segurança ao nível da DB.
--
-- NÃO aplicado no MVP porque a base de dados é SQLite (RLS é Postgres-only).
-- Aplicar depois de migrar DATABASES.default.ENGINE para postgresql:
--   psql $DATABASE_URL -f backend/docs/rls_postgres.sql
--
-- Pressupõe que orgs.middleware.RLSViewerMiddleware está ativo (já está,
-- é no-op fora do Postgres) para injetar `beedero.viewer_id` por request via
-- SET LOCAL, e que a app corre com um role de DB não-privilegiado (não o
-- superuser — RLS é ignorado por table owners/superusers por definição).

ALTER TABLE orgs_orgfield ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs_orgfield FORCE ROW LEVEL SECURITY;

CREATE POLICY field_visibility ON orgs_orgfield
USING (
    visibility = 'public'
    OR EXISTS (  -- membro da org vê tudo (inclui private)
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
                    -- grant direto ao campo
                    g.field_id = orgs_orgfield.id
                    -- ou grant à secção inteira (ex: verified_investor ao abrir ronda)
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

-- Nota: secções arquivadas (ronda fechada) já são excluídas pela camada 2
-- (VisibilityResolver filtra section__archived_at__isnull=True). Para
-- reforçar isto também aqui, junta `AND s.archived_at IS NULL` aos EXISTS
-- acima.
