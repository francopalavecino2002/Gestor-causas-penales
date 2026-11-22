package ar.gestorpenal.hearing;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The editable fields of a hearing, as sent by the client. On creation omitted values take their
 * defaults: duration 60 minutes, status {@code programada}, the case's responsible as the only lawyer
 * and no defendants. An update is a full replace, except that an omitted status, duration, defendant
 * list or lawyer list keeps the current value (no silent resets). The date of an existing hearing
 * only changes by rescheduling it.
 */
record HearingData(
        @NotBlank @Size(max = 60) String typeCode,
        @NotNull Instant startsAt,
        @Min(5) @Max(1440) Integer durationMinutes,
        @Size(max = 100) String room,
        @Size(max = 200) String judge,
        @Size(max = 100) String ofijuReference,
        RequestedBy requestedBy,
        @Size(max = 60) String statusCode,
        @Size(max = 60) String cancellationReasonCode,
        @Size(max = 60) String heldAsTypeCode,
        @Size(max = 5000) String resultSummary,
        @Size(max = 5000) String notes,
        List<UUID> defendantIds,
        List<UUID> lawyerIds) {}
