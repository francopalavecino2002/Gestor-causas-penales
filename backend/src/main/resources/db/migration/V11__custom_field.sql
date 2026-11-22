-- Custom fields (ADR-0018). A firm defines extra fields for its cases and defendants; the values live
-- in a jsonb column of the record itself, keyed by the definition's field_key. The service validates
-- the values against the definitions: the database only guarantees the column is a JSON object.
-- Nothing is deleted: a definition is archived (archived_at) and keeps the values already stored.
-- Every table is tenant-scoped.

CREATE TABLE custom_field_definition (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid         NOT NULL REFERENCES tenant (id),
    -- The record the field belongs to.
    entity      varchar(20)  NOT NULL,
    -- Generated from the label when the field is created and never changed, so stored values keep
    -- pointing at it even if the label is renamed. A key is not reused, not even by an archived field.
    field_key   varchar(60)  NOT NULL,
    label       varchar(100) NOT NULL,
    field_type  varchar(20)  NOT NULL,
    -- Only for LIST fields: [{"code": "...", "label": "...", "hidden": false}]. Options are added,
    -- renamed and hidden, never removed, because stored values refer to their code.
    options     jsonb        NOT NULL DEFAULT '[]',
    required    boolean      NOT NULL DEFAULT false,
    position    integer      NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CONSTRAINT custom_field_definition_entity_ck CHECK (entity IN ('CASE_FILE', 'DEFENDANT')),
    CONSTRAINT custom_field_definition_key_ck CHECK (field_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT custom_field_definition_label_ck CHECK (btrim(label) <> ''),
    CONSTRAINT custom_field_definition_type_ck CHECK (field_type IN ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'LIST')),
    CONSTRAINT custom_field_definition_options_ck CHECK (jsonb_typeof(options) = 'array')
);

CREATE UNIQUE INDEX custom_field_definition_key_uk
    ON custom_field_definition (tenant_id, entity, field_key);

-- The values of the firm's custom fields, by field_key.
ALTER TABLE case_file
    ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}',
    ADD CONSTRAINT case_file_custom_fields_ck CHECK (jsonb_typeof(custom_fields) = 'object');

ALTER TABLE defendant
    ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}',
    ADD CONSTRAINT defendant_custom_fields_ck CHECK (jsonb_typeof(custom_fields) = 'object');
