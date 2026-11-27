-- Outbound email (T70, ADR-0048). One row per email the system tried to send: which template, to
-- whom, the subject and how it went. The body is never stored: it can carry one-time links.

CREATE TABLE mail_delivery (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid         NOT NULL REFERENCES tenant (id),
    template     varchar(60)  NOT NULL,
    recipient    varchar(320) NOT NULL,
    subject      varchar(200) NOT NULL,
    outcome      varchar(20)  NOT NULL,
    attempted_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT mail_delivery_outcome_ck CHECK (outcome IN ('SENT', 'LOGGED', 'FAILED'))
);

CREATE INDEX mail_delivery_tenant_attempted_at_ix ON mail_delivery (tenant_id, attempted_at DESC);
