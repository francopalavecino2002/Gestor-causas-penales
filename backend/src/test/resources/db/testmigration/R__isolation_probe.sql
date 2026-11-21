-- Test-only table behind IsolationProbe. Repeatable so it always runs after the versioned
-- migrations and never collides with their version numbers.
CREATE TABLE IF NOT EXISTS isolation_probe (
    id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid         NOT NULL REFERENCES tenant (id),
    label     varchar(100) NOT NULL
);
