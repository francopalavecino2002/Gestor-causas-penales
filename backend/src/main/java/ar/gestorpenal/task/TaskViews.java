package ar.gestorpenal.task;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.hearing.HearingRef;
import ar.gestorpenal.hearing.Hearings;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Builds {@link TaskView}s, loading the members, cases and hearings of a whole list at once. */
@Component
class TaskViews {

    private final UserRepository users;
    private final Cases cases;
    private final Hearings hearings;
    private final TaskClock clock;

    TaskViews(UserRepository users, Cases cases, Hearings hearings, TaskClock clock) {
        this.users = users;
        this.cases = cases;
        this.hearings = hearings;
        this.clock = clock;
    }

    TaskView of(AuthenticatedUser user, Task task) {
        return of(user, List.of(task)).get(0);
    }

    List<TaskView> of(AuthenticatedUser user, List<Task> tasks) {
        if (tasks.isEmpty()) {
            return List.of();
        }
        LocalDate today = clock.today();
        Map<UUID, AppUser> members = users.findAllById(ids(tasks, Task::getResponsibleUserId)).stream()
                .collect(Collectors.toMap(AppUser::getId, Function.identity()));
        Map<UUID, CaseRef> caseRefs = cases.findAll(user, ids(tasks, Task::getCaseId));
        Map<UUID, HearingRef> hearingRefs = hearings.findAll(ids(tasks, Task::getHearingId));
        Map<String, Map<String, String>> typeNamesByArea = new HashMap<>();
        return tasks.stream()
                .map(task -> view(task, today, members, caseRefs, hearingRefs, typeNamesByArea))
                .toList();
    }

    private TaskView view(
            Task task,
            LocalDate today,
            Map<UUID, AppUser> members,
            Map<UUID, CaseRef> caseRefs,
            Map<UUID, HearingRef> hearingRefs,
            Map<String, Map<String, String>> typeNamesByArea) {
        AppUser responsible = members.get(task.getResponsibleUserId());
        // Cases.findAll also returns reserved cases the user cannot see; those never show a caption or hearing.
        CaseRef caseRef = task.getCaseId() == null ? null : caseRefs.get(task.getCaseId());
        if (caseRef != null && !caseRef.visible()) {
            caseRef = null;
        }
        HearingRef hearing = task.getHearingId() == null ? null : hearingRefs.get(task.getHearingId());
        TaskView.HearingLink hearingLink = null;
        if (hearing != null && caseRef != null) {
            Map<String, String> names =
                    typeNamesByArea.computeIfAbsent(caseRef.practiceArea(), hearings::typeNames);
            hearingLink = new TaskView.HearingLink(
                    hearing.id(), hearing.typeCode(), names.getOrDefault(hearing.typeCode(), hearing.typeCode()),
                    hearing.startsAt());
        }
        return new TaskView(
                task.getId(),
                task.getTitle(),
                task.getNotes(),
                task.getDueDate(),
                task.getStatus(),
                task.isOverdue(today),
                task.getDoneAt(),
                new TaskView.MemberRef(task.getResponsibleUserId(), responsible.getDisplayName()),
                task.getCreatedBy(),
                caseRef == null ? null : new TaskView.CaseLink(caseRef.id(), caseRef.caption()),
                hearingLink,
                task.isArchived(),
                task.getCreatedAt());
    }

    private static List<UUID> ids(List<Task> tasks, Function<Task, UUID> id) {
        return tasks.stream().map(id).filter(Objects::nonNull).distinct().toList();
    }
}
