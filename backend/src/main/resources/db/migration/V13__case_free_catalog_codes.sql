-- Non-criminal cases (ADR-0032, T42). The action type and the represented side of a case stop being
-- closed Java enums and become codes of the case's practice area catalogs, and an area without
-- defendants keeps the stage, status and outcome on the case itself.

-- 1. Action type and represented side: free catalog codes (lowercase words separated by hyphens).
--    The criminal catalogs mirror the old enum names, so existing values are rewritten, not lost:
--    PUBLIC_ON_COMPLAINT -> public-on-complaint, DEFENCE -> defence, PRIVATE_PROSECUTION -> private-prosecution.
ALTER TABLE case_file DROP CONSTRAINT case_file_action_type_ck;
ALTER TABLE case_file DROP CONSTRAINT case_file_represents_ck;
ALTER TABLE case_file ALTER COLUMN action_type TYPE varchar(60);
ALTER TABLE case_file ALTER COLUMN represents TYPE varchar(60);
UPDATE case_file
   SET action_type = lower(replace(action_type, '_', '-')),
       represents  = lower(replace(represents, '_', '-'));
ALTER TABLE case_file
    ADD CONSTRAINT case_file_action_type_ck CHECK (action_type ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    ADD CONSTRAINT case_file_represents_ck CHECK (represents ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- 2. The case's own course. Null in an area with the defendants module (each defendant has theirs); the
--    service decides by area. Existing cases are criminal, so they stay null. The rules are the ones of
--    a defendant: a closed case is in the stage 'cerrada' and has an outcome, and only a closed one has it.
ALTER TABLE case_file
    ADD COLUMN stage_code            varchar(60),
    ADD COLUMN status                varchar(20),
    ADD COLUMN closing_outcome_code  varchar(60),
    ADD CONSTRAINT case_file_status_ck CHECK (status IS NULL OR status IN ('ACTIVE', 'SUSPENDED', 'IN_MEDIATION', 'CLOSED')),
    ADD CONSTRAINT case_file_course_ck CHECK (
        (stage_code IS NULL AND status IS NULL AND closing_outcome_code IS NULL)
        OR (stage_code IS NOT NULL AND status IS NOT NULL
            AND (status = 'CLOSED') = (stage_code = 'cerrada')
            AND (status = 'CLOSED') = (closing_outcome_code IS NOT NULL)));
