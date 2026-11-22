package ar.gestorpenal.casefile;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A case with its active team, parties and defendants (each with its active charges). */
record CaseDetail(
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
        CaseSummary summary,
        List<TeamMemberView> team,
        List<PartyView> parties,
        List<DefendantView> defendants) {

    static CaseDetail of(
            CaseView head, List<TeamMemberView> team, List<PartyView> parties, List<DefendantView> defendants) {
        return new CaseDetail(
                head.id(),
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
                head.reserved(),
                head.archived(),
                head.createdAt(),
                head.summary(),
                team,
                parties,
                defendants);
    }
}
