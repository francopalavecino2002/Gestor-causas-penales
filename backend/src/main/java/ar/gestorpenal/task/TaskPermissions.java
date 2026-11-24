package ar.gestorpenal.task;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import org.springframework.security.access.AccessDeniedException;

/**
 * Who may do what with tasks.
 *
 * <ul>
 *   <li>Every member creates tasks and marks any task done or pending again.
 *   <li>Only the creator, the responsible, the owner and lawyers edit, archive or restore a task.
 * </ul>
 */
final class TaskPermissions {

    private TaskPermissions() {}

    static void requireCanManage(AuthenticatedUser user, Task task) {
        boolean allowed = user.role() == Role.OWNER
                || user.role() == Role.LAWYER
                || user.userId().equals(task.getCreatedBy())
                || user.userId().equals(task.getResponsibleUserId());
        if (!allowed) {
            throw new AccessDeniedException("Only the creator, the responsible, the owner and lawyers can change this task");
        }
    }
}
