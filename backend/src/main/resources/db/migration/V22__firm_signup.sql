-- Firm self sign-up (T72, ADR-0050). A firm that signs up by itself gets a free trial; firms created
-- any other way (first-firm bootstrap, demo) have none.
ALTER TABLE tenant ADD COLUMN trial_ends_at timestamptz;

-- The owner of a signed-up firm cannot log in until they open the link sent to their email. Every
-- existing user was created by an operator or an owner, so none is pending.
ALTER TABLE app_user ADD COLUMN email_verification_pending boolean NOT NULL DEFAULT false;

-- One row per verification link sent: only the SHA-256 of the secret is kept. A link is used once,
-- revoked when a newer one is sent, and expires on its own. Rows are never deleted.
CREATE TABLE email_verification_token (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid        NOT NULL REFERENCES tenant (id),
    user_id    uuid        NOT NULL REFERENCES app_user (id),
    token_hash varchar(64) NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    revoked_at timestamptz,
    CONSTRAINT email_verification_token_expiry_ck CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX email_verification_token_hash_uk ON email_verification_token (token_hash);

CREATE INDEX email_verification_token_open_user_ix ON email_verification_token (user_id)
    WHERE used_at IS NULL AND revoked_at IS NULL;
