package ar.gestorpenal.jurisdiction;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** The catalog endpoints through the real filter chain: authentication, roles, CSRF, problem+json. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CatalogApiTests {

    private static final String PASSWORD = "clave-ficticia-larga";

    /**
     * The SPA's double-submit token: the same value in the cookie and the header. Spring Security's
     * {@code csrf()} post-processor is not used because it replaces the token repository of the
     * shared context and breaks the cookie-based login tests that run after this class.
     */
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

    private RequestPostProcessor owner;
    private RequestPostProcessor lawyer;

    @BeforeEach
    void createFirmWithOwnerAndLawyer() {
        UUID tenant = tenants.create("Estudio Ficticio Alfa", "alfa-" + UUID.randomUUID().toString().substring(0, 8)).id();
        owner = loggedIn(TenantContext.callAs(tenant,
                () -> userService.createUser("titular@ejemplo.test", "Titular Ficticia", PASSWORD, Role.OWNER)));
        lawyer = loggedIn(TenantContext.callAs(tenant,
                () -> userService.createUser("abogado@ejemplo.test", "Abogado Ficticio", PASSWORD, Role.LAWYER)));
    }

    @Test
    void anyMemberShouldReadTheCatalogsWithTheirSources() throws Exception {
        mockMvc.perform(get("/api/v1/catalogs").with(lawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(Catalog.values().length)))
                .andExpect(jsonPath("$[0].catalog").value("stages"));

        mockMvc.perform(get("/api/v1/catalogs/hearing-types").with(lawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jurisdiction").value("neuquen"))
                .andExpect(jsonPath("$.flags[0]").value("validar"))
                .andExpect(jsonPath("$.hideable").value(true))
                .andExpect(jsonPath("$.items[0].code").value("formulacion-de-cargos"))
                .andExpect(jsonPath("$.items[0].article").value("133"))
                .andExpect(jsonPath("$.items[0].attributes.group").value("Investigación"))
                .andExpect(jsonPath("$.items[0].origin").value("JURISDICTION"));
    }

    @Test
    void partyRolesShouldBeARenameOnlyCatalogWithTheVictimsRights() throws Exception {
        mockMvc.perform(get("/api/v1/catalogs/party-roles").with(lawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(11)))
                .andExpect(jsonPath("$.hideable").value(false))
                .andExpect(jsonPath("$.extensible").value(false))
                .andExpect(jsonPath("$.items[?(@.code == 'victima')].article").value("61"))
                .andExpect(jsonPath("$.items[?(@.code == 'victima')].attributes.notificationRights").value("true"));

        mockMvc.perform(put("/api/v1/catalogs/party-roles/items/testigo").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": null, \"hidden\": true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/catalog-change-not-allowed"));
    }

    @Test
    void anonymousRequestsShouldBeRejected() throws Exception {
        mockMvc.perform(get("/api/v1/catalogs"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void theOwnerShouldRenameHideAndAddItems() throws Exception {
        mockMvc.perform(put("/api/v1/catalogs/hearing-types/items/juicio-directo").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Flagrancia\", \"hidden\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Flagrancia"))
                .andExpect(jsonPath("$.sourceName").value("Juicio directo (flagrancia)"))
                .andExpect(jsonPath("$.article").value("222"))
                .andExpect(jsonPath("$.flags[0]").value("validar"))
                .andExpect(jsonPath("$.hidden").value(true));

        mockMvc.perform(get("/api/v1/catalogs/hearing-types").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(27)));
        mockMvc.perform(get("/api/v1/catalogs/hearing-types").param("includeHidden", "true").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(28)));

        mockMvc.perform(post("/api/v1/catalogs/circumscriptions/items").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Circunscripción ficticia\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/catalogs/circumscriptions/items/custom-")))
                .andExpect(jsonPath("$.origin").value("FIRM"));
    }

    @Test
    void aFirmItemShouldBeRenamedAndNeverLeftWithoutAName() throws Exception {
        String location = mockMvc.perform(post("/api/v1/catalogs/hearing-types/items").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Audiencia ficticia\", \"article\": \"999\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");

        mockMvc.perform(put(location).with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Audiencia ficticia renombrada\", \"hidden\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Audiencia ficticia renombrada"))
                .andExpect(jsonPath("$.article").value("999"));

        mockMvc.perform(put(location).with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": null, \"hidden\": false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-catalog-change"));
    }

    @Test
    void onlyTheOwnerShouldChangeCatalogs() throws Exception {
        mockMvc.perform(put("/api/v1/catalogs/hearing-types/items/juicio-directo").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": null, \"hidden\": true}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("/problems/access-denied"));
    }

    @Test
    void changesShouldNeedTheCsrfToken() throws Exception {
        mockMvc.perform(post("/api/v1/catalogs/hearing-types/items").with(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Sin token\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void errorsShouldBeProblemDetails() throws Exception {
        mockMvc.perform(get("/api/v1/catalogs/no-existe").with(lawyer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("/problems/catalog-item-not-found"));

        mockMvc.perform(put("/api/v1/catalogs/stages/items/juicio").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": null, \"hidden\": true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/catalog-change-not-allowed"));

        mockMvc.perform(post("/api/v1/catalogs/hearing-types/items").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        mockMvc.perform(put("/api/v1/catalogs/hearing-types/items/juicio-directo").with(owner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Sin estado\"}"))
                .andExpect(status().isBadRequest());
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }
}
