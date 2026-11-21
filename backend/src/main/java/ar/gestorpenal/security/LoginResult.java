package ar.gestorpenal.security;

/** Outcome of a valid password: either the user is in, or a second factor is still needed. */
sealed interface LoginResult {

    record Authenticated(AuthenticatedUser user) implements LoginResult {}

    record SecondFactorRequired(PendingSecondFactor pending) implements LoginResult {}
}
