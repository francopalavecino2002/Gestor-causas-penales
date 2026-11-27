package ar.gestorpenal.signup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Firm self sign-up (T72) through the real filter chain and a real SMTP server (GreenMail, in process,
 * on a free port): the firm and its owner, the trial, the verification link and the login it unlocks,
 * the slug of a repeated name, the honeypot, the validation and the request limits.
 */
@SpringBootTest(properties = {
    "app.signup.enabled=true",
    "app.mail.from=avisos@gestor.test",
    "app.mail.smtp.host=127.0.0.1",
    "app.mail.smtp.security=NONE",
    "app.public-url=https://gestor.ejemplo.test/"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SignupFlowTests {

    @RegisterExtension
    static final GreenMailExtension SMTP =
            new GreenMailExtension(ServerSetupTest.SMTP.dynamicPort()).withPerMethodLifecycle(false);

    @DynamicPropertySource
    static void smtpPort(DynamicPropertyRegistry registry) {
        registry.add("app.mail.smtp.port", () -> SMTP.getSmtp().getPort());
    }

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String CSRF_COOKIE = "XSRF-TOKEN";
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";
    private static final Pattern LINK = Pattern.compile(
            "https://gestor\\.ejemplo\\.test/verificar-email\\?estudio=([a-z0-9-]+)#token=([A-Za-z0-9_-]{43})");
    private static final long MAIL_WAIT_MILLIS = 10_000;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository users;

    @Autowired
    private AuditTrail auditTrail;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String firmName;
    private String email;
    private String clientAddress;

    @BeforeEach
    void freshVisitor() throws Exception {
        SMTP.purgeEmailFromAllMailboxes();
        String unique = UUID.randomUUID().toString().substring(0, 8);
        firmName = "Estudio Ficticio Peña " + unique;
        email = "lucia." + unique + "@ejemplo.test";
        ThreadLocalRandom random = ThreadLocalRandom.current();
        clientAddress = "10." + random.nextInt(256) + "." + random.nextInt(256) + "." + random.nextInt(1, 255);
    }

    @Test
    void shouldOfferTheTrialAndTheAreasOfTheDefaultPackage() throws Exception {
        mockMvc.perform(get(SignupController.SETTINGS_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.trialDays").value(30))
                .andExpect(jsonPath("$.practiceAreas[0].code").value(Tenant.DEFAULT_PRACTICE_AREA))
                .andExpect(jsonPath("$.practiceAreas[?(@.code == 'civil')]").exists());
    }

    @Test
    void shouldCreateTheFirmWithATrialAndAnOwnerWaitingForTheEmail() throws Exception {
        Instant before = Instant.now();
        JsonNode answer = signUp(firmName, List.of("laboral", "penal", "penal"), email, "")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.email").value(email))
                .andReturn().getResponse().getContentAsString().transform(json::readTree);
        String slug = answer.get("tenant").asString();
        assertThat(slug).isEqualTo(FirmSlugs.fromName(firmName)).startsWith("estudio-ficticio-pena-");

        UUID tenantId = jdbc.queryForObject("select id from tenant where slug = ?", UUID.class, slug);
        String areas = jdbc.queryForObject(
                "select array_to_string(enabled_practice_areas, ',') from tenant where id = ?", String.class, tenantId);
        assertThat(areas).isEqualTo("penal,laboral");
        Instant trialEndsAt = jdbc.queryForObject(
                "select trial_ends_at from tenant where id = ?", Timestamp.class, tenantId).toInstant();
        assertThat(trialEndsAt).isBetween(before.plus(Duration.ofDays(30)), Instant.now().plus(Duration.ofDays(30)));

        AppUser owner = TenantContext.callAs(tenantId, () -> users.findByEmail(email)).orElseThrow();
        assertThat(owner.getRole()).isEqualTo(Role.OWNER);
        assertThat(owner.getDisplayName()).isEqualTo("Lucía Ficticia");
        assertThat(owner.isEmailVerificationPending()).isTrue();
        assertThat(owner.isPasswordChangeRequired()).isFalse();

        List<AuditEvent> firmHistory = TenantContext.callAs(tenantId, () -> auditTrail.historyOf(Tenant.class, tenantId));
        assertThat(firmHistory).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(AuditAction.CREATE);
            assertThat(event.getActorUserId()).isNull();
            assertThat(event.getChanges()).contains(
                    new FieldChange("name", null, firmName),
                    new FieldChange("enabledPracticeAreas", null, "penal,laboral"));
        });

        MimeMessage message = awaitEmails(1);
        assertThat(message.getAllRecipients()).extracting(Object::toString).containsExactly(email);
        assertThat(message.getSubject()).isEqualTo("Confirmá tu email para " + firmName);
        String body = plainText(message);
        assertThat(body).contains("Hola, Lucía Ficticia:", "estudio " + slug, "vence en 24 horas");
        Matcher link = LINK.matcher(body);
        assertThat(link.find()).as("link in %s", body).isTrue();
        assertThat(link.group(1)).isEqualTo(slug);
    }

    @Test
    void shouldLetTheOwnerLogInOnlyAfterOpeningTheLink() throws Exception {
        String slug = signedUpSlug();
        String firstLink = tokenIn(awaitEmails(1));

        logIn(slug, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("/problems/email-not-verified"));
        String secondLink = tokenIn(awaitEmails(2));
        logIn(slug, "otra-clave-equivocada").andExpect(status().isUnauthorized());
        assertThat(SMTP.getReceivedMessages()).as("a wrong password sends nothing").hasSize(2);

        verify(firstLink).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-verification-token"));
        verify(secondLink)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenant").value(slug))
                .andExpect(jsonPath("$.firmName").value(firmName));
        verify(secondLink).andExpect(status().isBadRequest());

        logIn(slug, PASSWORD).andExpect(status().isNoContent());
        UUID tenantId = jdbc.queryForObject("select id from tenant where slug = ?", UUID.class, slug);
        AppUser owner = TenantContext.callAs(tenantId, () -> users.findByEmail(email)).orElseThrow();
        assertThat(owner.isEmailVerificationPending()).isFalse();
        List<AuditEvent> ownerHistory =
                TenantContext.callAs(tenantId, () -> auditTrail.historyOf(AppUser.class, owner.getId()));
        assertThat(ownerHistory).last().satisfies(event -> assertThat(event.getChanges())
                .containsExactly(new FieldChange("emailVerificationPending", "true", "false")));
    }

    @Test
    void shouldRefuseAnExpiredOrMalformedLink() throws Exception {
        signedUpSlug();
        String token = tokenIn(awaitEmails(1));
        jdbc.update("update email_verification_token set created_at = created_at - interval '2 days',"
                + " expires_at = now() - interval '1 second' where used_at is null and revoked_at is null"
                + " and user_id in (select id from app_user where email = ?)", email);

        verify(token).andExpect(status().isBadRequest());
        verify("no-es-un-enlace").andExpect(status().isBadRequest());
    }

    @Test
    void shouldRefuseTheLinkOfAnArchivedOwner() throws Exception {
        String slug = signedUpSlug();
        String token = tokenIn(awaitEmails(1));
        UUID tenantId = jdbc.queryForObject("select id from tenant where slug = ?", UUID.class, slug);
        TenantContext.runAs(tenantId, () -> {
            AppUser owner = users.findByEmail(email).orElseThrow();
            owner.archive();
            users.save(owner);
        });

        verify(token).andExpect(status().isBadRequest());
    }

    @Test
    void shouldGiveARepeatedNameTheNextFreeSlug() throws Exception {
        String first = signedUpSlug();
        email = "otra." + email;

        String second = signUp(firmName, List.of("penal"), email, "")
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString().transform(json::readTree).get("tenant").asString();

        assertThat(second).isEqualTo(first + "-2");
    }

    @Test
    void shouldAnswerAFilledHoneypotLikeASignUpAndCreateNothing() throws Exception {
        String realSlug = signedUpSlug();
        awaitEmails(1);
        SMTP.purgeEmailFromAllMailboxes();
        email = "bot." + email;

        signUp(firmName, List.of("penal"), email, "https://spam.ejemplo.test")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.tenant").value(realSlug + "-2"));

        assertThat(jdbc.queryForObject("select count(*) from tenant where name = ?", Long.class, firmName)).isOne();
        assertThat(SMTP.waitForIncomingEmail(1_000, 1)).isFalse();
    }

    @Test
    void shouldRefuseInvalidValuesAndCreateNothing() throws Exception {
        signUp(firmName, List.of(), "1." + email, "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-signup"));
        signUp(firmName, List.of("astrologia"), "2." + email, "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-signup"));
        clientAddress = "10.201.0." + ThreadLocalRandom.current().nextInt(1, 255);
        signUp(firmName, List.of("penal"), "sin-arroba", "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-signup"));
        signUp(firmName, List.of("penal"), "3." + email, "", "corta")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-password"));

        assertThat(jdbc.queryForObject("select count(*) from tenant where name = ?", Long.class, firmName)).isZero();
    }

    @Test
    void shouldLimitSignUpsPerEmailCountingTheHoneypotOnesToo() throws Exception {
        for (int i = 0; i < 3; i++) {
            clientAddress = "10.200.0." + ThreadLocalRandom.current().nextInt(1, 255);
            signUp(firmName, List.of("penal"), email, "bot").andExpect(status().isAccepted());
        }

        signUp(firmName, List.of("penal"), email, "")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.type").value("/problems/signup-throttled"));
    }

    @Test
    void shouldLimitSignUpsPerClientAddress() throws Exception {
        for (int i = 0; i < 5; i++) {
            signUp(firmName, List.of("penal"), i + "." + email, "bot").andExpect(status().isAccepted());
        }

        signUp(firmName, List.of("penal"), "6." + email, "bot").andExpect(status().isTooManyRequests());
    }

    private String signedUpSlug() throws Exception {
        return signUp(firmName, List.of("penal"), email, "")
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString().transform(json::readTree).get("tenant").asString();
    }

    private ResultActions signUp(String firm, List<String> areas, String address, String honeypot) throws Exception {
        return signUp(firm, areas, address, honeypot, PASSWORD);
    }

    private ResultActions signUp(String firm, List<String> areas, String address, String honeypot, String password)
            throws Exception {
        String body = json.writeValueAsString(new SignupController.SignupRequest(
                firm, areas, "Lucía Ficticia", address, password, honeypot));
        return postWithCsrf("/api/v1/auth/signup", body);
    }

    private ResultActions verify(String token) throws Exception {
        return postWithCsrf("/api/v1/auth/email-verification", """
                {"token": "%s"}""".formatted(token));
    }

    private ResultActions logIn(String slug, String password) throws Exception {
        return postWithCsrf("/api/v1/auth/login", """
                {"tenant": "%s", "email": "%s", "password": "%s"}""".formatted(slug, email, password));
    }

    private ResultActions postWithCsrf(String path, String body) throws Exception {
        Cookie csrf = fetchCsrfCookie();
        return mockMvc.perform(fromClient(post(path))
                .cookie(csrf)
                .header(CSRF_HEADER, csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private static String tokenIn(MimeMessage message) throws Exception {
        Matcher link = LINK.matcher(plainText(message));
        assertThat(link.find()).isTrue();
        return link.group(2);
    }

    /** The decoded text/plain part, however deep the multipart nesting is. */
    private static String plainText(Part part) throws Exception {
        if (part.getContent() instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                String text = plainText(multipart.getBodyPart(i));
                if (text != null) {
                    return text;
                }
            }
            return null;
        }
        return part.isMimeType("text/plain") ? (String) part.getContent() : null;
    }

    /** Waits for {@code count} emails and returns the last one. */
    private static MimeMessage awaitEmails(int count) {
        assertThat(SMTP.waitForIncomingEmail(MAIL_WAIT_MILLIS, count)).as("%s emails arrive", count).isTrue();
        MimeMessage[] received = SMTP.getReceivedMessages();
        return received[received.length - 1];
    }

    private Cookie fetchCsrfCookie() throws Exception {
        MvcResult result = mockMvc.perform(fromClient(get("/api/v1/auth/csrf")))
                .andExpect(status().isNoContent())
                .andReturn();
        return lastCookie(result.getResponse(), CSRF_COOKIE);
    }

    private MockHttpServletRequestBuilder fromClient(MockHttpServletRequestBuilder request) {
        return request.with(r -> {
            r.setRemoteAddr(clientAddress);
            return r;
        });
    }

    private static Cookie lastCookie(MockHttpServletResponse response, String name) {
        Cookie[] matching = Arrays.stream(response.getCookies())
                .filter(c -> c.getName().equals(name) && !c.getValue().isEmpty())
                .toArray(Cookie[]::new);
        assertThat(matching).as("cookie %s", name).isNotEmpty();
        return matching[matching.length - 1];
    }
}
