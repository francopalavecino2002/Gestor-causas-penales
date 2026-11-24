package ar.gestorpenal.task;

import java.time.LocalDate;
import java.util.UUID;

/**
 * What a task list asks for; every field is optional.
 *
 * @param scope {@code mine} (the tasks the user is responsible for) or {@code all}; {@code null} means {@code all}
 * @param overdue only pending tasks due before today
 * @param dueOn only tasks due on this day
 */
record TaskFilter(
        String scope,
        UUID responsibleId,
        UUID caseId,
        UUID hearingId,
        TaskStatus status,
        boolean overdue,
        LocalDate dueOn,
        boolean includeArchived) {}
