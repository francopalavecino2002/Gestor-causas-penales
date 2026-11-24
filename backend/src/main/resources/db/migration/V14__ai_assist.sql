-- Optional AI assistance (ADR-0033). It is off for every firm until its owner turns it on, and the
-- texts sent to the provider are never stored: only who used which feature, when and how it went.

-- At most one row per firm; no row means "off". Changes are audited like any other setting.
CREATE TABLE ai_assist_setting (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid        NOT NULL REFERENCES tenant (id),
    enabled    boolean     NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_assist_setting_tenant_uk ON ai_assist_setting (tenant_id);

-- One row per request to the provider. The notification text and the answer are not kept.
CREATE TABLE ai_assist_use (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid        NOT NULL REFERENCES tenant (id),
    user_id   uuid        NOT NULL REFERENCES app_user (id),
    feature   varchar(40) NOT NULL,
    case_id   uuid        REFERENCES case_file (id),
    outcome   varchar(20) NOT NULL,
    used_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_assist_use_feature_ck CHECK (feature IN ('HEARING_FROM_NOTIFICATION')),
    CONSTRAINT ai_assist_use_outcome_ck CHECK (outcome IN ('SUCCEEDED', 'FAILED'))
);

CREATE INDEX ai_assist_use_tenant_used_at_ix ON ai_assist_use (tenant_id, used_at DESC);
