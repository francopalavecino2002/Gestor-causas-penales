package ar.gestorpenal.hearing;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** The day a coercive measure ceased (cese). */
record LiftData(@NotNull LocalDate liftedOn) {}
