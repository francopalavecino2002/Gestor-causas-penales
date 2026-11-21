package ar.gestorpenal.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A 6-digit TOTP code or a recovery code. Never printed. */
record CodeRequest(@NotBlank @Size(max = 32) String code) {

    @Override
    public String toString() {
        return "CodeRequest[code=***]";
    }
}
