package ar.gestorpenal.task;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Two fictitious firms for the task API tests: firm A has an owner, two lawyers and two paralegals;
 * firm B has an owner. Everything goes through the real filter chain and a real database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
abstract class TaskApiTestSupport {

    static final String PASSWORD = "clave-ficticia-larga";
    static final String TASKS = "/api/v1/tasks";
    static final LocalDate TODAY = LocalDate.now(TaskClock.ZONE);

    /** The SPA's double-submit token (see CLAUDE.md, Lessons: no {@code csrf()} post-processor). */
    static final RequestPostProcessor CSRF = request -> {
        String token = UUID.randomUUID().toString();
        request.setCookies(new Cookie("XSRF-TOKEN", token));
        request.addHeader("X-XSRF-TOKEN", token);
        return request;
    };

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TenantService tenants;

    @Autowired
    UserService userService;

    UUID tenantA;
    UUID ownerId;
    UUID lawyerId;
    UUID otherLawyerId;
    UUID paralegalId;
    UUID otherParalegalId;
    UUID otherFirmOwnerId;
    RequestPostProcessor owner;
    RequestPostProcessor lawyer;
    RequestPostProcessor otherLawyer;
    RequestPostProcessor paralegal;
    RequestPostProcessor otherParalegal;
    RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        AppUser ownerUser = user(tenantA, "titular@ejemplo.test", "Titular Ficticia", Role.OWNER);
        AppUser lawyerUser = user(tenantA, "abogado@ejemplo.test", "Abogado Ficticio", Role.LAWYER);
        AppUser otherLawyerUser = user(tenantA, "abogada@ejemplo.test", "Abogada Dos Ficticia", Role.LAWYER);
        AppUser paralegalUser = user(tenantA, "procurador@ejemplo.test", "Procurador Ficticio", Role.PARALEGAL);
        AppUser otherParalegalUser = user(tenantA, "procuradora@ejemplo.test", "Procuradora Dos Ficticia", Role.PARALEGAL);
        AppUser otherFirmOwnerUser = user(tenantB, "titular@beta.test", "Titular Beta Ficticio", Role.OWNER);
        ownerId = ownerUser.getId();
        lawyerId = lawyerUser.getId();
        otherLawyerId = otherLawyerUser.getId();
        paralegalId = paralegalUser.getId();
        otherParalegalId = otherParalegalUser.getId();
        otherFirmOwnerId = otherFirmOwnerUser.getId();
        owner = loggedIn(ownerUser);
        lawyer = loggedIn(lawyerUser);
        otherLawyer = loggedIn(otherLawyerUser);
        paralegal = loggedIn(paralegalUser);
        otherParalegal = loggedIn(otherParalegalUser);
        otherFirmOwner = loggedIn(otherFirmOwnerUser);
    }

    private AppUser user(UUID tenantId, String email, String displayName, Role role) {
        return TenantContext.callAs(tenantId, () -> userService.createUser(email, displayName, PASSWORD, role));
    }

    /** A task body; {@code extraFields} is raw JSON starting with a comma, or empty. */
    static String taskJson(String title, UUID responsible, String extraFields) {
        return """
                {"title": "%s", "responsibleUserId": "%s"%s}
                """.formatted(title, responsible, extraFields);
    }

    static String due(LocalDate day) {
        return ", \"dueDate\": \"" + day + "\"";
    }

    String createTask(RequestPostProcessor user, String json) throws Exception {
        return idOf(postJson(user, TASKS, json).andExpect(status().isCreated()));
    }

    String createCase(RequestPostProcessor user, String caption, String extraFields) throws Exception {
        String json = """
                {"caption": "%s", "circumscriptionCode": "i-confluencia", "actionType": "public", "represents": "defence"%s}
                """.formatted(caption, extraFields);
        return idOf(postJson(user, "/api/v1/cases", json).andExpect(status().isCreated()));
    }

    String createHearing(RequestPostProcessor user, String caseId) throws Exception {
        String json = "{\"typeCode\": \"formulacion-de-cargos\", \"startsAt\": \"2035-09-10T13:00:00Z\"}";
        return idOf(postJson(user, "/api/v1/cases/" + caseId + "/hearings", json).andExpect(status().isCreated()));
    }

    ResultActions getAs(RequestPostProcessor user, String url) throws Exception {
        return mockMvc.perform(get(url).with(user));
    }

    ResultActions putJson(RequestPostProcessor user, String url, String body) throws Exception {
        return mockMvc.perform(put(url).with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    ResultActions postJson(RequestPostProcessor user, String url, String body) throws Exception {
        return mockMvc.perform(post(url).with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    ResultActions postEmpty(RequestPostProcessor user, String url) throws Exception {
        return mockMvc.perform(post(url).with(user).with(CSRF));
    }

    static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }
}
