package ar.gestorpenal.person;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The editable fields of an authorized contact of a client. */
record ContactData(
        @NotBlank @Size(max = 200) String fullName,
        @Size(max = 80) String relationship,
        @Size(max = 40) String phone,
        @Email @Size(max = 200) String email,
        @NotBlank @Size(max = 300) String mayBeTold) {}
