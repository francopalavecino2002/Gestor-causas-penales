package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Finds hearings that overlap for the same lawyer (ADR-0016). A pure computation: loading the
 * candidates (not archived, case not archived, not cancelled or suspended) is up to the caller.
 * Travel time between cities is not considered yet.
 */
final class ClashDetector {

    private ClashDetector() {}

    /** One lawyer's attendance at one hearing: the interval {@code [startsAt, startsAt + duration)}. */
    record Booking(UUID hearingId, UUID userId, Instant startsAt, int durationMinutes) {

        Instant endsAt() {
            return startsAt.plusSeconds(durationMinutes * 60L);
        }

        /** Same lawyer, another hearing, and the intervals overlap. A hearing that starts when another ends does not clash. */
        boolean clashesWith(Booking other) {
            return userId.equals(other.userId)
                    && !hearingId.equals(other.hearingId)
                    && startsAt.isBefore(other.endsAt())
                    && other.startsAt.isBefore(endsAt());
        }
    }

    /** A hearing with one of these statuses never clashes: it did not take, or will not take, place. */
    static boolean canClash(String statusCode) {
        return !HearingRules.NOT_HELD.contains(statusCode);
    }

    /** The bookings in {@code others} that clash with {@code booking}. */
    static List<Booking> clashesOf(Booking booking, Collection<Booking> others) {
        return others.stream().filter(booking::clashesWith).toList();
    }
}
