package ar.gestorpenal.mail;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * An email the system sends, by name: its body lives in {@code mail/<name>.html} and
 * {@code mail/<name>.txt} on the classpath, wrapped in the shared layout with the firm's name. Values
 * are written as {@code {{key}}}; the subject may use them too.
 *
 * @param name lowercase letters, digits and hyphens, e.g. {@code password-reset}
 * @param subject the Spanish subject line
 */
public record MailTemplate(String name, String subject) {

    private static final Pattern NAME = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");

    public MailTemplate {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(subject, "subject");
        if (!NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("Invalid mail template name: " + name);
        }
    }
}
