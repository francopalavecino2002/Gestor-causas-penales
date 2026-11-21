package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Enrollment, two-step login, recovery codes and disabling, through the real filter chain. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TwoFactorFlowTests {

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String EMAIL = "bruno.ficticio@ejemplo.test";
    private static final String CSRF_COOKIE = "XSRF-TOKEN";
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";
    private static final String BASE = "/api/v1/me/two-factor";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository users;

    @Autowired
    private TwoFactorService twoFactor;

    private String slug;
    private UUID tenantId;
    private String clientAddress;

    @BeforeEach
    void createFirmAndUser() {
        slug = "dosfa-" + UUID.randomUUID().toString().substring(0, 8);
        tenantId = tenants.create("Estudio Ficticio Dos Factores", slug).id();
        TenantContext.runAs(tenantId, () -> userService.createUser(EMAIL, "Bruno Ficticio", PASSWORD, Role.LAWYER));
        ThreadLocalRandom random = ThreadLocalRandom.current();
        clientAddress = "10." + random.nextInt(256) + "." + random.nextInt(256) + "." + random.nextInt(1, 255);
    }

    @Test
    void shouldReportTwoFactorOffForANewUser() throws Exception {
        Client client = logInWithPassword();

        client.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.recoveryCodesRemaining").value(0));
        client.perform(get("/api/v1/me")).andExpect(jsonPath("$.twoFactorEnabled").value(false));
    }

    @Test
    void shouldEnrollWithAnAuthenticatorAppAndIssueRecoveryCodes() throws Exception {
        Client client = logInWithPassword();

        MvcResult enrollment = client.perform(post(BASE + "/enrollment").content(passwordJson(PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isString())
                .andReturn();
        String secret = JsonPath.read(enrollment.getResponse().getContentAsString(), "$.secret");
        String uri = JsonPath.read(enrollment.getResponse().getContentAsString(), "$.otpauthUri");
        assertThat(uri)
                .startsWith("otpauth://totp/Gestor%20Penal:bruno.ficticio%40ejemplo.test?secret=" + secret)
                .contains("&issuer=Gestor%20Penal", "&digits=6", "&period=30");

        MvcResult confirmed = client.perform(post(BASE + "/enrollment/confirm").content(codeJson(currentCode(secret))))
                .andExpect(status().isOk())
                .andReturn();

        List<String> codes = JsonPath.read(confirmed.getResponse().getContentAsString(), "$.recoveryCodes");
        assertThat(codes).hasSize(10).doesNotHaveDuplicates()
                .allMatch(code -> code.matches("[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}"));
        client.perform(get(BASE))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.recoveryCodesRemaining").value(10));
        client.perform(get("/api/v1/me")).andExpect(jsonPath("$.twoFactorEnabled").value(true));
    }

    @Test
    void shouldRequireThePasswordToStartAnEnrollment() throws Exception {
        Client client = logInWithPassword();

        client.perform(post(BASE + "/enrollment").content(passwordJson("otra-clave-ficticia")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.type").value("/problems/invalid-confirmation"));
        client.perform(post(BASE + "/enrollment").content("{}")).andExpect(status().isBadRequest());

        AppUser user = TenantContext.callAs(tenantId, () -> users.findByEmail(EMAIL)).orElseThrow();
        assertThat(user.getTotpSecret()).isNull();
    }

    @Test
    void shouldRejectTheSecondStepIfTheUserWasArchivedMeanwhile() throws Exception {
        String secret = enableTwoFactor().secret();
        Client pending = startTwoStepLogin();
        TenantContext.runAs(tenantId, () -> {
            AppUser user = users.findByEmail(EMAIL).orElseThrow();
            user.archive();
            users.save(user);
        });

        pending.completeLogin(nextCode(secret))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("/problems/invalid-second-factor"));
    }

    @Test
    void shouldRejectTheSecondStepIfTwoFactorWasDisabledMeanwhile() throws Exception {
        Enabled enabled = enableTwoFactor();
        Client pending = startTwoStepLogin();
        enabled.client().perform(post(BASE + "/disable").content(disableJson(PASSWORD, enabled.recoveryCodes().get(2))))
                .andExpect(status().isNoContent());

        pending.completeLogin(enabled.recoveryCodes().get(3))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("/problems/invalid-second-factor"));
    }

    @Test
    void shouldStoreTheSecretEncrypted() throws Exception {
        String secret = enableTwoFactor().secret();

        AppUser user = TenantContext.callAs(tenantId, () -> users.findByEmail(EMAIL)).orElseThrow();
        assertThat(user.getTotpSecret()).startsWith("v1:").doesNotContain(secret);
    }

    @Test
    void shouldNotEnableTwoFactorWithAWrongCode() throws Exception {
        Client client = logInWithPassword();
        String secret = startEnrollment(client);

        client.perform(post(BASE + "/enrollment/confirm").content(codeJson(wrongCode(secret))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-confirmation"));
        client.perform(get(BASE)).andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    void shouldRejectConfirmingWithoutAnEnrollmentAndEnrollingTwice() throws Exception {
        Client client = logInWithPassword();
        client.perform(post(BASE + "/enrollment/confirm").content(codeJson("123456")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/two-factor-state"));

        Enabled enabled = enableTwoFactor();

        enabled.client().perform(post(BASE + "/enrollment").content(passwordJson(PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/two-factor-state"));
    }

    @Test
    void shouldAskForTheSecondFactorAfterTheRightPassword() throws Exception {
        String secret = enableTwoFactor().secret();

        Client pending = startTwoStepLogin();
        pending.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());

        // A step newer than the one used to confirm the enrollment.
        Client client = pending.completeLogin(nextCode(secret)).andExpect(status().isNoContent()).client();
        client.perform(get("/api/v1/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.twoFactorEnabled").value(true));
    }

    @Test
    void shouldChangeTheSessionIdWhenTheSecondFactorCompletesTheLogin() throws Exception {
        String secret = enableTwoFactor().secret();
        Client pending = startTwoStepLogin();
        String pendingId = pending.session().getId();

        Client client = pending.completeLogin(nextCode(secret)).andExpect(status().isNoContent()).client();

        assertThat(client.session().getId()).isNotEqualTo(pendingId);
        assertThat(client.csrf().getValue()).isNotEqualTo(pending.csrf().getValue());
    }

    @Test
    void shouldNotAcceptTheSameCodeTwice() throws Exception {
        Enabled enabled = enableTwoFactor();

        startTwoStepLogin().completeLogin(enabled.confirmationCode())
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-second-factor"));
    }

    @Test
    void shouldAcceptEachCodeOnlyOnceUnderConcurrentRequests() throws Exception {
        Enabled enabled = enableTwoFactor();
        UUID userId = TenantContext.callAs(tenantId, () -> users.findByEmail(EMAIL)).orElseThrow().getId();

        assertThat(acceptedInParallel(userId, nextCode(enabled.secret()))).isEqualTo(1);
        assertThat(acceptedInParallel(userId, enabled.recoveryCodes().get(4))).isEqualTo(1);
    }

    @Test
    void shouldRejectTheSecondStepWithoutAPendingLogin() throws Exception {
        Cookie csrf = fetchCsrfCookie();

        mockMvc.perform(fromClient(post(SecurityConfig.SECOND_FACTOR_PATH))
                        .cookie(csrf)
                        .header(CSRF_HEADER, csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(codeJson("123456")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("/problems/second-factor-expired"));
    }

    @Test
    void shouldLogInOnceWithEachRecoveryCode() throws Exception {
        Enabled enabled = enableTwoFactor();
        String typedLikeAUser = enabled.recoveryCodes().getFirst().toLowerCase().replace("-", " ");

        Client client = startTwoStepLogin().completeLogin(typedLikeAUser).andExpect(status().isNoContent()).client();
        client.perform(get(BASE)).andExpect(jsonPath("$.recoveryCodesRemaining").value(9));

        startTwoStepLogin().completeLogin(enabled.recoveryCodes().getFirst())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("/problems/invalid-second-factor"));
    }

    @Test
    void shouldThrottleGuessingTheSecondFactor() throws Exception {
        String secret = enableTwoFactor().secret();
        Client pending = startTwoStepLogin();

        // The password step used one attempt of the account's budget of five.
        for (int i = 0; i < 4; i++) {
            pending.completeLogin(wrongCode(secret)).andExpect(status().isUnauthorized());
        }

        pending.completeLogin(nextCode(secret))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.type").value("/problems/login-throttled"));
    }

    @Test
    void shouldReplaceTheRecoveryCodes() throws Exception {
        Enabled enabled = enableTwoFactor();

        MvcResult result = enabled.client().perform(post(BASE + "/recovery-codes").content(codeJson(nextCode(enabled.secret()))))
                .andExpect(status().isOk())
                .andReturn();

        List<String> fresh = JsonPath.read(result.getResponse().getContentAsString(), "$.recoveryCodes");
        assertThat(fresh).hasSize(10).doesNotContainAnyElementsOf(enabled.recoveryCodes());
        startTwoStepLogin().completeLogin(enabled.recoveryCodes().getFirst()).andExpect(status().isUnauthorized());
        startTwoStepLogin().completeLogin(fresh.getFirst()).andExpect(status().isNoContent());
    }

    @Test
    void shouldNotReplaceTheRecoveryCodesWithoutAValidCode() throws Exception {
        Enabled enabled = enableTwoFactor();

        enabled.client().perform(post(BASE + "/recovery-codes").content(codeJson(wrongCode(enabled.secret()))))
                .andExpect(status().isUnprocessableContent());
        startTwoStepLogin().completeLogin(enabled.recoveryCodes().getFirst()).andExpect(status().isNoContent());
    }

    @Test
    void shouldDisableTwoFactorWithThePasswordAndACode() throws Exception {
        Enabled enabled = enableTwoFactor();

        enabled.client().perform(post(BASE + "/disable").content(disableJson("otra-clave-ficticia", nextCode(enabled.secret()))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.type").value("/problems/invalid-confirmation"));
        enabled.client().perform(post(BASE + "/disable").content(disableJson(PASSWORD, enabled.recoveryCodes().get(1))))
                .andExpect(status().isNoContent());

        enabled.client().perform(get(BASE))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.recoveryCodesRemaining").value(0));
        logInWithPassword();
    }

    @Test
    void shouldRequireAuthenticationForTheTwoFactorSettings() throws Exception {
        mockMvc.perform(fromClient(get(BASE))).andExpect(status().isUnauthorized());
    }

    // --- helpers ---------------------------------------------------------------------------------

    /** Sends the same code from several threads at once; returns how many were accepted. */
    private long acceptedInParallel(UUID userId, String code) throws Exception {
        int threads = 8;
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                results.add(executor.submit(() -> {
                    start.await();
                    return TenantContext.callAs(tenantId, () -> twoFactor.verifyLogin(userId, code)).isPresent();
                }));
            }
            start.countDown();
            long accepted = 0;
            for (Future<Boolean> result : results) {
                accepted += result.get() ? 1 : 0;
            }
            return accepted;
        } finally {
            executor.shutdownNow();
        }
    }

    /** A browser: its session and its current CSRF cookie. */
    private record Client(TwoFactorFlowTests test, MockHttpSession session, Cookie csrf) {

        ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
            String sessionId = session.getId();
            return test.mockMvc.perform(test.fromClient(request)
                    .session(session)
                    .with(r -> {
                        // As if the browser sent the session cookie.
                        r.setRequestedSessionId(sessionId);
                        r.setRequestedSessionIdValid(true);
                        return r;
                    })
                    .cookie(csrf)
                    .header(CSRF_HEADER, csrf.getValue())
                    .contentType(MediaType.APPLICATION_JSON));
        }

        Completed completeLogin(String code) throws Exception {
            MvcResult result = perform(post(SecurityConfig.SECOND_FACTOR_PATH).content(codeJson(code))).andReturn();
            return new Completed(test, result);
        }
    }

    private record Completed(TwoFactorFlowTests test, MvcResult result) {

        Completed andExpect(ResultMatcher matcher) throws Exception {
            matcher.match(result);
            return this;
        }

        Client client() {
            return new Client(test, (MockHttpSession) result.getRequest().getSession(false),
                    lastCookie(result.getResponse(), CSRF_COOKIE));
        }
    }

    private record Enabled(Client client, String secret, String confirmationCode, List<String> recoveryCodes) {}

    private Enabled enableTwoFactor() throws Exception {
        Client client = logInWithPassword();
        String secret = startEnrollment(client);
        String code = currentCode(secret);
        MvcResult confirmed = client.perform(post(BASE + "/enrollment/confirm").content(codeJson(code)))
                .andExpect(status().isOk())
                .andReturn();
        List<String> codes = JsonPath.read(confirmed.getResponse().getContentAsString(), "$.recoveryCodes");
        return new Enabled(client, secret, code, codes);
    }

    private String startEnrollment(Client client) throws Exception {
        MvcResult result = client.perform(post(BASE + "/enrollment").content(passwordJson(PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.secret");
    }

    private Client logInWithPassword() throws Exception {
        MvcResult result = mockMvc.perform(loginRequest(fetchCsrfCookie())).andExpect(status().isNoContent()).andReturn();
        return new Client(this, (MockHttpSession) result.getRequest().getSession(false),
                lastCookie(result.getResponse(), CSRF_COOKIE));
    }

    /** The password step of a user with two-factor on: 202 and a session holding only the pending login. */
    private Client startTwoStepLogin() throws Exception {
        Cookie csrf = fetchCsrfCookie();
        MvcResult result = mockMvc.perform(loginRequest(csrf))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("SECOND_FACTOR_REQUIRED"))
                .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session).isNotNull();
        return new Client(this, session, csrf);
    }

    private MockHttpServletRequestBuilder loginRequest(Cookie csrf) {
        return fromClient(post(SecurityConfig.LOGIN_PATH))
                .cookie(csrf)
                .header(CSRF_HEADER, csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"tenant": "%s", "email": "%s", "password": "%s"}""".formatted(slug, EMAIL, PASSWORD));
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

    private static String currentCode(String base32Secret) {
        return Totp.codeAt(Base32.decode(base32Secret), Totp.stepAt(Instant.now()));
    }

    /** Always newer than any {@link #currentCode} already used, and still inside the drift window. */
    private static String nextCode(String base32Secret) {
        return Totp.codeAt(Base32.decode(base32Secret), Totp.stepAt(Instant.now()) + 1);
    }

    /** A 6-digit code that is not valid for any step in the drift window, even one step later. */
    private static String wrongCode(String base32Secret) {
        byte[] secret = Base32.decode(base32Secret);
        long step = Totp.stepAt(Instant.now());
        for (int candidate = 0; ; candidate++) {
            String code = "%06d".formatted(candidate);
            boolean nearSomeStep = false;
            for (long s = step - 2; s <= step + 2; s++) {
                nearSomeStep |= code.equals(Totp.codeAt(secret, s));
            }
            if (!nearSomeStep) {
                return code;
            }
        }
    }

    private static String codeJson(String code) {
        return """
                {"code": "%s"}""".formatted(code);
    }

    private static String passwordJson(String password) {
        return """
                {"password": "%s"}""".formatted(password);
    }

    private static String disableJson(String password, String code) {
        return """
                {"password": "%s", "code": "%s"}""".formatted(password, code);
    }

    private static Cookie lastCookie(MockHttpServletResponse response, String name) {
        Cookie[] matching = Arrays.stream(response.getCookies())
                .filter(c -> c.getName().equals(name) && !c.getValue().isEmpty())
                .toArray(Cookie[]::new);
        assertThat(matching).as("cookie %s", name).isNotEmpty();
        return matching[matching.length - 1];
    }
}
