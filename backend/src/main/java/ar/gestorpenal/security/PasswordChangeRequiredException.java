package ar.gestorpenal.security;

import org.springframework.security.access.AccessDeniedException;

/** The user still has the temporary password the owner gave them: only changing it is allowed. */
class PasswordChangeRequiredException extends AccessDeniedException {

    PasswordChangeRequiredException() {
        super("Choose your own password before using the app");
    }
}
