package ar.gestorpenal.person;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import org.springframework.security.access.AccessDeniedException;

/**
 * Who may do what with persons and clients (ADR-0014). Every member of the firm reads, creates and
 * edits; only the owner (titular) and lawyers archive and restore, because that hides a file from
 * everyone.
 */
final class Permissions {

    private Permissions() {}

    static void requireCanArchive(AuthenticatedUser user) {
        if (user.role() != Role.OWNER && user.role() != Role.LAWYER) {
            throw new AccessDeniedException("Only the owner and lawyers can archive or restore records");
        }
    }
}
