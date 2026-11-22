package ar.gestorpenal.deadline;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A period that stops the clock of the rules that list its kind.
 *
 * @param defendantId {@code null} for every defendant of the case
 * @param endsOn {@code null} while it lasts (the deadlines it affects show as suspended)
 */
record SuspensionData(
        @NotNull SuspensionKind kind,
        UUID defendantId,
        @NotNull LocalDate startsOn,
        LocalDate endsOn,
        @Size(max = 4000) String notes) {}
