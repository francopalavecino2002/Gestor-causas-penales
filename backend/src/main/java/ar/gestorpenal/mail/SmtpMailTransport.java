package ar.gestorpenal.mail;

import ar.gestorpenal.mail.MailProperties.Security;
import ar.gestorpenal.mail.MailProperties.Smtp;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

/**
 * Sends through any SMTP provider (ADR-0048): a multipart/alternative message with a plain-text and an
 * HTML part, from the configured address with the firm's name as display name.
 */
class SmtpMailTransport implements MailTransport {

    private final JavaMailSenderImpl sender;
    private final String fromAddress;

    SmtpMailTransport(MailProperties properties) {
        this.fromAddress = properties.from();
        this.sender = senderFor(properties.smtp());
    }

    private static JavaMailSenderImpl senderFor(Smtp smtp) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
        sender.setHost(smtp.host());
        sender.setPort(smtp.port());
        boolean authenticated = !smtp.username().isBlank();
        if (authenticated) {
            sender.setUsername(smtp.username());
            sender.setPassword(smtp.password());
        }
        String timeout = String.valueOf(smtp.timeout().toMillis());
        Properties settings = new Properties();
        settings.setProperty("mail.smtp.auth", String.valueOf(authenticated));
        settings.setProperty("mail.smtp.connectiontimeout", timeout);
        settings.setProperty("mail.smtp.timeout", timeout);
        settings.setProperty("mail.smtp.writetimeout", timeout);
        if (smtp.security() == Security.STARTTLS) {
            // Required, not opportunistic: credentials never travel in clear text.
            settings.setProperty("mail.smtp.starttls.enable", "true");
            settings.setProperty("mail.smtp.starttls.required", "true");
        }
        if (smtp.security() == Security.TLS) {
            sender.setProtocol("smtps");
            settings.setProperty("mail.smtps.auth", String.valueOf(authenticated));
            settings.setProperty("mail.smtps.connectiontimeout", timeout);
            settings.setProperty("mail.smtps.timeout", timeout);
            settings.setProperty("mail.smtps.writetimeout", timeout);
        }
        if (smtp.security() != Security.NONE) {
            settings.setProperty("mail.smtp.ssl.checkserveridentity", "true");
            settings.setProperty("mail.smtps.ssl.checkserveridentity", "true");
        }
        sender.setJavaMailProperties(settings);
        return sender;
    }

    @Override
    public void deliver(MailMessage message) {
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress, message.senderName());
            helper.setTo(message.recipient());
            helper.setSubject(message.subject());
            helper.setText(message.text(), message.html());
            sender.send(mime);
        } catch (MailException | MessagingException | UnsupportedEncodingException exception) {
            throw new MailTransportException("The SMTP server did not accept the email", exception);
        }
    }

    @Override
    public boolean sends() {
        return true;
    }
}
