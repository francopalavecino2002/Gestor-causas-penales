package ar.gestorpenal.casefile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A defendant with their person's name, the catalog names of stage and outcome, active charges and
 * the values of the firm's active custom fields.
 */
record DefendantView(
        UUID id,
        UUID personId,
        String displayName,
        boolean personArchived,
        String stageCode,
        String stageName,
        DefendantStatus status,
        String closingOutcomeCode,
        String closingOutcomeName,
        LocalDate chargesFormulatedOn,
        boolean defendedByFirm,
        CounselKind defenceCounselKind,
        String defenceCounselName,
        LocalDate rebellionDeclaredOn,
        LocalDate rebellionLiftedOn,
        Boolean indigenousPeople,
        Instant createdAt,
        List<ChargeView> charges,
        Map<String, Object> customFields) {}
