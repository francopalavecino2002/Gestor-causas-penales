package ar.gestorpenal.task;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point the demo data uses to create tasks without a logged-in user. It trusts
 * its caller (a member of the firm, a case of the firm). Call it inside a tenant scope, outside any
 * transaction.
 */
@Service
public class TaskSeeding {

    private final TaskRepository tasks;
    private final TaskClock clock;

    TaskSeeding(TaskRepository tasks, TaskClock clock) {
        this.tasks = tasks;
        this.clock = clock;
    }

    /** Today in the firm's zone. */
    public LocalDate today() {
        return clock.today();
    }

    @Transactional(readOnly = true)
    public boolean hasTasks() {
        return tasks.count() > 0;
    }

    /** A pending task; {@code dueDate} and {@code caseId} may be {@code null}. */
    @Transactional
    public UUID createTask(UUID createdBy, UUID responsibleUserId, String title, LocalDate dueDate, UUID caseId) {
        TaskData data = new TaskData(title, null, dueDate, responsibleUserId, caseId, null);
        return tasks.save(Task.create(createdBy, data, caseId, clock.now())).getId();
    }
}
