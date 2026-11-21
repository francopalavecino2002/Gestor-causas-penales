package ar.gestorpenal.security;

import org.springframework.security.core.AuthenticationException;

/** The code sent in the second step of the login was not accepted. */
class InvalidSecondFactorException extends AuthenticationException {

    InvalidSecondFactorException() {
        super("The verification code is not valid");
    }
}
