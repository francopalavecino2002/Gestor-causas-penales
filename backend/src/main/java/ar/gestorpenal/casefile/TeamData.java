package ar.gestorpenal.casefile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** The whole team of a case: it replaces the current one. Exactly one member is the responsible. */
record TeamData(@NotEmpty @Size(max = 50) List<@Valid @NotNull Member> members) {

    record Member(@NotNull UUID userId, @NotNull TeamRole role) {}
}
