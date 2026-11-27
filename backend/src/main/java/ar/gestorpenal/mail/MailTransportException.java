package ar.gestorpenal.mail;

/** The mail server could not be reached or did not accept a message. */
class MailTransportException extends RuntimeException {

    MailTransportException(String message, Throwable cause) {
        super(message, cause);
    }
}
