package ar.gestorpenal.person;

import java.util.UUID;

/** The few facts other features (cases) need to know about a person of the firm. */
public record PersonSummary(UUID id, PersonKind kind, String displayName, boolean archived) {

    static PersonSummary of(Person person) {
        return new PersonSummary(person.getId(), person.getKind(), person.displayName(), person.isArchived());
    }
}
