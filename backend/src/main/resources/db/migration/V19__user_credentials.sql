-- Users created by the owner get a temporary password and must choose their own before using the
-- app (ADR-0044). credentials_changed_at ends every session opened before a password change.
ALTER TABLE app_user ADD COLUMN password_change_required boolean NOT NULL DEFAULT false;
ALTER TABLE app_user ADD COLUMN credentials_changed_at timestamptz;
