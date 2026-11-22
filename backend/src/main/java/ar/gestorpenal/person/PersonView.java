package ar.gestorpenal.person;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A person as shown by the API. */
record PersonView(
        UUID id,
        PersonKind kind,
        String displayName,
        String firstNames,
        String lastNames,
        String legalName,
        String aliases,
        DocumentType documentType,
        String documentNumber,
        LocalDate birthDate,
        String nationality,
        String phone,
        String email,
        String address,
        boolean archived,
        Instant createdAt) {

    static PersonView of(Person person) {
        return new PersonView(
                person.getId(),
                person.getKind(),
                person.displayName(),
                person.getFirstNames(),
                person.getLastNames(),
                person.getLegalName(),
                person.getAliases(),
                person.getDocumentType(),
                person.getDocumentNumber(),
                person.getBirthDate(),
                person.getNationality(),
                person.getPhone(),
                person.getEmail(),
                person.getAddress(),
                person.isArchived(),
                person.getCreatedAt());
    }
}
