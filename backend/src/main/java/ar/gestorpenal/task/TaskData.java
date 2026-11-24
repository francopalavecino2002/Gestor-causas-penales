package ar.gestorpenal.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A task as the client sends it. When {@code hearingId} is set and {@code caseId} is not, the case is
 * the hearing's case; when both are set they must match.
 *
 * @param dueDate the day it is due in the firm's zone; {@code null} for a task without a due day
 */
record TaskData(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 2000) String notes,
        LocalDate dueDate,
        @NotNull UUID responsibleUserId,
        UUID caseId,
        UUID hearingId) {}
