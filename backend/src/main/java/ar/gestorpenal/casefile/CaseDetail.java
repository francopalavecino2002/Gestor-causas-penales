package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.PracticeModule;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A case with the values of the firm's active custom fields, its active team, parties and defendants
 * (each with its active charges).
 */
record CaseDetail(
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
        CaseSummary summary,
        Map<String, Object> customFields,
        List<TeamMemberView> team,
        List<PartyView> parties,
        List<DefendantView> defendants) {

    static CaseDetail of(
            CaseView head,
            Map<String, Object> customFields,
            List<TeamMemberView> team,
            List<PartyView> parties,
            List<DefendantView> defendants) {
        return new CaseDetail(
                head.id(),
                head.practiceArea(),
                head.modules(),
                head.caption(),
                head.internalNumber(),
                head.mpfLegajo(),
                head.ofijuNumber(),
                head.pehuenNumber(),
                head.circumscriptionCode(),
                head.circumscriptionName(),
                head.actionType(),
                head.actionArticle(),
                head.represents(),
                head.stageCode(),
                head.stageName(),
                head.status(),
                head.closingOutcomeCode(),
                head.closingOutcomeName(),
                head.reserved(),
                head.archived(),
                head.createdAt(),
                head.summary(),
                customFields,
                team,
                parties,
                defendants);
    }
}
