package ar.gestorpenal.mail;

import ar.gestorpenal.mail.MailRenderer.Rendered;
import ar.gestorpenal.tenancy.TenantService;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import java.time.Clock;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The one way the system sends email (ADR-0048), always on behalf of the firm in scope (the logged-in
 * user's, or an explicit {@code TenantContext}). It renders the template with the firm's name, hands it to
 * the configured {@link MailTransport} and records the attempt without the body. A failed delivery is an
 * outcome, not an exception: callers such as password recovery must answer the same either way.
 *
 * <p>Sending is synchronous and can take up to the SMTP timeout: call it after the caller's own
 * transaction has committed, not inside it. The attempt is recorded in a transaction of its own, so it
 * is kept even if the caller's transaction rolls back after the email went out.
 */
@Service
public class Mailer {

    private static final Logger log = LoggerFactory.getLogger(Mailer.class);

    private final MailTransport transport;
    private final MailRenderer renderer;
    private final MailDeliveryRepository deliveries;
    private final TenantService tenants;
    private final TransactionTemplate ownTransaction;
    private final Clock clock;

    Mailer(
            MailTransport transport,
            MailRenderer renderer,
            MailDeliveryRepository deliveries,
            TenantService tenants,
            PlatformTransactionManager transactionManager,
            Clock clock) {
        this.transport = transport;
        this.renderer = renderer;
        this.deliveries = deliveries;
        this.tenants = tenants;
        this.ownTransaction = new TransactionTemplate(transactionManager);
        this.ownTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
    }

    /**
     * Sends {@code template} to {@code recipient}, a single address of someone the firm knows (a user),
     * never an address typed by an anonymous visitor without a limit in front.
     *
     * @throws IllegalArgumentException when {@code recipient} is not one plain email address
     */
    public MailOutcome send(MailTemplate template, String recipient, Map<String, String> values) {
        String address = plainAddress(recipient);
        String firmName = tenants.currentFirmName();
        Rendered rendered = renderer.render(template, firmName, values);
        MailMessage message = new MailMessage(
                template.name(), MailRenderer.oneLine(firmName), address, rendered.subject(), rendered.html(),
                rendered.text());
        MailOutcome outcome = deliver(message);
        ownTransaction.executeWithoutResult(status -> deliveries.save(
                MailDelivery.of(template.name(), address, rendered.subject(), outcome, clock.instant())));
        return outcome;
    }

    private MailOutcome deliver(MailMessage message) {
        try {
            transport.deliver(message);
            return transport.sends() ? MailOutcome.SENT : MailOutcome.LOGGED;
        } catch (MailTransportException exception) {
            // Only the exception type: SMTP replies often echo the full address or the username.
            log.warn("Email not delivered: template={} to={} cause={}",
                    message.template(),
                    LoggingMailTransport.masked(message.recipient()),
                    exception.getCause() == null ? "unknown" : exception.getCause().getClass().getName());
            return MailOutcome.FAILED;
        }
    }

    /** One address without a display name or line breaks, as the SMTP envelope needs it. */
    private static String plainAddress(String recipient) {
        if (recipient == null || recipient.isBlank()) {
            throw new IllegalArgumentException("An email needs a recipient");
        }
        try {
            InternetAddress address = new InternetAddress(recipient.strip(), true);
            if (address.getPersonal() != null || address.isGroup()) {
                throw new IllegalArgumentException("The recipient must be a plain email address");
            }
            return address.getAddress();
        } catch (AddressException exception) {
            throw new IllegalArgumentException("The recipient is not a valid email address", exception);
        }
    }
}
