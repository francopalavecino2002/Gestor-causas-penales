-- Baseline migration. Schema objects are added by later migrations.
-- pgcrypto provides digest/encryption functions (gen_random_uuid() is core since PostgreSQL 13).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
