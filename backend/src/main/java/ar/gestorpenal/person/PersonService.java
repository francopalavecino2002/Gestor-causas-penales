package ar.gestorpenal.person;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * People of the current firm (ADR-0014). The caller must be inside a tenant (an authenticated
 * request or a {@code TenantContext} scope); the repositories only see that firm's rows.
 */
@Service
class PersonService {

    static final int MAX_PAGE_SIZE = 100;

    private final PersonRepository people;
    private final ClientRepository clients;
    private final PersonCaseRoles caseRoles;

    PersonService(PersonRepository people, ClientRepository clients, PersonCaseRoles caseRoles) {
        this.people = people;
        this.clients = clients;
        this.caseRoles = caseRoles;
    }

    @Transactional
    Person create(PersonData data) {
        Person person = Person.create(data);
        requireDocumentFree(person.getDocumentType(), person.getDocumentNumber(), null);
        return people.saveAndFlush(person);
    }

    @Transactional(readOnly = true)
    Person get(UUID id) {
        return people.findById(id).orElseThrow(() -> notFound(id));
    }

    @Transactional
    Person update(UUID id, PersonData data) {
        Person person = get(id);
        person.requireSameKind(data);
        // Before applying: a managed, changed entity would be flushed by the lookup query.
        if (Text.clean(data.documentNumber()) != null) {
            requireDocumentFree(data.documentType(), DocumentLookup.normalize(data.documentNumber()), id);
        }
        person.apply(data);
        return person;
    }

    @Transactional(readOnly = true)
    Page<Person> search(String query, boolean includeArchived, int page, int size) {
        String text = Text.clean(query) == null ? "" : stripWildcards(query).toLowerCase(Locale.ROOT);
        String number = text.isEmpty() ? "" : DocumentLookup.normalize(text);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        return people.search("%" + text + "%", "%" + number + "%", includeArchived, pageRequest);
    }

    @Transactional
    void archive(UUID id) {
        get(id).archive();
    }

    @Transactional
    void restore(UUID id) {
        get(id).restore();
    }

    /** Everyone in the firm, archived included, whose document matches {@code documentNumber}. */
    @Transactional(readOnly = true)
    ConflictCheckResult conflictCheck(String documentNumber) {
        if (Text.clean(documentNumber) == null) {
            throw new InvalidPersonDataException("The document number is required");
        }
        return ConflictCheckResult.of(matchesFor(documentNumber, null));
    }

    /** Matches of a document number in the firm, leaving out {@code excludedPersonId} if given. */
    List<DocumentMatch> matchesFor(String documentNumber, UUID excludedPersonId) {
        DocumentLookup lookup = DocumentLookup.of(documentNumber);
        List<Person> matches = people.findByDocument(lookup.numbers(), lookup.embeddedDni()).stream()
                .filter(person -> !person.getId().equals(excludedPersonId))
                .toList();
        Set<UUID> clientPeople = matches.isEmpty()
                ? Set.of()
                : clients.findByPersonIdIn(matches.stream().map(Person::getId).toList()).stream()
                        .map(Client::getPersonId)
                        .collect(Collectors.toSet());
        Map<UUID, List<CaseRole>> roles = matches.isEmpty()
                ? Map.of()
                : caseRoles.rolesOf(matches.stream().map(Person::getId).toList());
        return matches.stream()
                .map(person -> new DocumentMatch(
                        person.getId(),
                        person.displayName(),
                        person.getDocumentType(),
                        person.getDocumentNumber(),
                        person.isArchived(),
                        clientPeople.contains(person.getId()),
                        roles.getOrDefault(person.getId(), List.of())))
                .toList();
    }

    private void requireDocumentFree(DocumentType type, String normalizedNumber, UUID selfId) {
        if (type == null || normalizedNumber == null) {
            return;
        }
        people.findByDocumentTypeAndDocumentNumber(type, normalizedNumber)
                .filter(existing -> !existing.getId().equals(selfId))
                .ifPresent(existing -> {
                    throw new DuplicateDocumentException(existing.getId());
                });
    }

    private static String stripWildcards(String query) {
        return query.strip().replaceAll("[%_\\\\]", "");
    }

    private static RecordNotFoundException notFound(UUID id) {
        return new RecordNotFoundException("There is no person " + id);
    }
}
