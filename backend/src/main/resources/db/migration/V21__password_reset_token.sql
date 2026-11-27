-- Password recovery by email (T71, ADR-0049). One row per link sent: only the SHA-256 of the secret
-- is kept. A link is used once, revoked when a newer one is requested, and expires on its own.
-- Rows are never deleted (nothing is deleted: it is archived).

CREATE TABLE password_reset_token (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid        NOT NULL REFERENCES tenant (id),
    user_id    uuid        NOT NULL REFERENCES app_user (id),
    token_hash varchar(64) NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    revoked_at timestamptz,
    CONSTRAINT password_reset_token_expiry_ck CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX password_reset_token_hash_uk ON password_reset_token (token_hash);

-- The open links of a user, revoked when a new one is issued or the password is reset.
CREATE INDEX password_reset_token_open_user_ix ON password_reset_token (user_id)
    WHERE used_at IS NULL AND revoked_at IS NULL;
