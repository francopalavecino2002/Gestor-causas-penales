package ar.gestorpenal.hearing;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A coercive measure with the catalog names resolved. {@code active} means neither archived nor lifted.
 */
record CoerciveMeasureView(
        UUID id,
        UUID defendantId,
        String measureCode,
        String measureName,
        String measureArticle,
        String conditions,
        String detentionPlace,
        List<CodeName> proceduralRisks,
        LocalDate startsOn,
        LocalDate endsOn,
        LocalDate nextReviewOn,
        UUID orderedByHearingId,
        LocalDate liftedOn,
        boolean active,
        boolean archived,
        Instant createdAt) {}
