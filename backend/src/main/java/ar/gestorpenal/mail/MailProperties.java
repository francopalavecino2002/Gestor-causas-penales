package ar.gestorpenal.mail;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Outbound email of this installation (ADR-0048). Without an SMTP host nothing is sent: each email is
 * logged (without its body) and recorded as {@link MailOutcome#LOGGED}.
 *
 * @param from the sender address; the display name is the firm's name
 * @param smtp the SMTP server; a blank host turns sending off
 */
@ConfigurationProperties("app.mail")
record MailProperties(@DefaultValue("no-reply@localhost") String from, @DefaultValue Smtp smtp) {

    boolean smtpConfigured() {
        return smtp.host() != null && !smtp.host().isBlank();
    }

    /**
     * @param security {@code STARTTLS} (port 587), {@code TLS} (implicit, port 465) or {@code NONE}
     *     (only for a local test server such as Mailpit)
     * @param username blank means no authentication
     * @param timeout connection, read and write timeout
     */
    record Smtp(
            @DefaultValue("") String host,
            @DefaultValue("587") int port,
            @DefaultValue("") String username,
            @DefaultValue("") String password,
            @DefaultValue("STARTTLS") Security security,
            @DefaultValue("10s") Duration timeout) {

        /** Whether the server runs on this machine, the only place where {@link Security#NONE} is allowed. */
        boolean onLoopback() {
            return host.equals("localhost") || host.equals("127.0.0.1") || host.equals("::1");
        }

        /** Never prints the password: properties end up in logs and binding errors. */
        @Override
        public String toString() {
            return "Smtp[host=" + host + ", port=" + port + ", username=" + username + ", password="
                    + (password.isEmpty() ? "" : "***") + ", security=" + security + ", timeout=" + timeout + "]";
        }
    }

    enum Security {
        NONE,
        STARTTLS,
        TLS
    }
}
