-- Test-only table behind AuditProbe, an audited entity with one field of each audit policy.
CREATE TABLE IF NOT EXISTS audit_probe (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid         NOT NULL REFERENCES tenant (id),
    label       varchar(100) NOT NULL,
    secret      varchar(100),
    counter     integer      NOT NULL DEFAULT 0,
    owner_id    uuid         REFERENCES app_user (id),
    archived_at timestamptz
);
