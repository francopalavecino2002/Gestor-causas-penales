package ar.gestorpenal.person;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * The editable fields of a person, as sent by the client. Humans use first and last names, legal
 * entities use {@code legalName}; the document number may carry separators and is normalized.
 */
record PersonData(
        @NotNull PersonKind kind,
        @Size(max = 120) String firstNames,
        @Size(max = 120) String lastNames,
        @Size(max = 200) String legalName,
        @Size(max = 200) String aliases,
        DocumentType documentType,
        @Size(max = 60) String documentNumber,
        LocalDate birthDate,
        @Size(max = 60) String nationality,
        @Size(max = 40) String phone,
        @Email @Size(max = 200) String email,
        @Size(max = 300) String address) {}
