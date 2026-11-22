package ar.gestorpenal.hearing;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point to hearings for other features (deadlines), like {@code Cases} for
 * cases. It only sees the current firm's rows (ADR-0007).
 */
@Service
public class Hearings {

    private final HearingRepository hearings;

    Hearings(HearingRepository hearings) {
        this.hearings = hearings;
    }

    /** The case of the hearing, archived or not, or empty when the firm has no such hearing. */
    @Transactional(readOnly = true)
    public Optional<UUID> caseOf(UUID hearingId) {
        return hearings.findById(hearingId).map(Hearing::getCaseId);
    }
}
