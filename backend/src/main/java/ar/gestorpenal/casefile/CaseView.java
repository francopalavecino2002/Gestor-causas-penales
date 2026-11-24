package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.PracticeModule;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A case as shown in lists and as the head of the detail, with its computed summary.
 *
 * @param modules the optional features of the case's practice area, so the UI shows or hides sections
<<<<<<< HEAD
 * @param actionType the code of the area's action-types catalog, e.g. {@code public-on-complaint}
 * @param represents the code of the area's represented-sides catalog, e.g. {@code defence}
=======
 * @param actionType the area's action type code in the wire spelling of {@link CatalogCodes}
 * @param represents the area's represented side code in the wire spelling
>>>>>>> origin/main
 * @param stageCode the case's own stage, status and outcome (with the names of the stage and the
 *     outcome): only for an area without the {@code defendants} module, else all {@code null}
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
        String actionType,
        String actionArticle,
        String represents,
        String stageCode,
        String stageName,
        CaseStatus status,
        String closingOutcomeCode,
        String closingOutcomeName,
        boolean reserved,
        boolean archived,
        Instant createdAt,
        CaseSummary summary) {

    static CaseView of(CaseFile caseFile, CaseVocabulary vocabulary, CaseSummary summary) {
        return new CaseView(
                caseFile.getId(),
                caseFile.getPracticeArea(),
                vocabulary.modules(),
                caseFile.getCaption(),
                caseFile.getInternalNumber(),
                caseFile.getMpfLegajo(),
                caseFile.getOfijuNumber(),
                caseFile.getPehuenNumber(),
                caseFile.getCircumscriptionCode(),
                vocabulary.circumscriptionName(caseFile.getCircumscriptionCode()),
<<<<<<< HEAD
                caseFile.getActionType(),
                vocabulary.actionArticle(caseFile.getActionType()),
                caseFile.getRepresents(),
=======
                CatalogCodes.toWire(caseFile.getActionType()),
                vocabulary.actionArticle(caseFile.getActionType()),
                CatalogCodes.toWire(caseFile.getRepresents()),
>>>>>>> origin/main
                caseFile.getStageCode(),
                vocabulary.stageName(caseFile.getStageCode()),
                caseFile.getStatus(),
                caseFile.getClosingOutcomeCode(),
                vocabulary.outcomeName(caseFile.getClosingOutcomeCode()),
                caseFile.isReserved(),
                caseFile.isArchived(),
                caseFile.getCreatedAt(),
                summary);
    }
}
