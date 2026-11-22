package ar.gestorpenal.casefile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** A person and the role they have in the case (an item of the party-roles catalog, not imputado). */
record PartyData(@NotNull UUID personId, @NotBlank @Size(max = 60) String roleCode) {}
