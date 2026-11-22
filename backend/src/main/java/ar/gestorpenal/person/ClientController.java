package ar.gestorpenal.person;

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
import org.springframework.web.bind.annotation.RestController;

/**
 * Clients of the firm and their authorized contacts (ADR-0014). Every member reads, creates and
 * edits; archiving and restoring a client is for the owner and lawyers.
 */
@RestController
@RequestMapping("/api/v1")
class ClientController {

    private final ClientService clients;

    ClientController(ClientService clients) {
        this.clients = clients;
    }

    @PostMapping("/persons/{personId}/client")
    ResponseEntity<ClientView> makeClient(@PathVariable UUID personId, @Valid @RequestBody ClientData body) {
        ClientView client = clients.makeClient(personId, body);
        return ResponseEntity.created(URI.create("/api/v1/clients/" + client.id())).body(client);
    }

    @GetMapping("/clients/{id}")
    ClientView one(@PathVariable UUID id) {
        return clients.get(id);
    }

    @PutMapping("/clients/{id}")
    ClientView update(@PathVariable UUID id, @Valid @RequestBody ClientData body) {
        return clients.update(id, body);
    }

    @PostMapping("/clients/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        Permissions.requireCanArchive(user);
        clients.archive(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/clients/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        Permissions.requireCanArchive(user);
        clients.restore(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/clients/{id}/contacts")
    ResponseEntity<ContactView> addContact(@PathVariable UUID id, @Valid @RequestBody ContactData body) {
        ContactView contact = clients.addContact(id, body);
        return ResponseEntity.created(URI.create("/api/v1/clients/" + id + "/contacts/" + contact.id())).body(contact);
    }

    @PutMapping("/clients/{id}/contacts/{contactId}")
    ContactView updateContact(
            @PathVariable UUID id, @PathVariable UUID contactId, @Valid @RequestBody ContactData body) {
        return clients.updateContact(id, contactId, body);
    }

    @PostMapping("/clients/{id}/contacts/{contactId}/archive")
    ResponseEntity<Void> archiveContact(@PathVariable UUID id, @PathVariable UUID contactId) {
        clients.archiveContact(id, contactId);
        return ResponseEntity.noContent().build();
    }
}
