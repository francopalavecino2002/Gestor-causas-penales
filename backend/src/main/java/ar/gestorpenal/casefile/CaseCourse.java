package ar.gestorpenal.casefile;

/**
 * Stage, status and closing outcome of a case in an area without the {@code defendants} module
 * (ADR-0032); in a criminal case each defendant has its own. The rules are those of a defendant: a
 * closed case is in the stage {@code cerrada} and has an outcome, and only a closed case does.
 */
record CaseCourse(String stageCode, CaseStatus status, String closingOutcomeCode) {

    static final String CLOSED_STAGE = Defendant.CLOSED_STAGE;

    CaseCourse {
        boolean closed = status == CaseStatus.CLOSED;
        if (closed != CLOSED_STAGE.equals(stageCode)) {
            throw new InvalidCaseDataException("A closed case is in the stage '" + CLOSED_STAGE + "', and only a closed case is");
        }
        if (closed != (closingOutcomeCode != null)) {
            throw new InvalidCaseDataException("A closed case needs a closing outcome, and only a closed one has it");
        }
    }

    /** A new case: the first stage of the area's catalog, active, when the data names none. */
    static CaseCourse initial(CaseData data, String firstStage) {
        String stage = Text.clean(data.stageCode());
        return new CaseCourse(
                stage == null ? firstStage : stage,
                data.status() == null ? CaseStatus.ACTIVE : data.status(),
                Text.clean(data.closingOutcomeCode()));
    }

    /** An update replaces the course, so it must say where the case stands. */
    static CaseCourse replacing(CaseData data) {
        String stage = Text.clean(data.stageCode());
        if (stage == null || data.status() == null) {
            throw new InvalidCaseDataException("Updating a case of this practice area needs its stage and status");
        }
        return new CaseCourse(stage, data.status(), Text.clean(data.closingOutcomeCode()));
    }
}
