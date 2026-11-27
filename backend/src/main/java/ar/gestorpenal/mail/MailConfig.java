package ar.gestorpenal.mail;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Picks the adapter of the mail port from the environment (ADR-0048). */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MailProperties.class)
class MailConfig {

    @Bean
    MailTransport mailTransport(MailProperties properties) {
        if (!properties.smtpConfigured()) {
            return new LoggingMailTransport();
        }
        if (properties.from().isBlank() || properties.from().endsWith("@localhost")) {
            // A provider rejects it, and every email would quietly end up FAILED.
            throw new IllegalStateException("MAIL_SMTP_HOST is set: set MAIL_FROM to an address of a verified domain");
        }
        if (properties.smtp().security() == MailProperties.Security.NONE && !properties.smtp().onLoopback()) {
            // Without TLS the SMTP password and every email would cross the network in clear text.
            throw new IllegalStateException("MAIL_SMTP_SECURITY=NONE is only allowed with a local server (localhost)");
        }
        return new SmtpMailTransport(properties);
    }
}
