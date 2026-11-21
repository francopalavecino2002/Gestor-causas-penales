-- Per-firm changes to the catalogs of its jurisdiction package (ADR-0013). Built-in items live in
-- versioned YAML under resources/jurisdictions/<code>/ and are never copied here. A row either
-- renames or hides a built-in item (custom = false), or is an item the firm added (custom = true).
-- Rows are never deleted: hiding replaces removal, and a rename is undone by clearing the name.
CREATE TABLE catalog_item_customization (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid         NOT NULL REFERENCES tenant (id),
    catalog    varchar(40)  NOT NULL,
    item_code  varchar(80)  NOT NULL,
    custom     boolean      NOT NULL,
    name       varchar(200),
    article    varchar(120),
    hidden     boolean      NOT NULL DEFAULT false,
    created_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT catalog_item_customization_uk UNIQUE (tenant_id, catalog, item_code),
    -- Codes of firm items are generated with this prefix, which packages may not use.
    CONSTRAINT catalog_item_customization_custom_code_ck CHECK (custom = (item_code LIKE 'custom-%')),
    CONSTRAINT catalog_item_customization_name_not_blank_ck CHECK (name IS NULL OR btrim(name) <> ''),
    CONSTRAINT catalog_item_customization_custom_name_ck CHECK (NOT custom OR name IS NOT NULL),
    -- The legal source of a built-in item comes from the package and cannot be overridden.
    CONSTRAINT catalog_item_customization_article_ck CHECK (
        (custom OR article IS NULL) AND (article IS NULL OR btrim(article) <> ''))
);
