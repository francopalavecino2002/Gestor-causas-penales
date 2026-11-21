-- TOTP second factor (ADR-0009). The secret is stored encrypted (AES-GCM, key outside the database).
-- totp_last_step is the last accepted 30-second step, so a code can be used only once.
ALTER TABLE app_user
    ADD COLUMN totp_secret     varchar(255),
    ADD COLUMN totp_enabled_at timestamptz,
    ADD COLUMN totp_last_step  bigint,
    ADD CONSTRAINT app_user_totp_enabled_has_secret_ck
        CHECK (totp_enabled_at IS NULL OR totp_secret IS NOT NULL);

-- One-time recovery codes. Only a SHA-256 hash is stored: the codes carry 80 random bits, so a fast
-- hash is enough. Codes are never deleted: a used code gets used_at, a replaced set gets archived_at.
CREATE TABLE recovery_code (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenant (id),
    user_id     uuid        NOT NULL REFERENCES app_user (id),
    code_hash   varchar(64) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    used_at     timestamptz,
    archived_at timestamptz,
    -- Also the index for lookups by user.
    CONSTRAINT recovery_code_hash_uk UNIQUE (user_id, code_hash)
);
