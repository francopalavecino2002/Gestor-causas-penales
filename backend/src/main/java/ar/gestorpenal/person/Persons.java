package ar.gestorpenal.person;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point to persons for other features. It only sees the current firm's
 * people (ADR-0007), so an id of another firm is simply not found. Everything else in this package
 * stays package-private, which keeps {@code person} free of any dependency on cases.
 */
@Service
public class Persons {

    private final PersonRepository people;
    private final PersonService service;

    Persons(PersonRepository people, PersonService service) {
        this.people = people;
        this.service = service;
    }

    /**
     * The person with this document number, archived or not. The number may carry separators. A
     * DNI also matches the CUIT or CUIL that contains it (ADR-0014); an exact match is preferred.
     */
    @Transactional(readOnly = true)
    public Optional<PersonSummary> findByDocument(String documentNumber) {
        DocumentLookup lookup = DocumentLookup.of(documentNumber);
        List<Person> matches = people.findByDocument(lookup.numbers(), lookup.embeddedDni());
        String exact = DocumentLookup.normalize(documentNumber);
        return matches.stream()
                .filter(person -> exact.equals(person.getDocumentNumber()))
                .findFirst()
                .or(() -> matches.stream().findFirst())
                .map(PersonSummary::of);
    }

    /**
     * Registers a human with a document, like {@code POST /persons}.
     *
     * @throws InvalidPersonDataException when the names or the document break a rule of persons
     */
    @Transactional
    public PersonSummary registerHuman(String firstNames, String lastNames, DocumentType type, String documentNumber) {
        return PersonSummary.of(service.create(new PersonData(
                PersonKind.HUMAN, firstNames, lastNames, null, null, type, documentNumber, null, null, null, null, null)));
    }

    /** The person, archived or not. */
    @Transactional(readOnly = true)
    public Optional<PersonSummary> find(UUID id) {
        return people.findById(id).map(PersonSummary::of);
    }

    @Transactional(readOnly = true)
    public Map<UUID, PersonSummary> findAll(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return people.findAllById(ids).stream()
                .map(PersonSummary::of)
                .collect(Collectors.toMap(PersonSummary::id, Function.identity()));
    }

    /** Used by the demo data: the human with these exact names, created if the firm has none. */
    @Transactional
    public PersonSummary findOrRegisterHuman(String firstNames, String lastNames) {
        Person person = people.findFirstByFirstNamesAndLastNamesOrderByCreatedAtAscIdAsc(firstNames, lastNames)
                .orElseGet(() -> people.save(Person.create(new PersonData(
                        PersonKind.HUMAN, firstNames, lastNames, null, null, null, null, null, null, null, null, null))));
        return PersonSummary.of(person);
    }

    /** Used by the demo data: the legal entity with this exact name, created if the firm has none. */
    @Transactional
    public PersonSummary findOrRegisterLegalEntity(String legalName) {
        Person person = people.findFirstByKindAndLegalNameOrderByCreatedAtAscIdAsc(PersonKind.LEGAL, legalName)
                .orElseGet(() -> people.save(Person.create(new PersonData(
                        PersonKind.LEGAL, null, null, legalName, null, null, null, null, null, null, null, null))));
        return PersonSummary.of(person);
    }
}
