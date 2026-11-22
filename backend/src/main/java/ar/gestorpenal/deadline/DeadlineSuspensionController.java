package ar.gestorpenal.deadline;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
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

/** Suspensions of a case's deadlines (ADR-0017). There is no delete: a suspension is archived. */
@RestController
@RequestMapping("/api/v1")
class DeadlineSuspensionController {

    private final DeadlineSuspensionService suspensions;

    DeadlineSuspensionController(DeadlineSuspensionService suspensions) {
        this.suspensions = suspensions;
    }

    @PostMapping("/cases/{caseId}/deadline-suspensions")
    ResponseEntity<SuspensionView> create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @Valid @RequestBody SuspensionData body) {
        SuspensionView created = suspensions.create(user, caseId, body);
        return ResponseEntity.created(URI.create("/api/v1/deadline-suspensions/" + created.id())).body(created);
    }

    @GetMapping("/cases/{caseId}/deadline-suspensions")
    List<SuspensionView> ofCase(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return suspensions.listByCase(user, caseId, includeArchived);
    }

    @PutMapping("/deadline-suspensions/{id}")
    SuspensionView update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody SuspensionData body) {
        return suspensions.update(user, id, body);
    }

    @PostMapping("/deadline-suspensions/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        suspensions.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/deadline-suspensions/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        suspensions.restore(user, id);
        return ResponseEntity.noContent().build();
    }
}
