package ar.gestorpenal.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code tenant} is the firm's slug, shown to users as "estudio". */
record LoginRequest(
        @NotBlank @Size(max = 63) String tenant,
        @NotBlank @Size(max = 254) String email,
        @NotBlank @Size(max = 128) String password) {

    @Override
    public String toString() {
        return "LoginRequest[tenant=" + tenant + ", email=" + email + ", password=***]";
    }
}
