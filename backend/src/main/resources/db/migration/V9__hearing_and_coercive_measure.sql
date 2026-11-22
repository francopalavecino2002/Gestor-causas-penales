-- Hearings (audiencias), their defendants and lawyers, the reschedule history and coercive measures
-- (ADR-0016). Nothing is deleted: rows are archived (archived_at). Every table is tenant-scoped.
-- Item codes (hearing type, status, cancellation reason, measure, risk) are text validated by the
-- service against the firm's catalogs (ADR-0013). The hearing STATUS codes are the exception in the
-- checks below: that catalog is rename-only and behavior hangs on its codes, so they are stable.

CREATE TABLE hearing (
    id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                uuid         NOT NULL REFERENCES tenant (id),
    case_id                  uuid         NOT NULL REFERENCES case_file (id),
    -- Item of the hearing-types catalog.
    type_code                varchar(60)  NOT NULL,
    starts_at                timestamptz  NOT NULL,
    duration_minutes         integer      NOT NULL DEFAULT 60,
    room                     varchar(100),
    judge                    varchar(200),
    -- Reference of the hearing in OFIJU (free text: its format is not confirmed [validar]).
    ofiju_reference          varchar(100),
    requested_by             varchar(30),
    -- Item of the hearing-statuses catalog.
    status_code              varchar(60)  NOT NULL DEFAULT 'programada',
    -- Item of the cancellation-reasons catalog; only for a cancelled or suspended hearing.
    cancellation_reason_code varchar(60),
    -- Type the hearing was actually held as; only for a reconverted hearing.
    held_as_type_code        varchar(60),
    result_summary           text,
    -- The hearing that continues this one (cuarto intermedio) or follows from its result.
    next_hearing_id          uuid         REFERENCES hearing (id),
    notes                    text,
    created_at               timestamptz  NOT NULL DEFAULT now(),
    archived_at              timestamptz,
    CONSTRAINT hearing_duration_ck CHECK (duration_minutes BETWEEN 5 AND 1440),
    CONSTRAINT hearing_requested_by_ck CHECK (
        requested_by IS NULL
        OR requested_by IN ('DEFENCE', 'PROSECUTION', 'PRIVATE_PROSECUTION', 'COURT', 'OTHER')),
    CONSTRAINT hearing_cancellation_reason_ck CHECK (
        cancellation_reason_code IS NULL OR status_code IN ('cancelada', 'suspendida')),
    CONSTRAINT hearing_held_as_ck CHECK ((held_as_type_code IS NOT NULL) = (status_code = 'reconvertida')),
    CONSTRAINT hearing_result_ck CHECK (
        (result_summary IS NULL AND next_hearing_id IS NULL)
        OR status_code IN ('efectiva', 'reconvertida', 'cuarto-intermedio')),
    CONSTRAINT hearing_next_not_self_ck CHECK (next_hearing_id IS NULL OR next_hearing_id <> id)
);

CREATE INDEX hearing_case_idx ON hearing (tenant_id, case_id);
-- The agenda reads a range of days.
CREATE INDEX hearing_starts_at_idx ON hearing (tenant_id, starts_at);

-- The defendants a hearing is about; they belong to the hearing's case (checked by the service).
-- The list is replaced as a whole: removed rows are archived, so the history stays in the table.
CREATE TABLE hearing_defendant (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid        NOT NULL REFERENCES tenant (id),
    hearing_id   uuid        NOT NULL REFERENCES hearing (id),
    defendant_id uuid        NOT NULL REFERENCES defendant (id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    archived_at  timestamptz
);

CREATE UNIQUE INDEX hearing_defendant_uk
    ON hearing_defendant (tenant_id, hearing_id, defendant_id) WHERE archived_at IS NULL;
CREATE INDEX hearing_defendant_defendant_idx ON hearing_defendant (tenant_id, defendant_id);

-- The firm's lawyers who attend. Clashes (overlapping hearings) are detected per lawyer.
CREATE TABLE hearing_lawyer (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenant (id),
    hearing_id  uuid        NOT NULL REFERENCES hearing (id),
    user_id     uuid        NOT NULL REFERENCES app_user (id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);

CREATE UNIQUE INDEX hearing_lawyer_uk
    ON hearing_lawyer (tenant_id, hearing_id, user_id) WHERE archived_at IS NULL;
CREATE INDEX hearing_lawyer_user_idx ON hearing_lawyer (tenant_id, user_id);

-- Append-only history of reschedules: one row per change of date.
CREATE TABLE hearing_reschedule (
    id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid         NOT NULL REFERENCES tenant (id),
    hearing_id         uuid         NOT NULL REFERENCES hearing (id),
    previous_starts_at timestamptz  NOT NULL,
    new_starts_at      timestamptz  NOT NULL,
    reason             varchar(300),
    created_at         timestamptz  NOT NULL DEFAULT now(),
    created_by_user_id uuid         REFERENCES app_user (id),
    CONSTRAINT hearing_reschedule_changed_ck CHECK (new_starts_at <> previous_starts_at)
);

CREATE INDEX hearing_reschedule_hearing_idx ON hearing_reschedule (tenant_id, hearing_id);

-- A coercive measure ordered against a defendant (arts. 113 to 120 of the CPP de Neuquén).
-- Active = not archived and not lifted.
CREATE TABLE coercive_measure (
    id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid         NOT NULL REFERENCES tenant (id),
    defendant_id            uuid         NOT NULL REFERENCES defendant (id),
    -- Item of the coercive-measures catalog.
    measure_code            varchar(60)  NOT NULL,
    -- The measure's own data as free text: who, how often, where, which amount...
    conditions              text,
    -- Only for preventive prison and house arrest.
    detention_place         varchar(200),
    starts_on               date         NOT NULL,
    -- Fixed duration of the measure (art. 116).
    ends_on                 date,
    next_review_on          date,
    -- The hearing that ordered it (a hearing of the same case, checked by the service).
    ordered_by_hearing_id   uuid         REFERENCES hearing (id),
    -- Cese: the day the measure was lifted.
    lifted_on               date,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    archived_at             timestamptz,
    CONSTRAINT coercive_measure_ends_ck CHECK (ends_on IS NULL OR ends_on >= starts_on),
    CONSTRAINT coercive_measure_review_ck CHECK (next_review_on IS NULL OR next_review_on >= starts_on),
    CONSTRAINT coercive_measure_lifted_ck CHECK (lifted_on IS NULL OR lifted_on >= starts_on),
    CONSTRAINT coercive_measure_place_ck CHECK (
        detention_place IS NULL OR measure_code IN ('prision-preventiva', 'detencion-domiciliaria'))
);

CREATE INDEX coercive_measure_defendant_idx ON coercive_measure (tenant_id, defendant_id);

-- Procedural risks (peligro de fuga, entorpecimiento...) that justify a preventive prison; items of
-- the procedural-risks catalog. Replaced as a whole like the hearing's defendants.
CREATE TABLE coercive_measure_risk (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenant (id),
    measure_id  uuid        NOT NULL REFERENCES coercive_measure (id),
    risk_code   varchar(60) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);

CREATE UNIQUE INDEX coercive_measure_risk_uk
    ON coercive_measure_risk (tenant_id, measure_id, risk_code) WHERE archived_at IS NULL;
