package ar.gestorpenal.deadline;

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
 * Two fictitious firms for the deadline API tests: firm A has an owner, two lawyers and a paralegal;
 * firm B has an owner. Everything goes through the real filter chain and a real database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
abstract class DeadlineApiTestSupport {

    static final String PASSWORD = "clave-ficticia-larga";
    static final String DISCLAIMER = "Cálculo asistido: verificá con la norma.";
    static final LocalDate TODAY = LocalDate.now(DeadlineClock.ZONE);

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

    RequestPostProcessor owner;
    RequestPostProcessor lawyer;
    RequestPostProcessor otherLawyer;
    RequestPostProcessor paralegal;
    RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        UUID tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        owner = loggedIn(user(tenantA, "titular@ejemplo.test", "Titular Ficticia", Role.OWNER));
        lawyer = loggedIn(user(tenantA, "abogado@ejemplo.test", "Abogado Ficticio", Role.LAWYER));
        otherLawyer = loggedIn(user(tenantA, "abogada@ejemplo.test", "Abogada Dos Ficticia", Role.LAWYER));
        paralegal = loggedIn(user(tenantA, "procurador@ejemplo.test", "Procurador Ficticio", Role.PARALEGAL));
        otherFirmOwner = loggedIn(user(tenantB, "titular@beta.test", "Titular Beta Ficticio", Role.OWNER));
    }

    private AppUser user(UUID tenantId, String email, String displayName, Role role) {
        return TenantContext.callAs(tenantId, () -> userService.createUser(email, displayName, PASSWORD, role));
    }

    /** A public-action case; {@code extraFields} is raw JSON starting with a comma, or empty. */
    String createCase(RequestPostProcessor user, String caption, String extraFields) throws Exception {
        String json = """
                {"caption": "%s", "circumscriptionCode": "i-confluencia", "actionType": "PUBLIC", "represents": "DEFENCE"%s}
                """.formatted(caption, extraFields);
        return idOf(postJson(user, "/api/v1/cases", json).andExpect(status().isCreated()));
    }

    String createDefendant(RequestPostProcessor user, String caseId, String firstNames, String lastNames)
            throws Exception {
        String person = idOf(postJson(user, "/api/v1/persons",
                        "{\"kind\": \"HUMAN\", \"firstNames\": \"%s\", \"lastNames\": \"%s\"}".formatted(firstNames, lastNames))
                .andExpect(status().isCreated()));
        return idOf(postJson(user, "/api/v1/cases/" + caseId + "/defendants", "{\"personId\": \"" + person + "\"}")
                .andExpect(status().isCreated()));
    }

    /** Posts a deadline; {@code fields} is the JSON body without braces. */
    ResultActions postDeadline(RequestPostProcessor user, String caseId, String fields) throws Exception {
        return postJson(user, "/api/v1/cases/" + caseId + "/deadlines", "{" + fields + "}");
    }

    String createDeadline(RequestPostProcessor user, String caseId, String fields) throws Exception {
        return idOf(postDeadline(user, caseId, fields).andExpect(status().isCreated()));
    }

    /** The body of a deadline counted from a day: {@code defendantId} may be {@code null}. */
    static String dayDeadline(String ruleCode, String defendantId, LocalDate triggeredOn) {
        return "\"ruleCode\": \"%s\", %s\"triggeredOn\": \"%s\"".formatted(
                ruleCode, defendantId == null ? "" : "\"defendantId\": \"" + defendantId + "\", ", triggeredOn);
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
