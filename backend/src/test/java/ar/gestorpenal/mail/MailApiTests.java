package ar.gestorpenal.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The mailer without an SMTP server (the default): emails are logged, every attempt is recorded and
 * audited without the body, per firm; and the owner's test email through the real filter chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, MailApiTests.SwitchableTransportConfig.class})
class MailApiTests {

    private static final String PASSWORD = "clave-ficticia-larga";

    /** The SPA's double-submit token (see CLAUDE.md, Lessons). */
    private static final RequestPostProcessor CSRF = request -> {
        String token = UUID.randomUUID().toString();
        request.setCookies(new Cookie("XSRF-TOKEN", token));
        request.addHeader("X-XSRF-TOKEN", token);
        return request;
    };

    @TestConfiguration(proxyBeanMethods = false)
    static class SwitchableTransportConfig {

        @Bean
        @Primary
        SwitchableTransport switchableTransport() {
            return new SwitchableTransport();
        }
    }

    /** The default logging adapter, or a server that is down when the test says so. */
    static class SwitchableTransport implements MailTransport {

        private final LoggingMailTransport logging = new LoggingMailTransport();
        boolean down;

        @Override
        public void deliver(MailMessage message) {
            if (down) {
                throw new MailTransportException("connection refused", new IllegalStateException("down"));
            }
            logging.deliver(message);
        }

        @Override
        public boolean sends() {
            return logging.sends();
        }
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TenantService tenants;

    @Autowired
    UserService userService;

    @Autowired
    Mailer mailer;

    @Autowired
    MailDeliveryRepository deliveries;

    @Autowired
    AuditTrail auditTrail;

    @Autowired
    SwitchableTransport transport;

    private UUID tenantA;
    private UUID tenantB;
    private RequestPostProcessor owner;
    private RequestPostProcessor lawyer;

    @BeforeEach
    void setUp() {
        transport.down = false;
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        owner = loggedIn(user(tenantA, "titular@ejemplo.test", Role.OWNER));
        lawyer = loggedIn(user(tenantA, "abogado@ejemplo.test", Role.LAWYER));
    }

    @Test
    void shouldLogTheEmailAndRecordTheAttemptWithoutTheBody() {
        MailOutcome outcome = TenantContext.callAs(tenantA, () -> mailer.send(
                ConnectionTestMail.TEMPLATE, "  destinataria@ejemplo.test ", Map.of("displayName", "Ficticia")));

        assertThat(outcome).isEqualTo(MailOutcome.LOGGED);
        MailDelivery delivery = TenantContext.callAs(tenantA, () -> deliveries.findAllByOrderByAttemptedAtDesc())
                .getFirst();
        assertThat(delivery.getTemplate()).isEqualTo("connection-test");
        assertThat(delivery.getRecipient()).isEqualTo("destinataria@ejemplo.test");
        assertThat(delivery.getSubject()).isEqualTo("Correo de prueba de Estudio Ficticio Alfa");
        assertThat(delivery.getOutcome()).isEqualTo(MailOutcome.LOGGED);

        List<AuditEvent> history =
                TenantContext.callAs(tenantA, () -> auditTrail.historyOf(MailDelivery.class, delivery.getId()));
        assertThat(history).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(AuditAction.CREATE);
            assertThat(event.getChanges())
                    .extracting(FieldChange::field)
                    .containsExactlyInAnyOrder("template", "recipient", "subject", "outcome", "attemptedAt");
            assertThat(event.getChanges())
                    .extracting(FieldChange::newValue)
                    .noneMatch(value -> value.contains("Hola") || value.contains("correo de prueba."));
        });
    }

    @Test
    void shouldRecordAFailedDeliveryInsteadOfThrowing() {
        transport.down = true;

        MailOutcome outcome = TenantContext.callAs(tenantA, () -> mailer.send(
                ConnectionTestMail.TEMPLATE, "destinataria@ejemplo.test", Map.of("displayName", "Ficticia")));

        assertThat(outcome).isEqualTo(MailOutcome.FAILED);
        assertThat(TenantContext.callAs(tenantA, () -> deliveries.findAllByOrderByAttemptedAtDesc()))
                .singleElement()
                .extracting(MailDelivery::getOutcome)
                .isEqualTo(MailOutcome.FAILED);
    }

    @Test
    void shouldKeepEachFirmsDeliveriesApart() {
        TenantContext.runAs(tenantA, () -> mailer.send(
                ConnectionTestMail.TEMPLATE, "destinataria@ejemplo.test", Map.of("displayName", "Ficticia")));

        assertThat(TenantContext.callAs(tenantB, () -> deliveries.findAllByOrderByAttemptedAtDesc())).isEmpty();
    }

    @Test
    void shouldRejectARecipientThatIsNotOnePlainAddress() {
        for (String recipient : List.of(
                "no-es-un-correo", "Ficticia <ficticia@ejemplo.test>", "a@ejemplo.test, b@ejemplo.test", " ")) {
            assertThatIllegalArgumentException().isThrownBy(() -> TenantContext.runAs(tenantA, () -> mailer.send(
                    ConnectionTestMail.TEMPLATE, recipient, Map.of("displayName", "Ficticia"))));
        }
        assertThat(TenantContext.callAs(tenantA, () -> deliveries.findAllByOrderByAttemptedAtDesc())).isEmpty();
    }

    @Test
    void shouldSendTheOwnerATestEmailToTheirOwnAddress() throws Exception {
        sendTest(owner)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("LOGGED"))
                .andExpect(jsonPath("$.recipient").value("titular@ejemplo.test"));
    }

    @Test
    void shouldLetOnlyTheOwnerSendATestEmail() throws Exception {
        sendTest(lawyer).andExpect(status().isForbidden());

        assertThat(TenantContext.callAs(tenantA, () -> deliveries.findAllByOrderByAttemptedAtDesc())).isEmpty();
    }

    @Test
    void shouldLimitTheTestEmailsPerHour() throws Exception {
        for (int i = 0; i < ConnectionTestMail.MAX_PER_HOUR; i++) {
            sendTest(owner).andExpect(status().isOk());
        }

        sendTest(owner)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.type").value("/problems/mail-test-rate-limited"));
    }

    @Test
    void shouldRequireLoginForATestEmail() throws Exception {
        mockMvc.perform(post("/api/v1/mail/test").with(CSRF)).andExpect(status().isUnauthorized());
    }

    private ResultActions sendTest(RequestPostProcessor user) throws Exception {
        return mockMvc.perform(post("/api/v1/mail/test").with(user).with(CSRF));
    }

    private AppUser user(UUID tenantId, String email, Role role) {
        return TenantContext.callAs(
                tenantId, () -> userService.createUser(email, "Persona Ficticia", PASSWORD, role));
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal =
                new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }
}
