package ar.gestorpenal.person;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * The editable fields of a client: when and how they came, and the consent to process their data.
 * The consent date and scope go together; the document reference points to the signed form.
 */
record ClientData(
        @NotNull @PastOrPresent LocalDate intakeDate,
        @Size(max = 200) String referralSource,
        @PastOrPresent LocalDate consentGivenOn,
        @Size(max = 500) String consentScope,
        @Size(max = 200) String consentDocumentRef) {}
