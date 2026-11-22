package ar.gestorpenal.hearing;

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

/** Coercive measures of a defendant (ADR-0016). There is no delete: a measure is lifted or archived. */
@RestController
@RequestMapping("/api/v1")
class CoerciveMeasureController {

    private final CoerciveMeasureService measures;

    CoerciveMeasureController(CoerciveMeasureService measures) {
        this.measures = measures;
    }

    @PostMapping("/defendants/{defendantId}/coercive-measures")
    ResponseEntity<CoerciveMeasureView> create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID defendantId,
            @Valid @RequestBody CoerciveMeasureData body) {
        CoerciveMeasureView created = measures.create(user, defendantId, body);
        return ResponseEntity.created(URI.create("/api/v1/coercive-measures/" + created.id())).body(created);
    }

    @GetMapping("/defendants/{defendantId}/coercive-measures")
    List<CoerciveMeasureView> ofDefendant(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID defendantId,
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return measures.listByDefendant(user, defendantId, includeArchived);
    }

    @PutMapping("/coercive-measures/{id}")
    CoerciveMeasureView update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody CoerciveMeasureData body) {
        return measures.update(user, id, body);
    }

    @PostMapping("/coercive-measures/{id}/lift")
    CoerciveMeasureView lift(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody LiftData body) {
        return measures.lift(user, id, body);
    }

    @PostMapping("/coercive-measures/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        measures.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/coercive-measures/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        measures.restore(user, id);
        return ResponseEntity.noContent().build();
    }
}
