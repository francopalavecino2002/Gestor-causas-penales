package ar.gestorpenal.mail;

/**
 * The port to whatever delivers email (ADR-0048). {@link SmtpMailTransport} talks to any SMTP provider;
 * {@link LoggingMailTransport} stands in when none is configured.
 */
interface MailTransport {

    /** Delivers the message, or throws {@link MailTransportException} when it could not. */
    void deliver(MailMessage message);

    /** Whether a call to {@link #deliver} really sends the message. */
    boolean sends();
}
