package ar.gestorpenal.mail;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.stereotype.Service;

/**
 * A test email the owner sends to their own address to check the installation's mail settings
 * (ADR-0048). Only to themselves, so it cannot be used to mail anyone else, and a few per hour.
 */
@Service
class ConnectionTestMail {

    static final MailTemplate TEMPLATE = new MailTemplate("connection-test", "Correo de prueba de {{firmName}}");
    static final int MAX_PER_HOUR = 5;

    private final Mailer mailer;
    private final MailDeliveryRepository deliveries;
    private final UserRepository users;
    private final Clock clock;

    ConnectionTestMail(Mailer mailer, MailDeliveryRepository deliveries, UserRepository users, Clock clock) {
        this.mailer = mailer;
        this.deliveries = deliveries;
        this.users = users;
        this.clock = clock;
    }

    ConnectionTestResult sendToOwner(AuthenticatedUser principal) {
        if (principal.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the firm owner can send a test email");
        }
        if (deliveries.countByTemplateAndAttemptedAtAfter(TEMPLATE.name(), clock.instant().minus(Duration.ofHours(1)))
                >= MAX_PER_HOUR) {
            throw new MailTestRateLimitedException();
        }
        AppUser owner = users.findById(principal.userId())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new InsufficientAuthenticationException("The user is no longer active"));
        MailOutcome outcome = mailer.send(TEMPLATE, owner.getEmail(), Map.of("displayName", owner.getDisplayName()));
        return new ConnectionTestResult(outcome, owner.getEmail());
    }

    record ConnectionTestResult(MailOutcome outcome, String recipient) {}
}
