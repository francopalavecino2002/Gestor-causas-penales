package ar.gestorpenal.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.mail.MailProperties.Security;
import ar.gestorpenal.mail.MailProperties.Smtp;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.net.ServerSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The SMTP adapter against a real SMTP server (GreenMail, in process, on a free port): authentication,
 * the firm's name as sender, the Spanish subject, and both the plain-text and the HTML part.
 */
@SpringBootTest(properties = {
    "app.mail.from=avisos@gestor.test",
    "app.mail.smtp.host=127.0.0.1",
    "app.mail.smtp.security=NONE",
    "app.mail.smtp.username=usuario-ficticio",
    "app.mail.smtp.password=clave-ficticia-smtp"
})
@Import(TestcontainersConfiguration.class)
class SmtpMailDeliveryTests {

    @RegisterExtension
    static final GreenMailExtension SMTP = new GreenMailExtension(ServerSetupTest.SMTP.dynamicPort())
            .withConfiguration(GreenMailConfiguration.aConfig()
                    .withUser("avisos@gestor.test", "usuario-ficticio", "clave-ficticia-smtp"))
            .withPerMethodLifecycle(false);

    @DynamicPropertySource
    static void smtpPort(DynamicPropertyRegistry registry) {
        registry.add("app.mail.smtp.port", () -> SMTP.getSmtp().getPort());
    }

    @Autowired
    Mailer mailer;

    @Autowired
    TenantService tenants;

    @Autowired
    MailDeliveryRepository deliveries;

    private UUID tenant;

    @BeforeEach
    void setUp() throws Exception {
        SMTP.purgeEmailFromAllMailboxes();
        tenant = tenants.create("Estudio Ficticio Ñandú & Asoc.", "nandu-" + UUID.randomUUID().toString().substring(0, 8))
                .id();
    }

    @Test
    void shouldSendBothPartsFromTheFirmThroughTheSmtpServer() throws Exception {
        MailOutcome outcome = TenantContext.callAs(tenant, () -> mailer.send(
                ConnectionTestMail.TEMPLATE, "titular@ejemplo.test", Map.of("displayName", "Titular <Ficticia>")));

        assertThat(outcome).isEqualTo(MailOutcome.SENT);
        MimeMessage[] received = SMTP.getReceivedMessages();
        assertThat(received).hasSize(1);
        MimeMessage message = received[0];
        InternetAddress from = (InternetAddress) message.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("avisos@gestor.test");
        assertThat(from.getPersonal()).isEqualTo("Estudio Ficticio Ñandú & Asoc.");
        assertThat(message.getAllRecipients()).extracting(Object::toString).containsExactly("titular@ejemplo.test");
        assertThat(message.getSubject()).isEqualTo("Correo de prueba de Estudio Ficticio Ñandú & Asoc.");

        List<BodyPart> parts = leafParts((Multipart) message.getContent());
        assertThat(parts).extracting(part -> part.getContentType().toLowerCase().split(";")[0])
                .containsExactly("text/plain", "text/html");
        assertThat((String) parts.get(0).getContent()).contains("Hola, Titular <Ficticia>:");
        assertThat((String) parts.get(1).getContent())
                .contains("Hola, Titular &lt;Ficticia&gt;:")
                .contains("Estudio Ficticio Ñandú &amp; Asoc.");

        assertThat(TenantContext.callAs(tenant, () -> deliveries.findAllByOrderByAttemptedAtDesc()))
                .singleElement()
                .extracting(MailDelivery::getOutcome)
                .isEqualTo(MailOutcome.SENT);
    }

    @Test
    void shouldKeepAFirmNameWithLineBreaksInsideTheSenderHeader() throws Exception {
        UUID oddFirm = tenants.create("Estudio Raro\r\nBcc: otra@ejemplo.test", "raro-" + UUID.randomUUID().toString()
                        .substring(0, 8)).id();

        MailOutcome outcome = TenantContext.callAs(oddFirm, () -> mailer.send(
                ConnectionTestMail.TEMPLATE, "titular@ejemplo.test", Map.of("displayName", "Ficticia")));

        assertThat(outcome).isEqualTo(MailOutcome.SENT);
        MimeMessage message = SMTP.getReceivedMessages()[0];
        assertThat(message.getAllRecipients()).extracting(Object::toString).containsExactly("titular@ejemplo.test");
        assertThat(message.getHeader("Bcc")).isNull();
        assertThat(((InternetAddress) message.getFrom()[0]).getPersonal())
                .isEqualTo("Estudio Raro Bcc: otra@ejemplo.test");
    }

    @Test
    void shouldFailWhenTheServerCannotBeReached() throws IOException {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            closedPort = socket.getLocalPort();
        }
        SmtpMailTransport transport = new SmtpMailTransport(new MailProperties(
                "avisos@gestor.test", new Smtp("127.0.0.1", closedPort, "", "", Security.NONE, Duration.ofSeconds(2))));

        assertThatThrownBy(() -> transport.deliver(new MailMessage(
                        "connection-test", "Estudio Ficticio", "titular@ejemplo.test", "Asunto", "<p>Hola</p>", "Hola")))
                .isInstanceOf(MailTransportException.class);
    }

    /** The text and HTML parts, in order, however deep the multipart nesting is. */
    private static List<BodyPart> leafParts(Multipart multipart) throws Exception {
        List<BodyPart> leaves = new ArrayList<>();
        for (int i = 0; i < multipart.getCount(); i++) {
            BodyPart part = multipart.getBodyPart(i);
            if (part.getContent() instanceof Multipart nested) {
                leaves.addAll(leafParts(nested));
            } else {
                leaves.add(part);
            }
        }
        return leaves;
    }
}
