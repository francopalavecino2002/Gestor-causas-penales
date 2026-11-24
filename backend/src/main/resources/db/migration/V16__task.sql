-- Tasks (tareas): small to-dos of the firm with a due day and a responsible member, optionally tied
-- to a case or to one of its hearings. Nothing is deleted: rows are archived (archived_at). Every
-- table is tenant-scoped. Who changed what and when lives in the audit log; created_by stays because
-- the creator may edit the task.

CREATE TABLE task (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid         NOT NULL REFERENCES tenant (id),
    title               varchar(200) NOT NULL,
    notes               text,
    -- A local day of the firm's zone; open-ended tasks have none.
    due_date            date,
    responsible_user_id uuid         NOT NULL REFERENCES app_user (id),
    -- When the hearing is set, the case is the hearing's case (checked by the service).
    case_id             uuid         REFERENCES case_file (id),
    hearing_id          uuid         REFERENCES hearing (id),
    status              varchar(20)  NOT NULL,
    done_at             timestamptz,
    created_by          uuid         NOT NULL REFERENCES app_user (id),
    created_at          timestamptz  NOT NULL DEFAULT now(),
    archived_at         timestamptz,
    CONSTRAINT task_status_ck CHECK (status IN ('PENDING', 'DONE')),
    CONSTRAINT task_done_at_ck CHECK ((status = 'DONE') = (done_at IS NOT NULL)),
    CONSTRAINT task_hearing_case_ck CHECK (hearing_id IS NULL OR case_id IS NOT NULL)
);

CREATE INDEX task_responsible_idx ON task (tenant_id, responsible_user_id, status);
CREATE INDEX task_case_idx ON task (case_id);
CREATE INDEX task_hearing_idx ON task (hearing_id);
