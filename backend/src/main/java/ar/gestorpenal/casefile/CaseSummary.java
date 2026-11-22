package ar.gestorpenal.casefile;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * What a case shows at a glance, computed from its active defendants (the case itself has no state).
 * Detainees and the next hearing join the summary when coercive measures and hearings exist.
 *
 * @param defendantCount active defendants
 * @param openDefendantCount active defendants that are not closed
 * @param mostDelayedStage the stage, first in the stages catalog order, of an open defendant;
 *     {@code cerrada} when every defendant is closed; {@code null} when there are no defendants
 */
record CaseSummary(int defendantCount, int openDefendantCount, String mostDelayedStage) {

    /** Archived defendants are ignored. A stage missing from {@code stageOrder} counts as the latest. */
    static CaseSummary of(List<Defendant> defendants, List<String> stageOrder) {
        List<Defendant> active = defendants.stream().filter(defendant -> !defendant.isArchived()).toList();
        List<Defendant> open = active.stream().filter(defendant -> !defendant.isClosed()).toList();
        String mostDelayed;
        if (active.isEmpty()) {
            mostDelayed = null;
        } else if (open.isEmpty()) {
            mostDelayed = Defendant.CLOSED_STAGE;
        } else {
            Optional<String> earliest = open.stream()
                    .map(Defendant::getStageCode)
                    .min(Comparator.comparingInt(stage -> position(stageOrder, stage)));
            mostDelayed = earliest.orElseThrow();
        }
        return new CaseSummary(active.size(), open.size(), mostDelayed);
    }

    private static int position(List<String> stageOrder, String stage) {
        int index = stageOrder.indexOf(stage);
        return index < 0 ? Integer.MAX_VALUE : index;
    }
}
