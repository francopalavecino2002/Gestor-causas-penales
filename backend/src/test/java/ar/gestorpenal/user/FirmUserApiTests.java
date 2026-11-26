package ar.gestorpenal.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** The owner's users screen and the temporary-password flow, through the real filter chain. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class FirmUserApiTests {

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String NEW_PASSWORD = "otra-clave-ficticia-larga";

    /** The SPA's double-submit token (see the CSRF lesson in CLAUDE.md). */
    private static final RequestPostProcessor CSRF = request -> {
        String token = UUID.randomUUID().toString();
        request.setCookies(new Cookie("XSRF-TOKEN", token));
        request.addHeader("X-XSRF-TOKEN", token);
        return request;
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private AuditTrail auditTrail;

    @Autowired
    private FirmUserService firmUsers;

    private UUID tenantA;
    private String slugA;
    private AppUser ownerUser;
    private AppUser lawyerUser;
    private RequestPostProcessor owner;
    private RequestPostProcessor lawyer;
    private RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        slugA = uniqueSlug("alfa");
        tenantA = tenants.create("Estudio Ficticio Alfa", slugA).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        ownerUser = TenantContext.callAs(tenantA,
                () -> userService.createUser("titular@ejemplo.test", "Titular Ficticia", PASSWORD, Role.OWNER));
        lawyerUser = TenantContext.callAs(tenantA,
                () -> userService.createUser("abogado@ejemplo.test", "Abogado Ficticio", PASSWORD, Role.LAWYER));
        owner = loggedIn(ownerUser);
        lawyer = loggedIn(lawyerUser);
        otherFirmOwner = loggedIn(TenantContext.callAs(tenantB,
                () -> userService.createUser("titular@beta.test", "Titular Beta Ficticio", PASSWORD, Role.OWNER)));
    }

    @Test
    void theOwnerShouldListEveryUserOfTheFirmWithTheirSecurityState() throws Exception {
        mockMvc.perform(get("/api/v1/firm/users").with(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].displayName").value("Abogado Ficticio"))
                .andExpect(jsonPath("$[0].email").value("abogado@ejemplo.test"))
                .andExpect(jsonPath("$[0].role").value("LAWYER"))
                .andExpect(jsonPath("$[0].twoFactorEnabled").value(false))
                .andExpect(jsonPath("$[0].passwordChangeRequired").value(false))
                .andExpect(jsonPath("$[0].archived").value(false))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());

        mockMvc.perform(get("/api/v1/firm/users").with(otherFirmOwner))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void onlyTheOwnerShouldManageUsers() throws Exception {
        mockMvc.perform(get("/api/v1/firm/users").with(lawyer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("/problems/access-denied"));
        postJson(lawyer, "/api/v1/firm/users", newUser("intruso@ejemplo.test", "LAWYER"))
                .andExpect(status().isForbidden());
        putJson(lawyer, "/api/v1/firm/users/" + ownerUser.getId() + "/role", "{\"role\": \"PARALEGAL\"}")
                .andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/firm/users/" + ownerUser.getId() + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/firm/users/" + ownerUser.getId() + "/password-reset")
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/firm/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void aNewUserShouldGetATemporaryPasswordShownOnceAndBeAudited() throws Exception {
        MvcResult created = postJson(owner, "/api/v1/firm/users", newUser("Nueva@Ejemplo.test", "PARALEGAL"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.user.email").value("nueva@ejemplo.test"))
                .andExpect(jsonPath("$.user.role").value("PARALEGAL"))
                .andExpect(jsonPath("$.user.passwordChangeRequired").value(true))
                .andExpect(jsonPath("$.temporaryPassword").value(matchesPattern("([a-zA-Z2-9]{4}-){3}[a-zA-Z2-9]{4}")))
                .andReturn();
        UUID id = UUID.fromString(JsonPath.read(created.getResponse().getContentAsString(), "$.user.id"));

        mockMvc.perform(get("/api/v1/firm/users").with(owner))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[?(@.id == '" + id + "')].temporaryPassword").isEmpty());
        List<AuditEvent> history = TenantContext.callAs(tenantA, () -> auditTrail.historyOf(AppUser.class, id));
        assertThat(history).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE);
    }

    @Test
    void aNewUserShouldBeRefusedWithADuplicateEmailOrBadData() throws Exception {
        postJson(owner, "/api/v1/firm/users", newUser("ABOGADO@ejemplo.test", "LAWYER"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/user-duplicate-email"));
        postJson(owner, "/api/v1/firm/users", newUser("no-es-un-correo", "LAWYER"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/firm/users", "{\"displayName\": \"Sin rol\", \"email\": \"sinrol@ejemplo.test\"}")
                .andExpect(status().isBadRequest());

        // The same email is free in another firm.
        postJson(otherFirmOwner, "/api/v1/firm/users", newUser("abogado@ejemplo.test", "LAWYER"))
                .andExpect(status().isCreated());
    }

    @Test
    void aTemporaryPasswordShouldOnlyAllowChoosingANewOne() throws Exception {
        String temporary = JsonPath.read(postJson(owner, "/api/v1/firm/users", newUser("nueva@ejemplo.test", "LAWYER"))
                .andReturn().getResponse().getContentAsString(), "$.temporaryPassword");
        MockHttpSession session = logIn("nueva@ejemplo.test", temporary);

        mockMvc.perform(get("/api/v1/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passwordChangeRequired").value(true));
        mockMvc.perform(get("/api/v1/cases").session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("/problems/password-change-required"));
        mockMvc.perform(post("/api/v1/me/two-factor/enrollment").session(session).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\": \"" + temporary + "\"}"))
                .andExpect(status().isForbidden());

        changePassword(session, "una-clave-equivocada", NEW_PASSWORD)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.type").value("/problems/invalid-confirmation"));
        changePassword(session, temporary, "corta")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-password"));
        changePassword(session, temporary, temporary)
                .andExpect(status().isBadRequest());
        changePassword(session, temporary, NEW_PASSWORD).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me").session(session)).andExpect(status().isUnauthorized());
        MockHttpSession fresh = logIn("nueva@ejemplo.test", NEW_PASSWORD);
        mockMvc.perform(get("/api/v1/me").session(fresh))
                .andExpect(jsonPath("$.passwordChangeRequired").value(false));
        mockMvc.perform(get("/api/v1/cases").session(fresh)).andExpect(status().isOk());
    }

    @Test
    void theTemporaryPasswordCheckShouldFailClosedOnPathVariants() throws Exception {
        String temporary = JsonPath.read(postJson(owner, "/api/v1/firm/users", newUser("nueva@ejemplo.test", "OWNER"))
                .andReturn().getResponse().getContentAsString(), "$.temporaryPassword");
        MockHttpSession session = logIn("nueva@ejemplo.test", temporary);

        mockMvc.perform(get("/api/v1/me/").session(session)).andExpect(status().isForbidden());
        mockMvc.perform(head("/api/v1/me").session(session)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/me/password").session(session)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/firm/users").session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("/problems/password-change-required"));
        mockMvc.perform(get("/api/v1/public/deadline-rules").session(session)).andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/logout").session(session).with(CSRF)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void aBrowserWithATemporaryPasswordSessionShouldStillLogInAgain() throws Exception {
        String temporary = JsonPath.read(postJson(owner, "/api/v1/firm/users", newUser("nueva@ejemplo.test", "LAWYER"))
                .andReturn().getResponse().getContentAsString(), "$.temporaryPassword");
        MockHttpSession session = logIn("nueva@ejemplo.test", temporary);

        mockMvc.perform(post("/api/v1/auth/login").session(session).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tenant\": \"%s\", \"email\": \"abogado@ejemplo.test\", \"password\": \"%s\"}"
                                .formatted(slugA, PASSWORD)))
                .andExpect(status().isNoContent());
    }

    @Test
    void archiveRestoreAndResetShouldLeaveAHistoryWithoutThePassword() throws Exception {
        String user = "/api/v1/firm/users/" + lawyerUser.getId();
        postEmpty(owner, user + "/archive").andExpect(status().isOk());
        postEmpty(owner, user + "/password-reset").andExpect(status().isOk());
        postEmpty(owner, user + "/restore").andExpect(status().isOk());

        List<AuditEvent> history =
                TenantContext.callAs(tenantA, () -> auditTrail.historyOf(AppUser.class, lawyerUser.getId()));
        assertThat(history).extracting(AuditEvent::getAction)
                .containsExactly(AuditAction.CREATE, AuditAction.ARCHIVE, AuditAction.UPDATE, AuditAction.RESTORE);
        assertThat(history.subList(1, 4)).allSatisfy(event ->
                assertThat(event.getActorUserId()).isEqualTo(ownerUser.getId()));
        assertThat(history.get(2).getChanges()).anySatisfy(change -> {
            assertThat(change.field()).isEqualTo("passwordHash");
            assertThat(change.newValue()).isEqualTo(FieldChange.REDACTED);
        });
    }

    @Test
    void changingTheOwnPasswordShouldBeThrottled() throws Exception {
        MockHttpSession session = logIn("abogado@ejemplo.test", PASSWORD);
        int status = 0;
        for (int attempt = 0; attempt < 20 && status != 429; attempt++) {
            status = changePassword(session, "una-clave-equivocada", NEW_PASSWORD)
                    .andReturn().getResponse().getStatus();
        }
        assertThat(status).isEqualTo(429);
    }

    @Test
    void changingTheOwnPasswordShouldEndTheOtherSessionsToo() throws Exception {
        MockHttpSession phone = logIn("abogado@ejemplo.test", PASSWORD);
        MockHttpSession laptop = logIn("abogado@ejemplo.test", PASSWORD);

        changePassword(laptop, PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me").session(phone)).andExpect(status().isUnauthorized());
        logIn("abogado@ejemplo.test", NEW_PASSWORD);
    }

    @Test
    void aPasswordResetShouldEndTheUsersSessionsAndRequireANewPassword() throws Exception {
        MockHttpSession session = logIn("abogado@ejemplo.test", PASSWORD);

        String temporary = JsonPath.read(postEmpty(owner, "/api/v1/firm/users/" + lawyerUser.getId() + "/password-reset")
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString(), "$.temporaryPassword");

        mockMvc.perform(get("/api/v1/me").session(session)).andExpect(status().isUnauthorized());
        MockHttpSession again = logIn("abogado@ejemplo.test", temporary);
        mockMvc.perform(get("/api/v1/me").session(again))
                .andExpect(jsonPath("$.passwordChangeRequired").value(true));
    }

    @Test
    void theOwnerShouldChangeARoleAndTheUserShouldLogInAgain() throws Exception {
        MockHttpSession session = logIn("abogado@ejemplo.test", PASSWORD);

        putJson(owner, "/api/v1/firm/users/" + lawyerUser.getId() + "/role", "{\"role\": \"PARALEGAL\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("PARALEGAL"));

        mockMvc.perform(get("/api/v1/me").session(session)).andExpect(status().isUnauthorized());
        List<AuditEvent> history =
                TenantContext.callAs(tenantA, () -> auditTrail.historyOf(AppUser.class, lawyerUser.getId()));
        assertThat(history.getLast().getChanges()).anySatisfy(change -> {
            assertThat(change.field()).isEqualTo("role");
            assertThat(change.oldValue()).isEqualTo("LAWYER");
            assertThat(change.newValue()).isEqualTo("PARALEGAL");
        });
    }

    @Test
    void archivingShouldEndAccessAndRestoringShouldGiveItBack() throws Exception {
        MockHttpSession session = logIn("abogado@ejemplo.test", PASSWORD);

        postEmpty(owner, "/api/v1/firm/users/" + lawyerUser.getId() + "/archive")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));
        mockMvc.perform(get("/api/v1/me").session(session)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/users").with(owner)).andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(get("/api/v1/firm/users").with(owner)).andExpect(jsonPath("$", hasSize(2)));

        postEmpty(owner, "/api/v1/firm/users/" + lawyerUser.getId() + "/restore")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(false));
        logIn("abogado@ejemplo.test", PASSWORD);
    }

    @Test
    void anOwnerShouldArchiveOrDemoteAnotherOwnerWhileOneRemains() throws Exception {
        AppUser partner = TenantContext.callAs(tenantA,
                () -> userService.createUser("socia@ejemplo.test", "Socia Ficticia", PASSWORD, Role.OWNER));

        putJson(owner, "/api/v1/firm/users/" + partner.getId() + "/role", "{\"role\": \"LAWYER\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("LAWYER"));
        putJson(owner, "/api/v1/firm/users/" + partner.getId() + "/role", "{\"role\": \"OWNER\"}")
                .andExpect(status().isOk());
        postEmpty(owner, "/api/v1/firm/users/" + partner.getId() + "/archive").andExpect(status().isOk());
    }

    /**
     * Through the API an owner can only target someone else, so the last owner is only reachable
     * when two owners act on each other at the same time; the service enforces it either way.
     */
    @Test
    void theLastActiveOwnerShouldNeverBeArchivedOrDemoted() {
        UUID someoneElse = UUID.randomUUID();
        TenantContext.runAs(tenantA, () -> {
            assertThatThrownBy(() -> firmUsers.archive(someoneElse, ownerUser.getId()))
                    .isInstanceOf(UserManagementException.class)
                    .extracting(e -> ((UserManagementException) e).reason())
                    .isEqualTo(UserManagementException.Reason.LAST_OWNER);
            assertThatThrownBy(() -> firmUsers.changeRole(someoneElse, ownerUser.getId(), Role.LAWYER))
                    .isInstanceOf(UserManagementException.class);
            firmUsers.changeRole(someoneElse, ownerUser.getId(), Role.OWNER);
        });
    }

    @Test
    void twoOwnersDemotingEachOtherAtOnceShouldLeaveOneOwner() throws Exception {
        AppUser partner = TenantContext.callAs(tenantA,
                () -> userService.createUser("socia@ejemplo.test", "Socia Ficticia", PASSWORD, Role.OWNER));
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Boolean> first = pool.submit(() -> demote(start, ownerUser.getId(), partner.getId()));
            Future<Boolean> second = pool.submit(() -> demote(start, partner.getId(), ownerUser.getId()));
            start.countDown();
            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        } finally {
            pool.shutdownNow();
        }
        long owners = TenantContext.callAs(tenantA, () -> firmUsers.all().stream()
                .filter(user -> user.isActive() && user.getRole() == Role.OWNER)
                .count());
        assertThat(owners).isEqualTo(1);
    }

    /** True if the demotion went through, false if the last-owner rule refused it. */
    private boolean demote(CountDownLatch start, UUID actorId, UUID targetId) throws InterruptedException {
        start.await();
        try {
            TenantContext.runAs(tenantA, () -> firmUsers.changeRole(actorId, targetId, Role.LAWYER));
            return true;
        } catch (UserManagementException e) {
            return false;
        }
    }

    @Test
    void anOwnerShouldNotChangeTheirOwnAccountHere() throws Exception {
        String own = "/api/v1/firm/users/" + ownerUser.getId();
        putJson(owner, own + "/role", "{\"role\": \"LAWYER\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/own-account"));
        postEmpty(owner, own + "/archive").andExpect(status().isConflict());
        postEmpty(owner, own + "/password-reset").andExpect(status().isConflict());
    }

    @Test
    void anotherFirmsUserShouldNotBeFoundAndNothingIsDeletable() throws Exception {
        String foreign = "/api/v1/firm/users/" + lawyerUser.getId();
        putJson(otherFirmOwner, foreign + "/role", "{\"role\": \"PARALEGAL\"}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("/problems/not-found"));
        postEmpty(otherFirmOwner, foreign + "/archive").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, foreign + "/password-reset").andExpect(status().isNotFound());

        // No DELETE route exists at all: users are archived, never deleted.
        mockMvc.perform(delete(foreign).with(owner).with(CSRF)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/firm/users").with(owner)).andExpect(jsonPath("$", hasSize(2)));
    }

    private MockHttpSession logIn(String email, String password) throws Exception {
        MvcResult csrf = mockMvc.perform(get("/api/v1/auth/csrf")).andReturn();
        Cookie token = csrf.getResponse().getCookie("XSRF-TOKEN");
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(token)
                        .header("X-XSRF-TOKEN", token.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tenant\": \"%s\", \"email\": \"%s\", \"password\": \"%s\"}"
                                .formatted(slugA, email, password)))
                .andExpect(status().isNoContent())
                .andReturn();
        return (MockHttpSession) login.getRequest().getSession(false);
    }

    private ResultActions changePassword(MockHttpSession session, String current, String next) throws Exception {
        return mockMvc.perform(post("/api/v1/me/password").session(session).with(CSRF)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\": \"%s\", \"newPassword\": \"%s\"}".formatted(current, next)));
    }

    private ResultActions postJson(RequestPostProcessor user, String path, String json) throws Exception {
        return mockMvc.perform(post(path).with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions putJson(RequestPostProcessor user, String path, String json) throws Exception {
        return mockMvc.perform(put(path).with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions postEmpty(RequestPostProcessor user, String path) throws Exception {
        return mockMvc.perform(post(path).with(user).with(CSRF));
    }

    private static String newUser(String email, String role) {
        return "{\"displayName\": \"Persona Ficticia\", \"email\": \"%s\", \"role\": \"%s\"}".formatted(email, role);
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }
}
