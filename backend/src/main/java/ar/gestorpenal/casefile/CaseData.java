package ar.gestorpenal.casefile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

/**
 * The editable fields of a case, as sent by the client. {@code responsibleUserId} only counts when
 * the case is created (it defaults to the creator); afterwards the team has its own endpoint.
 * {@code mpfLegajo} may be typed in lowercase or without the space; it is normalized.
 * {@code customFields} holds the firm's custom field values by key; omitted, the stored values stay.
 * {@code practiceArea} is the code of an area the firm has enabled; omitted, a new case is penal. It is
 * chosen when the case is created and never changes.
 *
<<<<<<< HEAD
 * <p>{@code actionType} and {@code represents} are codes of the area's catalogs ({@code public-on-complaint},
 * {@code defence}, {@code ordinario}). {@code stageCode},
=======
 * <p>{@code actionType} and {@code represents} are codes of the area's catalogs; the API also accepts the
 * old enum-like spelling ({@code PUBLIC_ON_COMPLAINT}), see {@link CatalogCodes}. {@code stageCode},
>>>>>>> origin/main
 * {@code status} and {@code closingOutcomeCode} only apply to an area without the {@code defendants}
 * module: its case has its own course (a new case starts in the area's first stage); in a criminal case
 * they must be omitted because each defendant has them.
 */
record CaseData(
        @NotBlank @Size(max = 300) String caption,
        @Size(max = 40) String internalNumber,
        @Size(max = 40) String mpfLegajo,
        @Size(max = 40) String ofijuNumber,
        @Size(max = 40) String pehuenNumber,
        @NotBlank @Size(max = 60) String circumscriptionCode,
        @NotBlank @Size(max = 60) String actionType,
        @NotBlank @Size(max = 60) String represents,
        Boolean reserved,
        UUID responsibleUserId,
        @Size(max = 100) Map<String, Object> customFields,
        @Size(max = 40) String practiceArea,
        @Size(max = 60) String stageCode,
        CaseStatus status,
        @Size(max = 60) String closingOutcomeCode) {
<<<<<<< HEAD
=======

    CaseData {
        actionType = CatalogCodes.fromWire(actionType);
        represents = CatalogCodes.fromWire(represents);
    }
>>>>>>> origin/main

    /**
     * The reserved flag to store: omitted keeps the current value (not reserved on a new case), so a
     * client that does not send it never un-reserves a case by accident.
     */
    boolean reservedOr(boolean current) {
        return reserved == null ? current : reserved;
    }
}
