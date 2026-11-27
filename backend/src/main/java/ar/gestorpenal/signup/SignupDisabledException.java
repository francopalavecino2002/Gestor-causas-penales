package ar.gestorpenal.signup;

/** Self sign-up is off ({@code APP_SIGNUP_ENABLED} is not true): the endpoint answers as if it did not exist. */
class SignupDisabledException extends RuntimeException {

    SignupDisabledException() {
        super("Self sign-up is disabled");
    }
}
