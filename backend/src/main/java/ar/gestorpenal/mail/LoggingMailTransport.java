package ar.gestorpenal.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Stands in when no SMTP server is configured (ADR-0048): it writes one log line per email with the
 * template and a masked recipient, never the body, since a body can carry a one-time link.
 */
class LoggingMailTransport implements MailTransport {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailTransport.class);

    @Override
    public void deliver(MailMessage message) {
        log.info("Email not sent, no SMTP server configured: template={} to={}",
                message.template(), masked(message.recipient()));
    }

    @Override
    public boolean sends() {
        return false;
    }

    /** {@code t***@ejemplo.test}: enough to tell emails apart in a log, not to read the address. */
    static String masked(String address) {
        int at = address.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        return address.charAt(0) + "***" + address.substring(at);
    }
}
