package ar.gestorpenal.deadline;

import ar.gestorpenal.security.AuthenticatedUser;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * The narrow public entry point to deadlines for other features (the news wall), like {@code Cases}
 * and {@code Hearings}. Visibility and the firm's rule settings are those of {@link DeadlineService}.
 */
@Service
public class Deadlines {

    private final DeadlineService service;

    Deadlines(DeadlineService service) {
        this.service = service;
    }

    /**
     * The running deadlines of the cases the user sees that are inside their rule's alert window (at
     * least the last 24 hours), detainee deadlines first, then the soonest.
     */
    public List<DeadlineAlert> dueSoon(AuthenticatedUser user) {
        // DUE_SOON already applies each rule's alert window, so the shortest horizon is enough.
        return service.upcoming(user, 1).stream()
                .filter(view -> view.status() == DeadlineStatus.DUE_SOON)
                .map(Deadlines::alert)
                .toList();
    }

    private static DeadlineAlert alert(DeadlineView view) {
        return new DeadlineAlert(
                view.id(),
                view.caseId(),
                view.caseCaption(),
                view.defendantName(),
                view.rule().name(),
                view.rule().source(),
                view.rule().detainee(),
                view.dueOn(),
                view.dueAt(),
                view.daysLeft(),
                view.hoursLeft(),
                view.disclaimer());
    }
}
