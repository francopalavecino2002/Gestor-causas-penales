package ar.gestorpenal.security;

import org.springframework.security.core.AuthenticationException;

/** There is no pending login in this session, or it is older than its time limit. */
class SecondFactorExpiredException extends AuthenticationException {

    SecondFactorExpiredException() {
        super("There is no pending login to complete");
    }
}
