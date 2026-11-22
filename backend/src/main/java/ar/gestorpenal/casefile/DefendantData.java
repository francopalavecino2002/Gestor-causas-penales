package ar.gestorpenal.casefile;

import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * The editable fields of a defendant, as sent by the client. {@code personId} is required to add a
 * defendant and cannot change afterwards. When a defendant is added, omitted values take their
 * defaults: stage {@code averiguacion-preliminar}, status {@code ACTIVE}, defended by the firm. An
 * update is a full replace and needs stage, status and {@code defendedByFirm}, except for
 * {@code customFields}: the firm's custom field values by key, which stay as they are when omitted.
 */
record DefendantData(
        UUID personId,
        @Size(max = 60) String stageCode,
        DefendantStatus status,
        @Size(max = 60) String closingOutcomeCode,
        @PastOrPresent LocalDate chargesFormulatedOn,
        Boolean defendedByFirm,
        CounselKind defenceCounselKind,
        @Size(max = 200) String defenceCounselName,
        @PastOrPresent LocalDate rebellionDeclaredOn,
        @PastOrPresent LocalDate rebellionLiftedOn,
        Boolean indigenousPeople,
        @Size(max = 100) Map<String, Object> customFields) {}
