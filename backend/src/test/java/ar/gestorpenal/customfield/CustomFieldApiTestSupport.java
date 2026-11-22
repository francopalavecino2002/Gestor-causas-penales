package ar.gestorpenal.customfield;

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
import java.util.Arrays;
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
 * Two fictitious firms for the custom field API tests: firm A has an owner and a lawyer, firm B has
 * an owner. Everything goes through the real filter chain and a real database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
abstract class CustomFieldApiTestSupport {

    private static final String PASSWORD = "clave-ficticia-larga";

    /** The SPA's double-submit token: the same value in the cookie and the header (see CaseApiTestSupport). */
    private static final RequestPostProcessor CSRF = request -> {
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
    RequestPostProcessor owner;
    RequestPostProcessor lawyer;
    RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        owner = loggedIn(user(tenantA, "titular@ejemplo.test", "Titular Ficticia", Role.OWNER));
        lawyer = loggedIn(user(tenantA, "abogado@ejemplo.test", "Abogado Ficticio", Role.LAWYER));
        otherFirmOwner = loggedIn(user(tenantB, "titular@beta.test", "Titular Beta Ficticio", Role.OWNER));
    }

    private AppUser user(UUID tenantId, String email, String displayName, Role role) {
        return TenantContext.callAs(tenantId, () -> userService.createUser(email, displayName, PASSWORD, role));
    }

    /** The body to create a field without options. */
    static String fieldJson(String entity, String label, String type, boolean required) {
        return "{\"entity\": \"%s\", \"label\": \"%s\", \"type\": \"%s\", \"required\": %s}"
                .formatted(entity, label, type, required);
    }

    /** The body to create a list field; {@code optionLabels} are plain labels. */
    static String listJson(String entity, String label, String... optionLabels) {
        String options = String.join(",", Arrays.stream(optionLabels)
                .map(optionLabel -> "{\"label\": \"" + optionLabel + "\"}")
                .toList());
        return "{\"entity\": \"%s\", \"label\": \"%s\", \"type\": \"LIST\", \"required\": false, \"options\": [%s]}"
                .formatted(entity, label, options);
    }

    String createField(RequestPostProcessor user, String json) throws Exception {
        return idOf(postJson(user, "/api/v1/custom-fields", json).andExpect(status().isCreated()));
    }

    ResultActions getJson(RequestPostProcessor user, String url) throws Exception {
        return mockMvc.perform(get(url).with(user));
    }

    ResultActions postJson(RequestPostProcessor user, String url, String body) throws Exception {
        return mockMvc.perform(post(url).with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    ResultActions putJson(RequestPostProcessor user, String url, String body) throws Exception {
        return mockMvc.perform(put(url).with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    ResultActions postEmpty(RequestPostProcessor user, String url) throws Exception {
        return mockMvc.perform(post(url).with(user).with(CSRF));
    }

    static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
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
