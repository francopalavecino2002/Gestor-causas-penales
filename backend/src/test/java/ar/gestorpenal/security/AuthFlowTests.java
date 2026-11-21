package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.Cookie;
import java.util.Arrays;
import java.util.UUID;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** End-to-end login through the real filter chain: CSRF cookie, session, /me, logout, throttling. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthFlowTests {

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String EMAIL = "ana.ficticia@ejemplo.test";
    private static final String CSRF_COOKIE = "XSRF-TOKEN";
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository users;

    private String slugA;
    private String slugB;
    private UUID tenantA;
    private UUID tenantB;
    /** A fresh client address per test, so failures of one test never throttle another. */
    private String clientAddress;

    @BeforeEach
    void createTwoFirmsWithTheSameEmail() {
        slugA = uniqueSlug("alfa");
        slugB = uniqueSlug("beta");
        tenantA = tenants.create("Estudio Ficticio Alfa", slugA).id();
        tenantB = tenants.create("Estudio Ficticio Beta", slugB).id();
        TenantContext.runAs(tenantA, () -> userService.createUser(EMAIL, "Ana Ficticia", PASSWORD, Role.OWNER));
        TenantContext.runAs(tenantB, () -> userService.createUser(EMAIL, "Ana Ficticia", PASSWORD, Role.PARALEGAL));
        ThreadLocalRandom random = ThreadLocalRandom.current();
        clientAddress = "10." + random.nextInt(256) + "." + random.nextInt(256) + "." + random.nextInt(1, 255);
    }

    @Test
    void shouldLogInAndReturnTheCurrentUserAndFirm() throws Exception {
        MockHttpSession session = logIn(slugA, EMAIL, PASSWORD);

        mockMvc.perform(fromClient(get("/api/v1/me")).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.displayName").value("Ana Ficticia"))
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.tenant.id").value(tenantA.toString()))
                .andExpect(jsonPath("$.tenant.slug").value(slugA))
                .andExpect(jsonPath("$.tenant.name").value("Estudio Ficticio Alfa"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void shouldScopeTheSessionToTheFirmUsedAtLogin() throws Exception {
        MockHttpSession session = logIn(slugB.toUpperCase(), "  " + EMAIL.toUpperCase(), PASSWORD);

        mockMvc.perform(fromClient(get("/api/v1/me")).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenant.id").value(tenantB.toString()))
                .andExpect(jsonPath("$.role").value("PARALEGAL"));
    }

    @Test
    void shouldRequireTheCsrfTokenToLogIn() throws Exception {
        mockMvc.perform(fromClient(post(SecurityConfig.LOGIN_PATH))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(slugA, EMAIL, PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/access-denied"));
    }

    @Test
    void shouldChangeTheSessionIdAndTheCsrfTokenOnLogin() throws Exception {
        Cookie csrf = fetchCsrfCookie();
        MockHttpSession preLogin = new MockHttpSession();
        String preLoginId = preLogin.getId();

        MvcResult result = mockMvc.perform(loginRequest(csrf, slugA, EMAIL, PASSWORD)
                        .session(preLogin)
                        .with(request -> {
                            // As if the browser sent the cookie of an existing session.
                            request.setRequestedSessionId(preLoginId);
                            request.setRequestedSessionIdValid(true);
                            return request;
                        }))
                .andExpect(status().isNoContent())
                .andReturn();

        assertThat(result.getRequest().getSession().getId()).isNotEqualTo(preLoginId);
        assertThat(lastCookie(result.getResponse(), CSRF_COOKIE).getValue())
                .isNotBlank()
                .isNotEqualTo(csrf.getValue());
    }

    @Test
    void shouldRejectInvalidCredentialsWithTheSameGenericProblem() throws Exception {
        assertInvalidCredentials(slugA, EMAIL, "otra-clave-ficticia");
        assertInvalidCredentials(slugA, "nadie@ejemplo.test", PASSWORD);
        assertInvalidCredentials(uniqueSlug("inexistente"), EMAIL, PASSWORD);
        assertInvalidCredentials(slugA, EMAIL, "x".repeat(100));
    }

    @Test
    void shouldRejectAnArchivedUser() throws Exception {
        TenantContext.runAs(tenantA, () -> {
            AppUser user = users.findByEmail(EMAIL).orElseThrow();
            user.archive();
            users.save(user);
        });

        assertInvalidCredentials(slugA, EMAIL, PASSWORD);
    }

    @Test
    void shouldThrottleAnAccountAfterRepeatedFailuresEvenWithTheRightPassword() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertInvalidCredentials(slugA, EMAIL, "otra-clave-ficticia");
        }

        mockMvc.perform(loginRequest(fetchCsrfCookie(), slugA, EMAIL, PASSWORD))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/login-throttled"));

        // The same email in another firm is a different account.
        logIn(slugB, EMAIL, PASSWORD);
    }

    @Test
    void shouldValidateTheLoginBody() throws Exception {
        mockMvc.perform(loginRequest(fetchCsrfCookie(), slugA, "", PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void shouldLogOutAndInvalidateTheSession() throws Exception {
        Cookie csrf = fetchCsrfCookie();
        MvcResult login = mockMvc.perform(loginRequest(csrf, slugA, EMAIL, PASSWORD))
                .andExpect(status().isNoContent())
                .andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        Cookie rotatedCsrf = lastCookie(login.getResponse(), CSRF_COOKIE);

        mockMvc.perform(fromClient(post(SecurityConfig.LOGOUT_PATH))
                        .session(session)
                        .cookie(rotatedCsrf)
                        .header(CSRF_HEADER, rotatedCsrf.getValue()))
                .andExpect(status().isNoContent());

        assertThat(session.isInvalid()).isTrue();
        mockMvc.perform(fromClient(get("/api/v1/me")).session(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldThrottleAClientThatSpraysManyAccounts() throws Exception {
        for (int i = 0; i < 20; i++) {
            assertInvalidCredentials(slugA, "nadie" + i + "@ejemplo.test", PASSWORD);
        }

        mockMvc.perform(loginRequest(fetchCsrfCookie(), slugA, EMAIL, PASSWORD))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void shouldAnswerUnauthenticatedRequestsWithProblemJson() throws Exception {
        mockMvc.perform(fromClient(get("/api/v1/me")))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/authentication-required"));
    }

    @Test
    void shouldEndTheOpenSessionOfAnArchivedUser() throws Exception {
        MockHttpSession session = logIn(slugA, EMAIL, PASSWORD);
        TenantContext.runAs(tenantA, () -> {
            AppUser user = users.findByEmail(EMAIL).orElseThrow();
            user.archive();
            users.save(user);
        });

        mockMvc.perform(fromClient(get("/api/v1/anything")).session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("/problems/authentication-required"));
        assertThat(session.isInvalid()).isTrue();
    }

    private MockHttpSession logIn(String slug, String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(loginRequest(fetchCsrfCookie(), slug, email, password))
                .andExpect(status().isNoContent())
                .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session).isNotNull();
        return session;
    }

    private void assertInvalidCredentials(String slug, String email, String password) throws Exception {
        mockMvc.perform(loginRequest(fetchCsrfCookie(), slug, email, password))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-credentials"))
                .andExpect(jsonPath("$.detail").value("The firm, email or password is not valid."));
    }

    private Cookie fetchCsrfCookie() throws Exception {
        MvcResult result = mockMvc.perform(fromClient(get(SecurityConfig.CSRF_PATH)))
                .andExpect(status().isNoContent())
                .andReturn();
        return lastCookie(result.getResponse(), CSRF_COOKIE);
    }

    /** Sends the token the way the SPA does: the cookie plus the same value in the header. */
    private MockHttpServletRequestBuilder loginRequest(Cookie csrf, String slug, String email, String password) {
        return fromClient(post(SecurityConfig.LOGIN_PATH))
                .cookie(csrf)
                .header(CSRF_HEADER, csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginJson(slug, email, password));
    }

    private MockHttpServletRequestBuilder fromClient(MockHttpServletRequestBuilder request) {
        return request.with(r -> {
            r.setRemoteAddr(clientAddress);
            return r;
        });
    }

    /** A rotated token is written after the cookie that clears the old one; browsers keep the last. */
    private static Cookie lastCookie(MockHttpServletResponse response, String name) {
        Cookie[] matching = Arrays.stream(response.getCookies())
                .filter(c -> c.getName().equals(name) && !c.getValue().isEmpty())
                .toArray(Cookie[]::new);
        assertThat(matching).as("cookie %s", name).isNotEmpty();
        return matching[matching.length - 1];
    }

    private static String loginJson(String slug, String email, String password) {
        return """
                {"tenant": "%s", "email": "%s", "password": "%s"}""".formatted(slug, email, password);
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
