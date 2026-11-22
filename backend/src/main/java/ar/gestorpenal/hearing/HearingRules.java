package ar.gestorpenal.hearing;

import java.util.Set;

/**
 * The status rules of a hearing, free of any persistence so they are unit-tested (ADR-0016). The
 * status codes are those of the {@code hearing-statuses} catalog, which a firm can only rename.
 */
final class HearingRules {

    static final String REQUESTED = "solicitada";
    static final String SCHEDULED = "programada";
    static final String RESCHEDULED = "reprogramada";
    static final String HELD = "efectiva";
    static final String RECONVERTED = "reconvertida";
    static final String RECESS = "cuarto-intermedio";
    static final String SUSPENDED = "suspendida";
    static final String CANCELLED = "cancelada";

    /** The hearing did not take place: it has a cancellation reason and never clashes. */
    static final Set<String> NOT_HELD = Set.of(CANCELLED, SUSPENDED);

    /** The hearing took place: it may carry a result and a follow-up hearing. */
    static final Set<String> WITH_RESULT = Set.of(HELD, RECONVERTED, RECESS);

    /** Over, or not going to happen: the case summary never offers such a hearing as the next one. */
    static final Set<String> NOT_PENDING = Set.of(CANCELLED, SUSPENDED, HELD, RECONVERTED);

    private HearingRules() {}

    /** Which optional fields the status allows. Throws {@link InvalidHearingDataException} otherwise. */
    static void requireConsistent(
            String status,
            String cancellationReason,
            String heldAsType,
            String resultSummary,
            boolean hasNextHearing) {
        if (cancellationReason != null && !NOT_HELD.contains(status)) {
            throw new InvalidHearingDataException(
                    "A cancellation reason only applies to a cancelled or suspended hearing");
        }
        if (RECONVERTED.equals(status) && heldAsType == null) {
            throw new InvalidHearingDataException("A reconverted hearing needs the type it was held as");
        }
        if (heldAsType != null && !RECONVERTED.equals(status)) {
            throw new InvalidHearingDataException("The type a hearing was held as only applies to a reconverted hearing");
        }
        if ((resultSummary != null || hasNextHearing) && !WITH_RESULT.contains(status)) {
            throw new InvalidHearingDataException(
                    "A result or a next hearing only applies to a hearing that took place "
                            + "(efectiva, reconvertida or cuarto-intermedio)");
        }
    }

    /** A cancelled hearing is over: it cannot be rescheduled or get a result (a suspended one can). */
    static boolean isFinallyCancelled(String status) {
        return CANCELLED.equals(status);
    }

    /** The result endpoint only records outcomes of a hearing that took place. */
    static void requireResultStatus(String status) {
        if (!WITH_RESULT.contains(status)) {
            throw new InvalidHearingDataException(
                    "The result of a hearing is efectiva, reconvertida or cuarto-intermedio");
        }
    }

    /** {@code reprogramada} is only reached by rescheduling, which keeps the history. */
    static void requireNotRescheduledByHand(String newStatus, String currentStatus) {
        if (RESCHEDULED.equals(newStatus) && !RESCHEDULED.equals(currentStatus)) {
            throw new InvalidHearingDataException("A hearing becomes reprogramada by rescheduling it, not by editing it");
        }
    }
}
