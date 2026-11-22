-- Cases (legajos), their team, parties, defendants and charges (ADR-0015). Nothing is deleted: rows
-- are archived (archived_at). Every table is tenant-scoped.
-- The state of a case lives on each DEFENDANT (stage, status, outcome, rebellion...), never on the
-- case: in the accusatory procedure each defendant has their own course (arts. 52, 107, 108, 133).

-- The case file. Criminal-record data ("antecedentes") is not stored: Ley 25.326, art. 7.
CREATE TABLE case_file (
    id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid         NOT NULL REFERENCES tenant (id),
    -- Carátula.
    caption               varchar(300) NOT NULL,
    -- The firm's own number for the file.
    internal_number       varchar(40),
    -- Legajo of the Ministerio Público Fiscal: MPF + seat letters + number/year, one space after the
    -- seat, e.g. 'MPFNQ 123989/2018'. The list of seats is not validated [validar].
    mpf_legajo            varchar(40),
    -- OFIJU and Pehuén numbers are free text: their formats are not confirmed [validar].
    ofiju_number          varchar(40),
    pehuen_number         varchar(40),
    -- Item of the circumscriptions catalog; validated by the service, not by the database (ADR-0013).
    circumscription_code  varchar(60)  NOT NULL,
    -- Ejercicio de la acción: PUBLIC (art. 99), PUBLIC_ON_COMPLAINT (art. 100), PRIVATE (art. 101).
    action_type           varchar(30)  NOT NULL,
    -- Who the firm represents: the defence, or the private prosecution (querella).
    represents            varchar(20)  NOT NULL,
    -- A reserved case is visible only to its team and the owner.
    reserved              boolean      NOT NULL DEFAULT false,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    archived_at           timestamptz,
    CONSTRAINT case_file_caption_ck CHECK (btrim(caption) <> ''),
    CONSTRAINT case_file_mpf_legajo_ck CHECK (mpf_legajo IS NULL OR mpf_legajo ~ '^MPF[A-Z]{2,4} [0-9]{1,7}/[0-9]{4}$'),
    CONSTRAINT case_file_action_type_ck CHECK (action_type IN ('PUBLIC', 'PUBLIC_ON_COMPLAINT', 'PRIVATE')),
    CONSTRAINT case_file_represents_ck CHECK (represents IN ('DEFENCE', 'PRIVATE_PROSECUTION'))
);

CREATE UNIQUE INDEX case_file_internal_number_uk
    ON case_file (tenant_id, internal_number) WHERE internal_number IS NOT NULL;
CREATE UNIQUE INDEX case_file_mpf_legajo_uk
    ON case_file (tenant_id, mpf_legajo) WHERE mpf_legajo IS NOT NULL;

-- Who works on a case. Exactly one active RESPONSIBLE per case (the service enforces at least one).
-- A changed role archives the row and adds a new one, so the history stays in the rows.
CREATE TABLE case_team_member (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenant (id),
    case_id     uuid        NOT NULL REFERENCES case_file (id),
    user_id     uuid        NOT NULL REFERENCES app_user (id),
    team_role   varchar(20) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT case_team_member_role_ck CHECK (team_role IN ('RESPONSIBLE', 'COLLABORATOR', 'PARALEGAL'))
);

CREATE UNIQUE INDEX case_team_member_user_uk
    ON case_team_member (tenant_id, case_id, user_id) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX case_team_member_responsible_uk
    ON case_team_member (tenant_id, case_id) WHERE team_role = 'RESPONSIBLE' AND archived_at IS NULL;
-- Visibility of reserved cases looks a user up across cases.
CREATE INDEX case_team_member_user_idx ON case_team_member (tenant_id, user_id);

-- A person with a role in the case (victim, witness, expert...). The imputado is NOT a party: defendants
-- have their own table, because each one carries their own state.
CREATE TABLE case_party (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL REFERENCES tenant (id),
    case_id     uuid        NOT NULL REFERENCES case_file (id),
    person_id   uuid        NOT NULL REFERENCES person (id),
    -- Item of the party-roles catalog.
    role_code   varchar(60) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT case_party_role_ck CHECK (role_code <> 'imputado')
);

CREATE UNIQUE INDEX case_party_uk
    ON case_party (tenant_id, case_id, person_id, role_code) WHERE archived_at IS NULL;
CREATE INDEX case_party_case_idx ON case_party (tenant_id, case_id);
CREATE INDEX case_party_person_idx ON case_party (tenant_id, person_id);

-- A person accused in the case, with their own stage and outcome.
CREATE TABLE defendant (
    id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid         NOT NULL REFERENCES tenant (id),
    case_id                 uuid         NOT NULL REFERENCES case_file (id),
    person_id               uuid         NOT NULL REFERENCES person (id),
    -- Items of the stages and closing-outcomes catalogs.
    stage_code              varchar(60)  NOT NULL,
    status                  varchar(20)  NOT NULL,
    closing_outcome_code    varchar(60),
    -- Formulación de cargos (art. 133).
    charges_formulated_on   date,
    -- Whether this firm defends this defendant, and who defends them otherwise.
    defended_by_firm        boolean      NOT NULL DEFAULT true,
    defence_counsel_kind    varchar(10),
    defence_counsel_name    varchar(200),
    -- Rebeldía (art. 52): suspends the term only for this defendant. A later task may move it to a
    -- periods table for repeated rebellions; the audit log keeps the history meanwhile.
    rebellion_declared_on   date,
    rebellion_lifted_on     date,
    -- Pertenencia a pueblo indígena (art. 109, Convenio 169 OIT) [validar]. Ethnic origin is sensitive
    -- data (Ley 25.326, art. 2): null means "not informed", and the audit log redacts it.
    indigenous_people       boolean,
    created_at              timestamptz  NOT NULL DEFAULT now(),
    archived_at             timestamptz,
    CONSTRAINT defendant_status_ck CHECK (status IN ('ACTIVE', 'SUSPENDED', 'IN_MEDIATION', 'CLOSED')),
    CONSTRAINT defendant_closed_stage_ck CHECK ((status = 'CLOSED') = (stage_code = 'cerrada')),
    CONSTRAINT defendant_closed_outcome_ck CHECK ((status = 'CLOSED') = (closing_outcome_code IS NOT NULL)),
    CONSTRAINT defendant_counsel_kind_ck CHECK (defence_counsel_kind IS NULL OR defence_counsel_kind IN ('PRIVATE', 'PUBLIC')),
    CONSTRAINT defendant_firm_counsel_ck CHECK (
        NOT defended_by_firm OR defence_counsel_kind IS NULL OR defence_counsel_kind = 'PRIVATE'),
    CONSTRAINT defendant_rebellion_ck CHECK (
        rebellion_lifted_on IS NULL
        OR (rebellion_declared_on IS NOT NULL AND rebellion_lifted_on >= rebellion_declared_on))
);

CREATE UNIQUE INDEX defendant_person_uk
    ON defendant (tenant_id, case_id, person_id) WHERE archived_at IS NULL;
CREATE INDEX defendant_case_idx ON defendant (tenant_id, case_id);
CREATE INDEX defendant_person_idx ON defendant (tenant_id, person_id);

-- What the defendant is charged with. Kept simple on purpose: the offence and its legal reference.
CREATE TABLE defendant_charge (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid         NOT NULL REFERENCES tenant (id),
    defendant_id    uuid         NOT NULL REFERENCES defendant (id),
    -- E.g. 'Robo agravado'.
    offence         varchar(200) NOT NULL,
    -- E.g. 'CP art. 166 inc. 2'.
    legal_reference varchar(100),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    archived_at     timestamptz,
    CONSTRAINT defendant_charge_offence_ck CHECK (btrim(offence) <> '')
);

CREATE INDEX defendant_charge_defendant_idx ON defendant_charge (tenant_id, defendant_id);
