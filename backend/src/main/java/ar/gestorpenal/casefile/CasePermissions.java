package ar.gestorpenal.casefile;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;

/**
 * Who may do what with cases (ADR-0015).
 *
 * <ul>
 *   <li>A reserved case exists only for its active team and the owner; a normal case for every member.
 *   <li>Whoever can see a case creates and edits it, its defendants, charges and parties.
 *   <li>Only the owner or the case's responsible lawyer changes the team or the reserved flag.
 *   <li>Only the owner and lawyers archive or restore a case.
 * </ul>
 */
final class CasePermissions {

    private CasePermissions() {}

    /** The owner sees every case, reserved ones included. */
    static boolean seesEveryCase(AuthenticatedUser user) {
        return user.role() == Role.OWNER;
    }

    /** Whether the user sees the case whatever its team: a normal case, or any case for the owner. */
    static boolean canSeeWithoutTeam(AuthenticatedUser user, boolean caseIsReserved) {
        return !caseIsReserved || seesEveryCase(user);
    }

    /** {@code responsibleUserId} is the case's current responsible, or {@code null} if there is none. */
    static void requireCanManageTeam(AuthenticatedUser user, UUID responsibleUserId) {
        if (!seesEveryCase(user) && !user.userId().equals(responsibleUserId)) {
            throw new AccessDeniedException("Only the owner or the responsible lawyer can change the team or reserve a case");
        }
    }

    static void requireCanArchive(AuthenticatedUser user) {
        if (user.role() != Role.OWNER && user.role() != Role.LAWYER) {
            throw new AccessDeniedException("Only the owner and lawyers can archive or restore cases");
        }
    }

    /** The responsible of a case is a lawyer or the owner. */
    static boolean canBeResponsible(Role role) {
        return role == Role.OWNER || role == Role.LAWYER;
    }
}
