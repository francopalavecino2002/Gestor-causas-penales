package ar.gestorpenal.person;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Clients of the current firm and their authorized contacts (ADR-0014). Every referenced row is
 * loaded through its tenant-filtered repository, so an id of another firm answers "not found".
 */
@Service
class ClientService {

    private final ClientRepository clients;
    private final AuthorizedContactRepository contacts;
    private final PersonService people;

    ClientService(ClientRepository clients, AuthorizedContactRepository contacts, PersonService people) {
        this.clients = clients;
        this.contacts = contacts;
        this.people = people;
    }

    /** Makes the person a client. A person has at most one client record, archived or not. */
    @Transactional
    ClientView makeClient(UUID personId, ClientData data) {
        Person person = people.get(personId);
        clients.findByPersonId(personId).ifPresent(existing -> {
            throw new AlreadyAClientException(existing.getId());
        });
        return view(clients.saveAndFlush(Client.create(person.getId(), data)));
    }

    @Transactional(readOnly = true)
    ClientView get(UUID id) {
        return view(find(id));
    }

    @Transactional
    ClientView update(UUID id, ClientData data) {
        Client client = find(id);
        client.apply(data);
        return view(client);
    }

    @Transactional
    void archive(UUID id) {
        find(id).archive();
    }

    @Transactional
    void restore(UUID id) {
        find(id).restore();
    }

    @Transactional
    ContactView addContact(UUID clientId, ContactData data) {
        Client client = find(clientId);
        return ContactView.of(contacts.save(AuthorizedContact.create(client.getId(), data)));
    }

    @Transactional
    ContactView updateContact(UUID clientId, UUID contactId, ContactData data) {
        AuthorizedContact contact = findContact(clientId, contactId);
        contact.apply(data);
        return ContactView.of(contact);
    }

    @Transactional
    void archiveContact(UUID clientId, UUID contactId) {
        findContact(clientId, contactId).archive();
    }

    private ClientView view(Client client) {
        Person person = people.get(client.getPersonId());
        List<AuthorizedContact> activeContacts =
                contacts.findByClientIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(client.getId());
        List<DocumentMatch> conflicts = person.getDocumentNumber() == null
                ? List.of()
                : people.matchesFor(person.getDocumentNumber(), person.getId());
        return ClientView.of(client, person, activeContacts, conflicts);
    }

    private Client find(UUID id) {
        return clients.findById(id).orElseThrow(() -> new RecordNotFoundException("There is no client " + id));
    }

    private AuthorizedContact findContact(UUID clientId, UUID contactId) {
        Client client = find(clientId);
        return contacts.findByIdAndClientId(contactId, client.getId())
                .orElseThrow(() -> new RecordNotFoundException("The client has no contact " + contactId));
    }
}
