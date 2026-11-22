-- People and the firm's clients (ADR-0014). Nothing is deleted: rows are archived (archived_at).
-- Cases (T12) will link a person to a case with a role from the party-roles catalog.

-- A human or legal person known to the firm: a defendant, victim, witness... The record is one per
-- document number in the firm. The number is stored normalized (uppercase, no spaces, dots or
-- hyphens). No sensitive data on purpose (health, ethnic origin, ...): Ley 25.326, arts. 2 and 7.
CREATE TABLE person (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid         NOT NULL REFERENCES tenant (id),
    kind            varchar(10)  NOT NULL,
    first_names     varchar(120),
    last_names      varchar(120),
    legal_name      varchar(200),
    aliases         varchar(200),
    document_type   varchar(10),
    document_number varchar(30),
    birth_date      date,
    nationality     varchar(60),
    phone           varchar(40),
    email           varchar(200),
    address         varchar(300),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    archived_at     timestamptz,
    CONSTRAINT person_kind_ck CHECK (kind IN ('HUMAN', 'LEGAL')),
    CONSTRAINT person_document_type_ck CHECK (
        document_type IS NULL OR document_type IN ('DNI', 'PASSPORT', 'CUIT', 'CUIL', 'OTHER')),
    CONSTRAINT person_document_pair_ck CHECK ((document_type IS NULL) = (document_number IS NULL)),
    CONSTRAINT person_document_number_ck CHECK (document_number IS NULL OR document_number ~ '^[A-Z0-9]+$'),
    CONSTRAINT person_human_ck CHECK (
        kind <> 'HUMAN'
        OR (last_names IS NOT NULL AND btrim(last_names) <> '' AND legal_name IS NULL)),
    CONSTRAINT person_legal_ck CHECK (
        kind <> 'LEGAL'
        OR (legal_name IS NOT NULL AND btrim(legal_name) <> ''
            AND first_names IS NULL AND last_names IS NULL AND birth_date IS NULL))
);

-- One record per person: the same document cannot be registered twice in a firm.
CREATE UNIQUE INDEX person_document_uk
    ON person (tenant_id, document_type, document_number)
    WHERE document_number IS NOT NULL;

-- Conflict check: lookup by number alone, since a DNI can also appear inside a CUIT or CUIL.
CREATE INDEX person_document_number_idx ON person (tenant_id, document_number);

-- The firm's relationship with a person who hired it (cliente), with the data-processing consent.
CREATE TABLE client (
    id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid         NOT NULL REFERENCES tenant (id),
    person_id            uuid         NOT NULL REFERENCES person (id),
    intake_date          date         NOT NULL,
    referral_source      varchar(200),
    consent_given_on     date,
    consent_scope        varchar(500),
    consent_document_ref varchar(200),
    created_at           timestamptz  NOT NULL DEFAULT now(),
    archived_at          timestamptz,
    CONSTRAINT client_person_uk UNIQUE (tenant_id, person_id),
    CONSTRAINT client_consent_ck CHECK ((consent_given_on IS NULL) = (consent_scope IS NULL))
);

-- Someone the client authorizes the firm to talk to (a relative, for instance), and what the firm
-- may tell them. Plain rows on the client, not persons, so there are no person-to-person relations.
CREATE TABLE authorized_contact (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid         NOT NULL REFERENCES tenant (id),
    client_id        uuid         NOT NULL REFERENCES client (id),
    full_name        varchar(200) NOT NULL,
    relationship     varchar(80),
    phone            varchar(40),
    email            varchar(200),
    may_be_told      varchar(300) NOT NULL,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    archived_at      timestamptz,
    CONSTRAINT authorized_contact_name_ck CHECK (btrim(full_name) <> ''),
    CONSTRAINT authorized_contact_may_be_told_ck CHECK (btrim(may_be_told) <> '')
);

CREATE INDEX authorized_contact_client_idx ON authorized_contact (tenant_id, client_id);
