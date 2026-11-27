package ar.gestorpenal.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import ar.gestorpenal.mail.MailProperties.Security;
import ar.gestorpenal.mail.MailProperties.Smtp;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class MailConfigTests {

    private final MailConfig config = new MailConfig();

    @Test
    void shouldLogInsteadOfSendingWithoutAnSmtpHost() {
        MailTransport transport = config.mailTransport(properties("no-reply@localhost", " "));

        assertThat(transport).isInstanceOf(LoggingMailTransport.class);
        assertThat(transport.sends()).isFalse();
    }

    @Test
    void shouldSendThroughSmtpWhenAHostIsSet() {
        MailTransport transport = config.mailTransport(properties("avisos@gestor.test", "smtp.ejemplo.test"));

        assertThat(transport).isInstanceOf(SmtpMailTransport.class);
        assertThat(transport.sends()).isTrue();
    }

    @Test
    void shouldRefuseToStartWithAnSmtpHostButNoRealSender() {
        assertThatIllegalStateException()
                .isThrownBy(() -> config.mailTransport(properties("no-reply@localhost", "smtp.ejemplo.test")))
                .withMessageContaining("MAIL_FROM");
    }

    @Test
    void shouldAllowAnUnencryptedServerOnlyOnThisMachine() {
        assertThat(config.mailTransport(properties("avisos@gestor.test", "localhost", Security.NONE)))
                .isInstanceOf(SmtpMailTransport.class);
        assertThatIllegalStateException()
                .isThrownBy(() -> config.mailTransport(properties("avisos@gestor.test", "smtp.ejemplo.test", Security.NONE)))
                .withMessageContaining("MAIL_SMTP_SECURITY=NONE");
    }

    @Test
    void shouldNotPrintTheSmtpPassword() {
        Smtp smtp = new Smtp("smtp.ejemplo.test", 587, "usuario", "clave-ficticia", Security.STARTTLS, Duration.ofSeconds(10));

        assertThat(smtp.toString()).doesNotContain("clave-ficticia").contains("password=***");
    }

    private static MailProperties properties(String from, String host) {
        return properties(from, host, Security.STARTTLS);
    }

    private static MailProperties properties(String from, String host, Security security) {
        return new MailProperties(from, new Smtp(host, 587, "", "", security, Duration.ofSeconds(10)));
    }
}
