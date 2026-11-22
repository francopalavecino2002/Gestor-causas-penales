package ar.gestorpenal.casefile;

import java.time.Instant;
import java.util.UUID;

/** A case as shown in lists and as the head of the detail, with its computed summary. */
record CaseView(
        UUID id,
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

    static CaseView of(CaseFile caseFile, String circumscriptionName, CaseSummary summary) {
        return new CaseView(
                caseFile.getId(),
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
