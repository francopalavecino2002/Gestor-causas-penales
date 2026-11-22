package ar.gestorpenal.casefile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

/**
 * The editable fields of a case, as sent by the client. {@code responsibleUserId} only counts when
 * the case is created (it defaults to the creator); afterwards the team has its own endpoint.
 * {@code mpfLegajo} may be typed in lowercase or without the space; it is normalized.
 * {@code customFields} holds the firm's custom field values by key; omitted, the stored values stay.
 */
record CaseData(
        @NotBlank @Size(max = 300) String caption,
        @Size(max = 40) String internalNumber,
        @Size(max = 40) String mpfLegajo,
        @Size(max = 40) String ofijuNumber,
        @Size(max = 40) String pehuenNumber,
        @NotBlank @Size(max = 60) String circumscriptionCode,
        @NotNull ActionType actionType,
        @NotNull Representation represents,
        Boolean reserved,
        UUID responsibleUserId,
        @Size(max = 100) Map<String, Object> customFields) {

    /**
     * The reserved flag to store: omitted keeps the current value (not reserved on a new case), so a
     * client that does not send it never un-reserves a case by accident.
     */
    boolean reservedOr(boolean current) {
        return reserved == null ? current : reserved;
    }
}
