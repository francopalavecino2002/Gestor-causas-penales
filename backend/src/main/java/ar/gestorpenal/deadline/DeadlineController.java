package ar.gestorpenal.deadline;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Deadlines of a case and the firm's upcoming ones (ADR-0017). There is no delete: a deadline is archived. */
@RestController
@RequestMapping("/api/v1")
class DeadlineController {

    private final DeadlineService deadlines;

    DeadlineController(DeadlineService deadlines) {
        this.deadlines = deadlines;
    }

    @PostMapping("/cases/{caseId}/deadlines")
    ResponseEntity<DeadlineView> create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @Valid @RequestBody DeadlineData body) {
        DeadlineView created = deadlines.create(user, caseId, body);
        return ResponseEntity.created(URI.create("/api/v1/deadlines/" + created.id())).body(created);
    }

    @GetMapping("/cases/{caseId}/deadlines")
    List<DeadlineView> ofCase(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return deadlines.listByCase(user, caseId, includeArchived);
    }

    /** Overdue, due within {@code withinDays} or not calculable, across the cases the user sees. */
    @GetMapping("/deadlines")
    List<DeadlineView> upcoming(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "" + DeadlineService.DEFAULT_WITHIN_DAYS) int withinDays) {
        return deadlines.upcoming(user, withinDays);
    }

    @GetMapping("/deadlines/{id}")
    DeadlineView one(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return deadlines.get(user, id);
    }

    @PutMapping("/deadlines/{id}")
    DeadlineView update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody DeadlineData body) {
        return deadlines.update(user, id, body);
    }

    @PostMapping("/deadlines/{id}/extensions")
    ResponseEntity<DeadlineView> extend(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody ExtensionData body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(deadlines.extend(user, id, body));
    }

    @PostMapping("/deadline-extensions/{id}/archive")
    DeadlineView archiveExtension(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return deadlines.archiveExtension(user, id);
    }

    @PostMapping("/deadlines/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        deadlines.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/deadlines/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        deadlines.restore(user, id);
        return ResponseEntity.noContent().build();
    }
}
