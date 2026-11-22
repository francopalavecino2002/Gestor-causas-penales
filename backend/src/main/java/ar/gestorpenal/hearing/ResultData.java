package ar.gestorpenal.hearing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * The outcome of a hearing: efectiva, reconvertida (with the type it was held as) or cuarto-intermedio.
 * A {@code nextHearing} creates the follow-up in the same case, with the same defendants and lawyers.
 */
record ResultData(
        @NotBlank @Size(max = 60) String statusCode,
        @Size(max = 60) String heldAsTypeCode,
        @Size(max = 5000) String resultSummary,
        @Valid NextHearingData nextHearing) {

    /** The follow-up hearing: only what differs from the hearing that produced it. */
    record NextHearingData(
            @NotBlank @Size(max = 60) String typeCode,
            @NotNull Instant startsAt,
            @Min(5) @Max(1440) Integer durationMinutes,
            @Size(max = 100) String room,
            @Size(max = 200) String judge) {}
}
