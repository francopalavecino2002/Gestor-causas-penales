-- A user belongs to exactly one firm (ADR-0008). The same email may exist in different firms;
-- the login form asks for the firm, so lookups never cross tenants.
CREATE TABLE app_user (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid         NOT NULL REFERENCES tenant (id),
    email         varchar(254) NOT NULL,
    display_name  varchar(200) NOT NULL,
    password_hash varchar(255) NOT NULL,
    role          varchar(20)  NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    archived_at   timestamptz,
    CONSTRAINT app_user_tenant_email_uk UNIQUE (tenant_id, email),
    CONSTRAINT app_user_email_lowercase_ck CHECK (email = lower(email)),
    CONSTRAINT app_user_display_name_not_blank_ck CHECK (btrim(display_name) <> ''),
    CONSTRAINT app_user_role_ck CHECK (role IN ('OWNER', 'LAWYER', 'PARALEGAL', 'ADMIN_STAFF'))
);
