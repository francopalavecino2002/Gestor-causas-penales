package ar.gestorpenal.hosting;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Refuses to start the {@code prod} profile with a setting that is only safe on a developer's
 * machine (ADR-0046): the dev or demo profile, session cookies without {@code Secure}, Hibernate
 * changing the schema, the fictitious development TOTP key, or emails with links that are not
 * HTTPS. A wrong environment variable then
 * fails the deployment instead of weakening a live firm.
 */
@Component
@Profile("prod")
class ProductionSafetyCheck {

    /** The fictitious key of application-dev.properties. */
    static final String DEV_TOTP_KEY = "ZGV2LW9ubHktdG90cC1rZXktbm90LWZvci1wcm9kISE=";

    private static final Set<String> LOCAL_PROFILES = Set.of("dev", "demo");
    private static final Set<String> SAFE_DDL_MODES = Set.of("validate", "none");

    ProductionSafetyCheck(Environment environment) {
        List<String> problems = problems(environment);
        if (!problems.isEmpty()) {
            throw new IllegalStateException(
                    "Unsafe production configuration: " + String.join("; ", problems));
        }
    }

    static List<String> problems(Environment environment) {
        List<String> problems = new ArrayList<>();
        Arrays.stream(environment.getActiveProfiles())
                .filter(LOCAL_PROFILES::contains)
                .forEach(profile -> problems.add("profile '" + profile + "' is active"));
        if (!environment.getProperty("server.servlet.session.cookie.secure", Boolean.class, true)) {
            problems.add("session cookies are not Secure");
        }
        String ddl = environment.getProperty("spring.jpa.hibernate.ddl-auto", "validate");
        if (!SAFE_DDL_MODES.contains(ddl)) {
            problems.add("spring.jpa.hibernate.ddl-auto is '" + ddl + "' (only Flyway changes the schema)");
        }
        if (DEV_TOTP_KEY.equals(environment.getProperty("app.security.two-factor.encryption-key"))) {
            problems.add("TOTP_ENCRYPTION_KEY is the development key");
        }
        // Emails carry links to the app (ADR-0049): once they are really sent, the links must be HTTPS.
        String smtpHost = environment.getProperty("app.mail.smtp.host", "");
        String publicUrl = environment.getProperty("app.public-url", "");
        if (!smtpHost.isBlank() && !publicUrl.startsWith("https://")) {
            problems.add("MAIL_SMTP_HOST is set but APP_PUBLIC_URL is not an https:// address");
        }
        return problems;
    }
}
