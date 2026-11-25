-- Firm news wall (ADR-0038): short manual posts. The rest of the wall is read from the audit log.
-- Nothing is deleted: a post is archived (archived_at). Who wrote it and when also lives in the
-- audit log; author_user_id stays because the archive rule needs it.

CREATE TABLE firm_post (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid          NOT NULL REFERENCES tenant (id),
    body           varchar(1000) NOT NULL,
    author_user_id uuid          NOT NULL REFERENCES app_user (id),
    created_at     timestamptz   NOT NULL DEFAULT now(),
    archived_at    timestamptz,
    CONSTRAINT firm_post_body_ck CHECK (length(trim(body)) > 0)
);

-- The wall reads the newest entries of a firm about cases, hearings and posts.
CREATE INDEX audit_event_news_ix ON audit_event (tenant_id, id)
    WHERE entity_type IN ('CaseFile', 'Hearing', 'FirmPost') AND action IN ('CREATE', 'UPDATE');
