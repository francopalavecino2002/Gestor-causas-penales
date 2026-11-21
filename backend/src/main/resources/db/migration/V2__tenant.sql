-- A tenant is one law firm (estudio). Every other business table carries a NOT NULL tenant_id
-- referencing this table (ADR-0007). Tenants are never deleted, only archived.
CREATE TABLE tenant (
    id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name              varchar(200) NOT NULL,
    slug              varchar(63)  NOT NULL,
    jurisdiction_code varchar(40)  NOT NULL DEFAULT 'neuquen',
    created_at        timestamptz  NOT NULL DEFAULT now(),
    archived_at       timestamptz,
    CONSTRAINT tenant_slug_uk UNIQUE (slug),
    CONSTRAINT tenant_slug_format_ck CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT tenant_name_not_blank_ck CHECK (btrim(name) <> ''),
    -- The nil UUID is the application's "no tenant resolved" sentinel; it must never match a row.
    CONSTRAINT tenant_id_not_nil_ck CHECK (id <> '00000000-0000-0000-0000-000000000000')
);
