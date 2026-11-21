package ar.gestorpenal.security;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * Kept in the HTTP session between the password and the second factor. It is not an authentication:
 * the session has no security context until the code is accepted, so every protected endpoint still
 * answers 401.
 *
 * @param accountKey the throttle key of the password step, so both steps share one failure budget
 */
record PendingSecondFactor(UUID userId, UUID tenantId, String accountKey, Instant expiresAt)
        implements Serializable {

    static final String SESSION_ATTRIBUTE = PendingSecondFactor.class.getName();

    boolean isExpiredAt(Instant now) {
        return !now.isBefore(expiresAt);
    }
}
