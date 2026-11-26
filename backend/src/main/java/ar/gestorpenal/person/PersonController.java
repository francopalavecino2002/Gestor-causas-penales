package ar.gestorpenal.person;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
 * People of the firm (ADR-0014). Every member reads, creates and edits; archiving and restoring
 * is for the owner and lawyers. There is no delete: nothing is deleted, it is archived.
 */
@RestController
@RequestMapping("/api/v1/persons")
class PersonController {

    private final PersonService people;

    PersonController(PersonService people) {
        this.people = people;
    }

    @PostMapping
    ResponseEntity<PersonView> create(@Valid @RequestBody PersonData body) {
        PersonView person = PersonView.of(people.create(body));
        return ResponseEntity.created(URI.create("/api/v1/persons/" + person.id())).body(person);
    }

    @GetMapping("/{id}")
    PersonView one(@PathVariable UUID id) {
        return PersonView.of(people.get(id));
    }

    @PutMapping("/{id}")
    PersonView update(@PathVariable UUID id, @Valid @RequestBody PersonData body) {
        return PersonView.of(people.update(id, body));
    }

    /** Searches by name, legal name, alias or document number (separators allowed). */
    @GetMapping
    PersonPage search(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return people.searchWithRoles(q, includeArchived, page, size);
    }

    /** The person with their client record id (or null) and their roles in cases, for the detail screen. */
    @GetMapping("/{id}/overview")
    PersonListItem overview(@PathVariable UUID id) {
        return people.overview(id);
    }

    record ConflictCheckRequest(@NotBlank @Size(max = 30) String documentNumber) {}

    /**
     * A POST with a body, not a GET, so the document number never lands in a URL, an access log
     * or the browser history. It changes nothing.
     */
    @PostMapping("/conflict-check")
    ConflictCheckResult conflictCheck(@Valid @RequestBody ConflictCheckRequest body) {
        return people.conflictCheck(body.documentNumber());
    }

    @PostMapping("/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        Permissions.requireCanArchive(user);
        people.archive(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        Permissions.requireCanArchive(user);
        people.restore(id);
        return ResponseEntity.noContent().build();
    }
}
