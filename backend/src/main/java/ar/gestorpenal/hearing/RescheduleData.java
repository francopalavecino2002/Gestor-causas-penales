package ar.gestorpenal.hearing;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** A new date for a hearing, with the reason it moved. */
record RescheduleData(@NotNull Instant startsAt, @Size(max = 300) String reason) {}
