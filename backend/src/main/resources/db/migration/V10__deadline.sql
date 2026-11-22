-- Deadlines (plazos) computed by the built-in rules of the jurisdiction package (ADR-0017). Rules
-- live in YAML, not here: rows store the rule code and the dates the lawyer loaded, and the due date
-- is computed on read. Nothing is deleted: rows are archived (archived_at). Every table is
-- tenant-scoped.

-- A firm's changes to a built-in rule: it can only disable it or change its warning.
CREATE TABLE deadline_rule_setting (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid        NOT NULL REFERENCES tenant (id),
    rule_code         varchar(60) NOT NULL,
    enabled           boolean     NOT NULL,
    alert_days_before integer     NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT deadline_rule_setting_alert_ck CHECK (alert_days_before BETWEEN 0 AND 90)
);

CREATE UNIQUE INDEX deadline_rule_setting_uk ON deadline_rule_setting (tenant_id, rule_code);

-- One concrete deadline of a case, for one defendant when the rule's scope is the defendant.
CREATE TABLE deadline (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid         NOT NULL REFERENCES tenant (id),
    case_id      uuid         NOT NULL REFERENCES case_file (id),
    defendant_id uuid         REFERENCES defendant (id),
    -- Code of a rule of the firm's jurisdiction package.
    rule_code    varchar(60)  NOT NULL,
    -- The triggering day in the firm's zone; for a term in hours, the local day of triggered_at.
    triggered_on date         NOT NULL,
    -- The triggering instant; only for terms in hours.
    triggered_at timestamptz,
    -- The date a judge or prosecutor set; only for judicial deadlines.
    set_due_on   date,
    -- The hearing where it started (same case, checked by the service).
    hearing_id   uuid         REFERENCES hearing (id),
    -- Cumplido: the act was done, or the lawyer closed the deadline.
    met_on       date,
    notes        text,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    archived_at  timestamptz,
    CONSTRAINT deadline_set_due_ck CHECK (set_due_on IS NULL OR set_due_on >= triggered_on),
    CONSTRAINT deadline_met_ck CHECK (met_on IS NULL OR met_on >= triggered_on)
);

CREATE INDEX deadline_case_idx ON deadline (tenant_id, case_id);
CREATE INDEX deadline_open_idx ON deadline (tenant_id) WHERE met_on IS NULL AND archived_at IS NULL;

-- Extensions (prórrogas) granted on a deadline, in the rule's unit. Append-only: a mistaken one is
-- archived. Its step (first, second...) is its position among the active ones.
CREATE TABLE deadline_extension (
    id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid         NOT NULL REFERENCES tenant (id),
    deadline_id            uuid         NOT NULL REFERENCES deadline (id),
    amount                 integer      NOT NULL,
    granted_on             date         NOT NULL,
    -- The hearing that granted it (same case, checked by the service).
    granted_by_hearing_id  uuid         REFERENCES hearing (id),
    notes                  text,
    created_at             timestamptz  NOT NULL DEFAULT now(),
    archived_at            timestamptz,
    CONSTRAINT deadline_extension_amount_ck CHECK (amount >= 1)
);

CREATE INDEX deadline_extension_deadline_idx ON deadline_extension (tenant_id, deadline_id);

-- Events that stop the clock of the rules that list them: penal mediation and the federal
-- extraordinary appeal. Rebellion is read from the defendant (art. 52). Without a defendant it
-- applies to every deadline of the case; with one, only to that defendant's deadlines.
CREATE TABLE deadline_suspension (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid         NOT NULL REFERENCES tenant (id),
    case_id      uuid         NOT NULL REFERENCES case_file (id),
    defendant_id uuid         REFERENCES defendant (id),
    kind         varchar(40)  NOT NULL,
    starts_on    date         NOT NULL,
    -- Open (NULL) while the event lasts.
    ends_on      date,
    notes        text,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    archived_at  timestamptz,
    CONSTRAINT deadline_suspension_kind_ck CHECK (kind IN ('MEDIATION', 'FEDERAL_EXTRAORDINARY_APPEAL')),
    CONSTRAINT deadline_suspension_ends_ck CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX deadline_suspension_case_idx ON deadline_suspension (tenant_id, case_id);
