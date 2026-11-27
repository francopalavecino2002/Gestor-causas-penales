package ar.gestorpenal.mail;

/** What happened to an email. Callers decide what to tell the user; the {@link Mailer} never throws for it. */
public enum MailOutcome {
    /** The SMTP server accepted it. */
    SENT,
    /** No SMTP server is configured: it was logged instead (without its body). */
    LOGGED,
    /** The SMTP server could not be reached or refused it. */
    FAILED
}
