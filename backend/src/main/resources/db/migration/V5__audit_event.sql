-- Change history (ADR-0010). One row per audited insert or update of an entity; the field-level
-- differences go in "changes" as [{"field": ..., "oldValue": ..., "newValue": ...}].
-- actor_user_id is NULL for work done without a logged-in user (seed data, jobs).
CREATE TABLE audit_event (
    id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id     uuid         NOT NULL REFERENCES tenant (id),
    occurred_at   timestamptz  NOT NULL,
    actor_user_id uuid         REFERENCES app_user (id),
    entity_type   varchar(100) NOT NULL,
    entity_id     uuid         NOT NULL,
    action        varchar(10)  NOT NULL,
    changes       jsonb        NOT NULL DEFAULT '[]',
    CONSTRAINT audit_event_action_ck CHECK (action IN ('CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE')),
    CONSTRAINT audit_event_changes_array_ck CHECK (jsonb_typeof(changes) = 'array')
);

-- History of one record, and activity of one user, both in insertion order.
CREATE INDEX audit_event_entity_ix ON audit_event (tenant_id, entity_type, entity_id, id);
CREATE INDEX audit_event_actor_ix ON audit_event (tenant_id, actor_user_id, id);

-- The log is append-only: the application role cannot rewrite or erase history.
CREATE FUNCTION audit_event_reject_change() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION 'audit_event is append-only (% rejected)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_event_no_update_or_delete
    BEFORE UPDATE OR DELETE ON audit_event
    FOR EACH ROW EXECUTE FUNCTION audit_event_reject_change();

CREATE TRIGGER audit_event_no_truncate
    BEFORE TRUNCATE ON audit_event
    FOR EACH STATEMENT EXECUTE FUNCTION audit_event_reject_change();
