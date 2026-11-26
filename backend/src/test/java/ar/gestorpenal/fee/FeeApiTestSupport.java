package ar.gestorpenal.fee;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Two fictitious firms for the fees API tests: firm A has an owner, a lawyer, a paralegal and an
 * administrative member; firm B has an owner. Everything goes through the real filter chain and a real
 * database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
abstract class FeeApiTestSupport {

    static final String PASSWORD = "clave-ficticia-larga";
    static final String FEES = "/api/v1/fees";
    static final String JUS_VALUES = FEES + "/jus-values";
    static final String CALCULATIONS = FEES + "/calculations";

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

    @Autowired
    JdbcTemplate jdbc;

    UUID ownerId;
    UUID lawyerId;
    RequestPostProcessor owner;
    RequestPostProcessor lawyer;
    RequestPostProcessor paralegal;
    RequestPostProcessor adminStaff;
    RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        UUID tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        AppUser ownerUser = user(tenantA, "titular@ejemplo.test", "Titular Ficticia", Role.OWNER);
        AppUser lawyerUser = user(tenantA, "abogado@ejemplo.test", "Abogado Ficticio", Role.LAWYER);
        AppUser paralegalUser = user(tenantA, "procurador@ejemplo.test", "Procurador Ficticio", Role.PARALEGAL);
        AppUser adminUser = user(tenantA, "administrativa@ejemplo.test", "Administrativa Ficticia", Role.ADMIN_STAFF);
        AppUser otherFirmOwnerUser = user(tenantB, "titular@beta.test", "Titular Beta Ficticio", Role.OWNER);
        ownerId = ownerUser.getId();
        lawyerId = lawyerUser.getId();
        owner = loggedIn(ownerUser);
        lawyer = loggedIn(lawyerUser);
        paralegal = loggedIn(paralegalUser);
        adminStaff = loggedIn(adminUser);
        otherFirmOwner = loggedIn(otherFirmOwnerUser);
    }

    private AppUser user(UUID tenantId, String email, String displayName, Role role) {
        return TenantContext.callAs(tenantId, () -> userService.createUser(email, displayName, PASSWORD, role));
    }

    /** Creates a JUS value and returns its id. */
    String createJusValue(RequestPostProcessor user, String value, String validFrom) throws Exception {
        String json = "{\"value\": " + value + ", \"validFrom\": \"" + validFrom + "\"}";
        return idOf(postJson(user, JUS_VALUES, json).andExpect(status().isCreated()));
    }

    ResultActions getAs(RequestPostProcessor user, String url) throws Exception {
        return mockMvc.perform(get(url).with(user));
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
