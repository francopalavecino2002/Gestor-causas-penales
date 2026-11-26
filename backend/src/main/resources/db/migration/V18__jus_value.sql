-- Value of the JUS (fees calculator, ADR-0040). Each firm copies it from the official source with the
-- date it applies from; the system never looks it up. The table is append-only: a correction is a new
-- value, a wrong entry is archived (archived_at), nothing is deleted. Who entered what and when also
-- lives in the audit log; created_by stays because the archive rule needs it.

CREATE TABLE jus_value (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid          NOT NULL REFERENCES tenant (id),
    value       numeric(14,2) NOT NULL,
    valid_from  date          NOT NULL,
    created_by  uuid          NOT NULL REFERENCES app_user (id),
    created_at  timestamptz   NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT jus_value_positive_ck CHECK (value > 0)
);

-- One active value per firm and day: a correction for the same day archives the wrong one first.
CREATE UNIQUE INDEX jus_value_active_day_ux ON jus_value (tenant_id, valid_from) WHERE archived_at IS NULL;

-- The calculator reads the latest value of a firm on or before a day.
CREATE INDEX jus_value_firm_ix ON jus_value (tenant_id, valid_from DESC);
