package ar.gestorpenal.casefile;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Defendants of a case and their charges (ADR-0015). Anyone who can see the case may change them. */
@RestController
@RequestMapping("/api/v1/cases/{caseId}/defendants")
class DefendantController {

    private final DefendantService defendants;

    DefendantController(DefendantService defendants) {
        this.defendants = defendants;
    }

    @PostMapping
    ResponseEntity<DefendantView> add(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @Valid @RequestBody DefendantData body) {
        DefendantView defendant = defendants.add(user, caseId, body);
        return ResponseEntity.created(URI.create("/api/v1/cases/" + caseId + "/defendants/" + defendant.id()))
                .body(defendant);
    }

    @PutMapping("/{defendantId}")
    DefendantView update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @PathVariable UUID defendantId,
            @Valid @RequestBody DefendantData body) {
        return defendants.update(user, caseId, defendantId, body);
    }

    @PostMapping("/{defendantId}/archive")
    ResponseEntity<Void> archive(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID caseId, @PathVariable UUID defendantId) {
        defendants.archive(user, caseId, defendantId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{defendantId}/charges")
    ResponseEntity<ChargeView> addCharge(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @PathVariable UUID defendantId,
            @Valid @RequestBody ChargeData body) {
        ChargeView charge = defendants.addCharge(user, caseId, defendantId, body);
        return ResponseEntity.created(URI.create(
                        "/api/v1/cases/" + caseId + "/defendants/" + defendantId + "/charges/" + charge.id()))
                .body(charge);
    }

    @PutMapping("/{defendantId}/charges/{chargeId}")
    ChargeView updateCharge(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @PathVariable UUID defendantId,
            @PathVariable UUID chargeId,
            @Valid @RequestBody ChargeData body) {
        return defendants.updateCharge(user, caseId, defendantId, chargeId, body);
    }

    @PostMapping("/{defendantId}/charges/{chargeId}/archive")
    ResponseEntity<Void> archiveCharge(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @PathVariable UUID defendantId,
            @PathVariable UUID chargeId) {
        defendants.archiveCharge(user, caseId, defendantId, chargeId);
        return ResponseEntity.noContent().build();
    }
}
