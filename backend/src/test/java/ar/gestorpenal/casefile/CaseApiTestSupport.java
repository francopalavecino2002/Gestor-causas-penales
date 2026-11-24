package ar.gestorpenal.casefile;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
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
 * Two fictitious firms and their users for the case API tests. Firm A has an owner, two lawyers and a
 * paralegal; firm B has an owner. Everything goes through the real filter chain and a real database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
abstract class CaseApiTestSupport {

    static final String PASSWORD = "clave-ficticia-larga";

    /**
     * The SPA's double-submit token: the same value in the cookie and the header. Spring Security's
     * {@code csrf()} post-processor is not used because it replaces the token repository of the
     * shared context and breaks the cookie-based login tests that run after this class.
     */
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
    UUID otherFirmOwnerId;
    RequestPostProcessor owner;
    RequestPostProcessor lawyer;
    RequestPostProcessor otherLawyer;
    RequestPostProcessor paralegal;
    RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        AppUser ownerUser = user(tenantA, "titular@ejemplo.test", "Titular Ficticia", Role.OWNER);
        AppUser lawyerUser = user(tenantA, "abogado@ejemplo.test", "Abogado Ficticio", Role.LAWYER);
        AppUser otherLawyerUser = user(tenantA, "abogada@ejemplo.test", "Abogada Dos Ficticia", Role.LAWYER);
        AppUser paralegalUser = user(tenantA, "procurador@ejemplo.test", "Procurador Ficticio", Role.PARALEGAL);
        AppUser otherFirmOwnerUser = user(tenantB, "titular@beta.test", "Titular Beta Ficticio", Role.OWNER);
        ownerId = ownerUser.getId();
        lawyerId = lawyerUser.getId();
        otherLawyerId = otherLawyerUser.getId();
        paralegalId = paralegalUser.getId();
        otherFirmOwnerId = otherFirmOwnerUser.getId();
        owner = loggedIn(ownerUser);
        lawyer = loggedIn(lawyerUser);
        otherLawyer = loggedIn(otherLawyerUser);
        paralegal = loggedIn(paralegalUser);
        otherFirmOwner = loggedIn(otherFirmOwnerUser);
    }

    private AppUser user(UUID tenantId, String email, String displayName, Role role) {
        return TenantContext.callAs(tenantId, () -> userService.createUser(email, displayName, PASSWORD, role));
    }

    /** A case body with the required fields; {@code extraFields} is raw JSON starting with a comma, or empty. */
    static String caseJson(String caption, String extraFields) {
        return caseJson(caption, "i-confluencia", extraFields);
    }

    static String caseJson(String caption, String circumscription, String extraFields) {
        return """
                {"caption": "%s", "circumscriptionCode": "%s", "actionType": "public", "represents": "defence"%s}
                """.formatted(caption, circumscription, extraFields);
    }

    static String humanJson(String firstNames, String lastNames, String documentNumber) {
        String document = documentNumber == null
                ? ""
                : ", \"documentType\": \"DNI\", \"documentNumber\": \"" + documentNumber + "\"";
        return "{\"kind\": \"HUMAN\", \"firstNames\": \"%s\", \"lastNames\": \"%s\"%s}"
                .formatted(firstNames, lastNames, document);
    }

    String createCase(RequestPostProcessor user, String json) throws Exception {
        return idOf(mockMvc.perform(post("/api/v1/cases").with(user).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated()));
    }

    String createPerson(RequestPostProcessor user, String json) throws Exception {
        return idOf(mockMvc.perform(post("/api/v1/persons").with(user).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated()));
    }

    String addDefendant(RequestPostProcessor user, String caseId, String body) throws Exception {
        return idOf(mockMvc.perform(post("/api/v1/cases/" + caseId + "/defendants").with(user).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated()));
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
