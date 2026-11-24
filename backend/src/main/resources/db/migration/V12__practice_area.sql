-- Practice areas (fueros), ADR-0032. A jurisdiction package holds one folder per area; this
-- migration records which area each case belongs to and which areas each firm works in. Everything
-- that exists today is criminal, so existing rows become 'penal'.

-- Areas the firm works in. The codes belong to the jurisdiction package, so no foreign key.
ALTER TABLE tenant
    ADD COLUMN enabled_practice_areas text[] NOT NULL DEFAULT '{penal}',
    ADD CONSTRAINT tenant_enabled_practice_areas_ck CHECK (cardinality(enabled_practice_areas) >= 1);

-- The area of a case never changes (the service enforces it). No default: a case is always created
-- with an explicit area; existing rows are backfilled first.
ALTER TABLE case_file ADD COLUMN practice_area varchar(40) NOT NULL DEFAULT 'penal';
ALTER TABLE case_file ALTER COLUMN practice_area DROP DEFAULT;

-- Catalog customizations of an area catalog belong to that area; those of a catalog shared by the
-- whole jurisdiction (circumscriptions) have no area. Only circumscriptions is jurisdiction-scoped
-- today, so every other existing row is criminal. The catalog column holds the Java enum name.
ALTER TABLE catalog_item_customization ADD COLUMN practice_area varchar(40);
UPDATE catalog_item_customization SET practice_area = 'penal' WHERE catalog <> 'CIRCUMSCRIPTIONS';
ALTER TABLE catalog_item_customization DROP CONSTRAINT catalog_item_customization_uk;
-- NULLS NOT DISTINCT (PostgreSQL 15+): two rows of a shared catalog (null area) still collide.
ALTER TABLE catalog_item_customization
    ADD CONSTRAINT catalog_item_customization_uk
    UNIQUE NULLS NOT DISTINCT (tenant_id, practice_area, catalog, item_code);
