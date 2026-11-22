package ar.gestorpenal.casefile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A charge as sent by the client: the offence and, optionally, its legal reference. */
record ChargeData(
        @NotBlank @Size(max = 200) String offence,
        @Size(max = 100) String legalReference) {}
