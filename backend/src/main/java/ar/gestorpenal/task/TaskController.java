package ar.gestorpenal.task;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Tasks of the firm. There is no delete: a task is archived. */
@RestController
@RequestMapping("/api/v1/tasks")
class TaskController {

    private final TaskService tasks;

    TaskController(TaskService tasks) {
        this.tasks = tasks;
    }

    @PostMapping
    ResponseEntity<TaskView> create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody TaskData body) {
        TaskView created = tasks.create(user, body);
        return ResponseEntity.created(URI.create("/api/v1/tasks/" + created.id())).body(created);
    }

    /**
     * Overdue first, then the soonest due day. {@code scope=mine} lists the tasks the user is
     * responsible for; the other filters narrow the list further.
     */
    @GetMapping
    TaskPage search(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) UUID responsible,
            @RequestParam(required = false) UUID caseId,
            @RequestParam(required = false) UUID hearingId,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(defaultValue = "false") boolean overdue,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueOn,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        TaskFilter filter =
                new TaskFilter(scope, responsible, caseId, hearingId, status, overdue, dueOn, includeArchived);
        return tasks.search(user, filter, page, size);
    }

    @GetMapping("/{id}")
    TaskView one(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return tasks.get(user, id);
    }

    @PutMapping("/{id}")
    TaskView update(
            @AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id, @Valid @RequestBody TaskData body) {
        return tasks.update(user, id, body);
    }

    @PostMapping("/{id}/done")
    TaskView done(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return tasks.markDone(user, id);
    }

    @PostMapping("/{id}/reopen")
    TaskView reopen(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return tasks.reopen(user, id);
    }

    @PostMapping("/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        tasks.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        tasks.restore(user, id);
        return ResponseEntity.noContent().build();
    }
}
