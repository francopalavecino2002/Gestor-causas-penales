package ar.gestorpenal.mail;

/** The firm already sent {@link ConnectionTestMail#MAX_PER_HOUR} test emails in the last hour. */
class MailTestRateLimitedException extends RuntimeException {

    MailTestRateLimitedException() {
        super("Too many test emails: try again in an hour");
    }
}
