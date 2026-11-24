package ar.gestorpenal.task;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.hearing.HearingRef;
import ar.gestorpenal.hearing.Hearings;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tasks of the current firm. A task is reached through its case when it has one, so a task of a
 * reserved case the user cannot see is "not found". Every member creates tasks and changes their
 * status; the creator, the responsible, the owner and lawyers edit, archive and restore them
 * ({@link TaskPermissions}).
 */
@Service
class TaskService {

    static final int MAX_PAGE_SIZE = 100;

    /** Placeholders for the filters that are off: the query never receives a null. */
    private static final UUID NO_ID = new UUID(0, 0);

    private final TaskRepository tasks;
    private final TaskViews views;
    private final TaskClock clock;
    private final UserRepository users;
    private final Cases cases;
    private final Hearings hearings;

    TaskService(
            TaskRepository tasks,
            TaskViews views,
            TaskClock clock,
            UserRepository users,
            Cases cases,
            Hearings hearings) {
        this.tasks = tasks;
        this.views = views;
        this.clock = clock;
        this.users = users;
        this.cases = cases;
        this.hearings = hearings;
    }

    @Transactional
    TaskView create(AuthenticatedUser user, TaskData data) {
        UUID caseId = resolveCase(user, data, null);
        requireActiveMember(data.responsibleUserId());
        Task task = tasks.saveAndFlush(Task.create(user.userId(), data, caseId, clock.now()));
        return views.of(user, task);
    }

    @Transactional(readOnly = true)
    TaskView get(AuthenticatedUser user, UUID id) {
        return views.of(user, find(user, id));
    }

    @Transactional(readOnly = true)
    TaskPage search(AuthenticatedUser user, TaskFilter filter, int page, int size) {
        boolean mine = isMine(filter.scope());
        if (mine && filter.responsibleId() != null && !filter.responsibleId().equals(user.userId())) {
            throw new InvalidTaskDataException("scope=mine cannot be combined with another responsible");
        }
        UUID responsibleId = mine ? user.userId() : filter.responsibleId();
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<Task> found = tasks.search(
                filter.includeArchived(),
                responsibleId != null,
                responsibleId == null ? NO_ID : responsibleId,
                filter.caseId() != null,
                filter.caseId() == null ? NO_ID : filter.caseId(),
                filter.hearingId() != null,
                filter.hearingId() == null ? NO_ID : filter.hearingId(),
                filter.status() != null,
                filter.status() == null ? TaskStatus.PENDING : filter.status(),
                filter.overdue(),
                filter.dueOn() != null,
                filter.dueOn() == null ? LocalDate.EPOCH : filter.dueOn(),
                clock.today(),
                cases.seesEveryCase(user),
                user.userId(),
                pageRequest);
        return new TaskPage(views.of(user, found.getContent()), found.getNumber(), found.getSize(), found.getTotalElements());
    }

    /** Replaces the title, notes, due day, responsible and links; the status has its own actions. */
    @Transactional
    TaskView update(AuthenticatedUser user, UUID id, TaskData data) {
        Task task = find(user, id);
        TaskPermissions.requireCanManage(user, task);
        requireNotArchived(task);
        UUID caseId = resolveCase(user, data, task);
        if (!data.responsibleUserId().equals(task.getResponsibleUserId())) {
            requireActiveMember(data.responsibleUserId());
        }
        task.apply(data, caseId);
        tasks.flush();
        return views.of(user, task);
    }

    @Transactional
    TaskView markDone(AuthenticatedUser user, UUID id) {
        Task task = find(user, id);
        requireNotArchived(task);
        task.markDone(clock.now());
        tasks.flush();
        return views.of(user, task);
    }

    @Transactional
    TaskView reopen(AuthenticatedUser user, UUID id) {
        Task task = find(user, id);
        requireNotArchived(task);
        task.reopen();
        tasks.flush();
        return views.of(user, task);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        Task task = find(user, id);
        TaskPermissions.requireCanManage(user, task);
        task.archive(clock.now());
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        Task task = find(user, id);
        TaskPermissions.requireCanManage(user, task);
        task.restore();
    }

    /**
     * The case the data links to: the hearing's case when a hearing is given (it must match a case that
     * is also given), else the given case, else none. Another firm's case or hearing, or one of a reserved
     * case the user cannot see, is "not found". A link to an archived case or hearing is only accepted
     * when {@code current} already had it.
     */
    private UUID resolveCase(AuthenticatedUser user, TaskData data, Task current) {
        UUID caseId = data.caseId();
        if (data.hearingId() != null) {
            HearingRef hearing = hearings.findAll(List.of(data.hearingId())).get(data.hearingId());
            // A hearing of a reserved case the user cannot see answers exactly like a missing one.
            if (hearing == null || cases.findVisible(user, hearing.caseId()).isEmpty()) {
                throw new TaskNotFoundException("There is no hearing " + data.hearingId());
            }
            if (caseId != null && !caseId.equals(hearing.caseId())) {
                throw new InvalidTaskDataException("The hearing is not in the task's case");
            }
            if (hearing.archived() && (current == null || !data.hearingId().equals(current.getHearingId()))) {
                throw new ArchivedTaskRecordException("The hearing is archived: restore it before linking a task to it");
            }
            caseId = hearing.caseId();
        }
        if (caseId == null) {
            return null;
        }
        CaseRef caseRef = visibleCase(user, caseId);
        if (caseRef.archived() && (current == null || !caseId.equals(current.getCaseId()))) {
            throw new ArchivedTaskRecordException("The case is archived: restore it before linking a task to it");
        }
        return caseId;
    }

    private CaseRef visibleCase(AuthenticatedUser user, UUID caseId) {
        return cases.findVisible(user, caseId).orElseThrow(() -> new TaskNotFoundException("There is no case " + caseId));
    }

    private void requireActiveMember(UUID userId) {
        users.findById(userId)
                .filter(AppUser::isActive)
                .orElseThrow(() -> new InvalidTaskDataException("The responsible is not an active member of the firm"));
    }

    private Task find(AuthenticatedUser user, UUID id) {
        // A task of a reserved case the user cannot see answers exactly like a missing one.
        return tasks.findById(id)
                .filter(task -> task.getCaseId() == null || cases.findVisible(user, task.getCaseId()).isPresent())
                .orElseThrow(() -> new TaskNotFoundException("There is no task " + id));
    }

    private static void requireNotArchived(Task task) {
        if (task.isArchived()) {
            throw new ArchivedTaskRecordException("The task is archived: restore it before changing it");
        }
    }

    private static boolean isMine(String scope) {
        if (scope == null) {
            return false;
        }
        return switch (scope.toLowerCase(Locale.ROOT)) {
            case "mine" -> true;
            case "all" -> false;
            default -> throw new InvalidTaskDataException("scope must be 'mine' or 'all'");
        };
    }
}
