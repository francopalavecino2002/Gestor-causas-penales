package ar.gestorpenal.casefile;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
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

/**
 * Cases, their team and parties (ADR-0015). A reserved case the user cannot see answers 404 on every
 * endpoint. There is no delete: nothing is deleted, it is archived.
 */
@RestController
@RequestMapping("/api/v1/cases")
class CaseController {

    private final CaseService cases;
    private final CasePartyService parties;

    CaseController(CaseService cases, CasePartyService parties) {
        this.cases = cases;
        this.parties = parties;
    }

    @PostMapping
    ResponseEntity<CaseDetail> create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CaseData body) {
        CaseDetail created = cases.create(user, body);
        return ResponseEntity.created(URI.create("/api/v1/cases/" + created.id())).body(created);
    }

    /**
     * Searches by caption, internal number, MPF legajo (typed in any case, with or without the space) or OFIJU number.
     * {@code area} keeps only the cases of that practice area.
     */
    @GetMapping
    CasePage search(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(required = false) String area,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return cases.search(user, q, includeArchived, area, page, size);
    }

    @GetMapping("/{id}")
    CaseDetail one(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return cases.get(user, id);
    }

    @PutMapping("/{id}")
    CaseDetail update(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody CaseData body) {
        return cases.update(user, id, body);
    }

    @PostMapping("/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        cases.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        cases.restore(user, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/team")
    CaseDetail replaceTeam(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody TeamData body) {
        return cases.replaceTeam(user, id, body);
    }

    @PostMapping("/{id}/parties")
    ResponseEntity<PartyView> addParty(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody PartyData body) {
        PartyView party = parties.add(user, id, body);
        return ResponseEntity.created(URI.create("/api/v1/cases/" + id + "/parties/" + party.id())).body(party);
    }

    @PostMapping("/{id}/parties/{partyId}/archive")
    ResponseEntity<Void> archiveParty(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @PathVariable UUID partyId) {
        parties.archive(user, id, partyId);
        return ResponseEntity.noContent().build();
    }
}
