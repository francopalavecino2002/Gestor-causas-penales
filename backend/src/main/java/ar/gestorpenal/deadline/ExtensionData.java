package ar.gestorpenal.deadline;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * An extension (prórroga) granted on a deadline.
 *
 * @param amount in the rule's unit (months for art. 158, days for the mediation)
 * @param grantedByHearingId the hearing that granted it, of the deadline's case
 */
record ExtensionData(
        @NotNull @Min(1) Integer amount,
        @NotNull LocalDate grantedOn,
        UUID grantedByHearingId,
        @Size(max = 4000) String notes) {}
