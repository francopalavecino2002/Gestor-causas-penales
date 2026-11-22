package ar.gestorpenal.person;

import java.util.Collection;
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

    Persons(PersonRepository people) {
        this.people = people;
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
}
