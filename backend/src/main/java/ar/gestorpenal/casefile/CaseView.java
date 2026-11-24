package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.PracticeModule;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A case as shown in lists and as the head of the detail, with its computed summary.
 *
 * @param modules the optional features of the case's practice area, so the UI shows or hides sections
 */
record CaseView(
        UUID id,
        String practiceArea,
        List<PracticeModule> modules,
        String caption,
        String internalNumber,
        String mpfLegajo,
        String ofijuNumber,
        String pehuenNumber,
        String circumscriptionCode,
        String circumscriptionName,
        ActionType actionType,
        String actionArticle,
        Representation represents,
        boolean reserved,
        boolean archived,
        Instant createdAt,
        CaseSummary summary) {

    static CaseView of(
            CaseFile caseFile, List<PracticeModule> modules, String circumscriptionName, CaseSummary summary) {
        return new CaseView(
                caseFile.getId(),
                caseFile.getPracticeArea(),
                modules,
                caseFile.getCaption(),
                caseFile.getInternalNumber(),
                caseFile.getMpfLegajo(),
                caseFile.getOfijuNumber(),
                caseFile.getPehuenNumber(),
                caseFile.getCircumscriptionCode(),
                circumscriptionName,
                caseFile.getActionType(),
                caseFile.getActionType().article(),
                caseFile.getRepresents(),
                caseFile.isReserved(),
                caseFile.isArchived(),
                caseFile.getCreatedAt(),
                summary);
    }
}
