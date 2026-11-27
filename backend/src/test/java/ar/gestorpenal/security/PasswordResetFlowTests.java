package ar.gestorpenal.security;

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
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Password recovery by email through the real filter chain and a real SMTP server (GreenMail, in
 * process, on a free port): the same answer for every account, the link in the email, one use, expiry,
 * the request limits, sessions closed, two-factor still asked, and the history.
 */
@SpringBootTest(properties = {
    "app.mail.from=avisos@gestor.test",
    "app.mail.smtp.host=127.0.0.1",
    "app.mail.smtp.security=NONE",
    "app.public-url=https://gestor.ejemplo.test/"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PasswordResetFlowTests {

    @RegisterExtension
    static final GreenMailExtension SMTP =
            new GreenMailExtension(ServerSetupTest.SMTP.dynamicPort()).withPerMethodLifecycle(false);

    @DynamicPropertySource
    static void smtpPort(DynamicPropertyRegistry registry) {
        registry.add("app.mail.smtp.port", () -> SMTP.getSmtp().getPort());
    }

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String NEW_PASSWORD = "otra-clave-ficticia-nueva";
    private static final String EMAIL = "carla.ficticia@ejemplo.test";
    private static final String CSRF_COOKIE = "XSRF-TOKEN";
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";
    private static final Pattern LINK = Pattern.compile(
            "https://gestor\\.ejemplo\\.test/restablecer-clave\\?estudio=([a-z0-9-]+)#token=([A-Za-z0-9_-]{43})");
    private static final long MAIL_WAIT_MILLIS = 10_000;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordResetTokenRepository tokens;

    @Autowired
    private TotpSecretCipher cipher;

    @Autowired
    private AuditTrail auditTrail;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbc;

    private String slug;
    private UUID tenantId;
    private UUID userId;
    private String clientAddress;

    @BeforeEach
    void createFirmAndUser() throws Exception {
        SMTP.purgeEmailFromAllMailboxes();
        slug = "olvido-" + UUID.randomUUID().toString().substring(0, 8);
        tenantId = tenants.create("Estudio Ficticio Olvido", slug).id();
        userId = TenantContext.callAs(tenantId,
                () -> userService.createUser(EMAIL, "Carla Ficticia", PASSWORD, Role.LAWYER).getId());
        ThreadLocalRandom random = ThreadLocalRandom.current();
        clientAddress = "10." + random.nextInt(256) + "." + random.nextInt(256) + "." + random.nextInt(1, 255);
    }

    @Test
    void shouldEmailAOneTimeLinkToTheAccount() throws Exception {
        requestLink(slug, EMAIL).andExpect(status().isAccepted());

        MimeMessage message = awaitOneEmail();
        assertThat(message.getAllRecipients()).extracting(Object::toString).containsExactly(EMAIL);
        assertThat(message.getSubject()).isEqualTo("Restablecé tu contraseña de Estudio Ficticio Olvido");
        String body = plainText(message);
        assertThat(body).contains("Hola, Carla Ficticia:", "vence en 30 minutos");
        Matcher link = LINK.matcher(body);
        assertThat(link.find()).as("link in %s", body).isTrue();
        assertThat(link.group(1)).isEqualTo(slug);

        List<PasswordResetToken> stored = TenantContext.callAs(tenantId, () -> tokens.findAll());
        assertThat(stored).singleElement().satisfies(token -> {
            assertThat(token.getUserId()).isEqualTo(userId);
            assertThat(token.getTokenHash()).isEqualTo(PasswordResetService.hash(link.group(2)));
            assertThat(Duration.between(token.getCreatedAt(), token.getExpiresAt())).isEqualTo(Duration.ofMinutes(30));
        });
    }

    @Test
    void shouldAnswerTheSameAndSendNothingForAnUnknownAccount() throws Exception {
        MvcResult unknownEmail = requestLink(slug, "nadie@ejemplo.test").andExpect(status().isAccepted()).andReturn();
        MvcResult unknownFirm = requestLink("no-existe-" + slug, EMAIL).andExpect(status().isAccepted()).andReturn();
        MvcResult known = requestLink(slug, EMAIL).andExpect(status().isAccepted()).andReturn();

        assertThat(unknownEmail.getResponse().getContentAsString()).isEmpty();
        assertThat(unknownFirm.getResponse().getContentAsString()).isEqualTo(known.getResponse().getContentAsString());
        // One background thread in order: once the known account's email is here, the others were handled.
        assertThat(awaitOneEmail().getAllRecipients()).extracting(Object::toString).containsExactly(EMAIL);
        assertThat(SMTP.getReceivedMessages()).hasSize(1);
    }

    @Test
    void shouldSendNothingToAnArchivedUser() throws Exception {
        TenantContext.runAs(tenantId, () -> {
            AppUser user = users.findById(userId).orElseThrow();
            user.archive();
            users.save(user);
        });

        requestLink(slug, EMAIL).andExpect(status().isAccepted());
        createUser("otra.ficticia@ejemplo.test");
        requestLink(slug, "otra.ficticia@ejemplo.test").andExpect(status().isAccepted());

        assertThat(awaitOneEmail().getAllRecipients()).extracting(Object::toString)
                .containsExactly("otra.ficticia@ejemplo.test");
        assertThat(SMTP.getReceivedMessages()).hasSize(1);
    }

    @Test
    void shouldSetTheNewPasswordAndCloseEverySession() throws Exception {
        Client before = logIn(PASSWORD).andExpect(status().isNoContent()).client();
        before.perform(get("/api/v1/me")).andExpect(status().isOk());
        String token = askForLinkAndReadToken();

        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());

        before.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
        logIn(PASSWORD).andExpect(status().isUnauthorized());
        logIn(NEW_PASSWORD).andExpect(status().isNoContent());
        AppUser user = TenantContext.callAs(tenantId, () -> users.findById(userId)).orElseThrow();
        assertThat(user.isPasswordChangeRequired()).isFalse();
    }

    @Test
    void shouldReplaceATemporaryPasswordToo() throws Exception {
        String temporary = TenantContext.callAs(tenantId, () -> userService
                .createWithTemporaryPassword("temporal.ficticia@ejemplo.test", "Temporal Ficticia", Role.LAWYER)
                .temporaryPassword());
        requestLink(slug, "temporal.ficticia@ejemplo.test").andExpect(status().isAccepted());
        String token = tokenIn(awaitOneEmail());

        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());

        logIn("temporal.ficticia@ejemplo.test", temporary).andExpect(status().isUnauthorized());
        logIn("temporal.ficticia@ejemplo.test", NEW_PASSWORD).andExpect(status().isNoContent());
        AppUser user = TenantContext.callAs(tenantId, () -> users.findByEmail("temporal.ficticia@ejemplo.test"))
                .orElseThrow();
        assertThat(user.isPasswordChangeRequired()).isFalse();
    }

    @Test
    void shouldLetAUserWithATemporaryPasswordAskForALink() throws Exception {
        String temporary = TenantContext.callAs(tenantId, () -> userService
                .createWithTemporaryPassword("gate.ficticia@ejemplo.test", "Gate Ficticia", Role.LAWYER)
                .temporaryPassword());
        Client gated = logIn("gate.ficticia@ejemplo.test", temporary).andExpect(status().isNoContent()).client();

        gated.perform(post(SecurityConfig.PASSWORD_RESET_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(linkRequestJson(slug, "gate.ficticia@ejemplo.test")))
                .andExpect(status().isAccepted());
        String token = tokenIn(awaitOneEmail());
        gated.perform(post(SecurityConfig.PASSWORD_RESET_CONFIRM_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token": "%s", "newPassword": "%s"}""".formatted(token, NEW_PASSWORD)))
                .andExpect(status().isNoContent());
    }

    @Test
    void shouldRejectTheLinkOfAUserArchivedAfterItWasSent() throws Exception {
        String token = askForLinkAndReadToken();
        TenantContext.runAs(tenantId, () -> {
            AppUser user = users.findById(userId).orElseThrow();
            user.archive();
            users.save(user);
        });

        resetPassword(token, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
        String hash = TenantContext.callAs(tenantId, () -> users.findById(userId)).orElseThrow().getPasswordHash();
        assertThat(passwordEncoder.matches(PASSWORD, hash)).isTrue();
    }

    @Test
    void shouldRejectTheLinkOfAFirmArchivedAfterItWasSent() throws Exception {
        String token = askForLinkAndReadToken();
        jdbc.update("update tenant set archived_at = now() where id = ?", tenantId);

        resetPassword(token, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
    }

    @Test
    void shouldOnlyChangeTheUserOfTheLinksFirm() throws Exception {
        String otherSlug = "otro-" + UUID.randomUUID().toString().substring(0, 8);
        UUID otherFirm = tenants.create("Otro Estudio Ficticio", otherSlug).id();
        TenantContext.runAs(otherFirm, () -> userService.createUser(EMAIL, "Carla Homónima", PASSWORD, Role.OWNER));
        String token = askForLinkAndReadToken();

        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());

        String otherHash = TenantContext.callAs(otherFirm, () -> users.findByEmail(EMAIL)).orElseThrow().getPasswordHash();
        assertThat(passwordEncoder.matches(PASSWORD, otherHash)).isTrue();
        assertThat(TenantContext.callAs(otherFirm, () -> tokens.findAll())).isEmpty();
    }

    @Test
    void shouldNotCountARejectedNewPasswordAgainstTheLoginLimit() throws Exception {
        String token = askForLinkAndReadToken();
        for (int i = 0; i < 25; i++) {
            resetPassword(token, "corta").andExpect(jsonPath("$.type").value("/problems/invalid-password"));
        }

        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void shouldStillAskForTheSecondFactorAfterAReset() throws Exception {
        TenantContext.runAs(tenantId, () -> {
            AppUser user = users.findById(userId).orElseThrow();
            user.startTotpEnrollment(cipher.encrypt(new byte[20], userId));
            user.enableTotp(Instant.now());
            users.save(user);
        });
        String token = askForLinkAndReadToken();

        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());

        logIn(NEW_PASSWORD)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("SECOND_FACTOR_REQUIRED"));
        AppUser user = TenantContext.callAs(tenantId, () -> users.findById(userId)).orElseThrow();
        assertThat(user.isTotpEnabled()).isTrue();
    }

    @Test
    void shouldAcceptALinkOnlyOnce() throws Exception {
        String token = askForLinkAndReadToken();
        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());

        resetPassword(token, "una-tercera-clave-ficticia")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
        logIn(NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void shouldRevokeThePreviousLinkWhenANewOneIsAskedFor() throws Exception {
        String first = askForLinkAndReadToken();
        SMTP.purgeEmailFromAllMailboxes();
        String second = askForLinkAndReadToken();

        resetPassword(first, NEW_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
        resetPassword(second, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void shouldRejectAnExpiredLink() throws Exception {
        String secret = "A".repeat(43);
        Instant now = Instant.now();
        TenantContext.runAs(tenantId, () -> tokens.save(new PasswordResetToken(
                userId, PasswordResetService.hash(secret), now.minus(Duration.ofMinutes(31)), now.minusSeconds(60))));

        resetPassword(secret, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
        logIn(PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void shouldRejectUnknownOrMalformedLinks() throws Exception {
        resetPassword("B".repeat(43), NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
        resetPassword("corto", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-reset-token"));
    }

    @Test
    void shouldKeepTheLinkUsableWhenTheNewPasswordIsRejected() throws Exception {
        String token = askForLinkAndReadToken();

        resetPassword(token, "corta")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-password"));

        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void shouldLimitRequestsPerAccount() throws Exception {
        for (int i = 0; i < 3; i++) {
            requestLink(slug, "nadie@ejemplo.test").andExpect(status().isAccepted());
        }

        requestLink(slug, " NADIE@ejemplo.test ")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.type").value("/problems/password-reset-throttled"));
        requestLink(slug, "otra@ejemplo.test").andExpect(status().isAccepted());
    }

    @Test
    void shouldLimitRequestsPerClientAddress() throws Exception {
        for (int i = 0; i < 10; i++) {
            requestLink(slug, "nadie" + i + "@ejemplo.test").andExpect(status().isAccepted());
        }

        requestLink(slug, "nadie-mas@ejemplo.test")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.type").value("/problems/password-reset-throttled"));
    }

    @Test
    void shouldCountWrongLinksAgainstTheLoginLimit() throws Exception {
        for (int i = 0; i < 20; i++) {
            resetPassword(("C" + i).repeat(43).substring(0, 43), NEW_PASSWORD).andExpect(status().isBadRequest());
        }

        resetPassword("D".repeat(43), NEW_PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.type").value("/problems/login-throttled"));
    }

    @Test
    void shouldRequireTheCsrfToken() throws Exception {
        mockMvc.perform(fromClient(post(SecurityConfig.PASSWORD_RESET_PATH))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(linkRequestJson(slug, EMAIL)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRecordTheLinkAndThePasswordChangeInTheHistory() throws Exception {
        String token = askForLinkAndReadToken();
        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());

        PasswordResetToken stored = TenantContext.callAs(tenantId, () -> tokens.findAll()).getFirst();
        List<AuditEvent> linkHistory =
                TenantContext.callAs(tenantId, () -> auditTrail.historyOf(PasswordResetToken.class, stored.getId()));
        assertThat(linkHistory).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE, AuditAction.UPDATE);
        assertThat(linkHistory.getFirst().getChanges())
                .filteredOn(change -> change.field().equals("tokenHash"))
                .singleElement()
                .extracting(FieldChange::newValue)
                .isEqualTo(FieldChange.REDACTED);
        assertThat(linkHistory.getLast().getChanges()).extracting(FieldChange::field).containsExactly("usedAt");

        List<AuditEvent> userHistory =
                TenantContext.callAs(tenantId, () -> auditTrail.historyOf(AppUser.class, userId));
        assertThat(userHistory.getLast().getChanges())
                .filteredOn(change -> change.field().equals("passwordHash"))
                .singleElement()
                .satisfies(change -> assertThat(change.newValue()).isEqualTo(FieldChange.REDACTED));
    }

    private void createUser(String email) {
        TenantContext.runAs(tenantId, () -> userService.createUser(email, "Otra Ficticia", PASSWORD, Role.LAWYER));
    }

    private String askForLinkAndReadToken() throws Exception {
        requestLink(slug, EMAIL).andExpect(status().isAccepted());
        return tokenIn(awaitOneEmail());
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

    private static MimeMessage awaitOneEmail() {
        assertThat(SMTP.waitForIncomingEmail(MAIL_WAIT_MILLIS, 1)).as("an email arrives").isTrue();
        return SMTP.getReceivedMessages()[0];
    }

    private ResultActions requestLink(String firm, String email) throws Exception {
        Cookie csrf = fetchCsrfCookie();
        return mockMvc.perform(fromClient(post(SecurityConfig.PASSWORD_RESET_PATH))
                .cookie(csrf)
                .header(CSRF_HEADER, csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(linkRequestJson(firm, email)));
    }

    private ResultActions resetPassword(String token, String newPassword) throws Exception {
        Cookie csrf = fetchCsrfCookie();
        return mockMvc.perform(fromClient(post(SecurityConfig.PASSWORD_RESET_CONFIRM_PATH))
                .cookie(csrf)
                .header(CSRF_HEADER, csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"token": "%s", "newPassword": "%s"}""".formatted(token, newPassword)));
    }

    private LoggedIn logIn(String password) throws Exception {
        return logIn(EMAIL, password);
    }

    private LoggedIn logIn(String email, String password) throws Exception {
        Cookie csrf = fetchCsrfCookie();
        ResultActions result = mockMvc.perform(fromClient(post(SecurityConfig.LOGIN_PATH))
                .cookie(csrf)
                .header(CSRF_HEADER, csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"tenant": "%s", "email": "%s", "password": "%s"}""".formatted(slug, email, password)));
        return new LoggedIn(result);
    }

    private static String linkRequestJson(String firm, String email) {
        return """
                {"tenant": "%s", "email": "%s"}""".formatted(firm, email);
    }

    private Cookie fetchCsrfCookie() throws Exception {
        MvcResult result = mockMvc.perform(fromClient(get(SecurityConfig.CSRF_PATH)))
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

    /** A login attempt; {@link #client()} is the browser it left logged in. */
    private final class LoggedIn {

        private final ResultActions result;

        LoggedIn(ResultActions result) {
            this.result = result;
        }

        LoggedIn andExpect(org.springframework.test.web.servlet.ResultMatcher matcher) throws Exception {
            result.andExpect(matcher);
            return this;
        }

        Client client() {
            MvcResult done = result.andReturn();
            return new Client((MockHttpSession) done.getRequest().getSession(false),
                    lastCookie(done.getResponse(), CSRF_COOKIE));
        }
    }

    private final class Client {

        private final MockHttpSession session;
        private final Cookie csrf;

        Client(MockHttpSession session, Cookie csrf) {
            this.session = session;
            this.csrf = csrf;
        }

        ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
            return mockMvc.perform(fromClient(request).session(session).cookie(csrf).header(CSRF_HEADER, csrf.getValue()));
        }
    }
}
