package ar.gestorpenal.user;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** {@code GET /api/v1/users}: the active members of the caller's firm, by name, without emails. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class FirmMemberApiTests {

    private static final String PASSWORD = "clave-ficticia-larga";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository users;

    private AppUser paralegal;
    private AppUser lawyer;
    private AppUser archivedLawyer;

    @BeforeEach
    void createTwoFirms() {
        UUID tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        paralegal = TenantContext.callAs(tenantA,
                () -> userService.createUser("procu@ejemplo.test", "Procurador Ficticio", PASSWORD, Role.PARALEGAL));
        lawyer = TenantContext.callAs(tenantA,
                () -> userService.createUser("abogada@ejemplo.test", "Abogada Ficticia", PASSWORD, Role.LAWYER));
        archivedLawyer = TenantContext.callAs(tenantA, () -> {
            AppUser user = userService.createUser("baja@ejemplo.test", "Baja Ficticia", PASSWORD, Role.LAWYER);
            user.archive();
            return users.save(user);
        });
        TenantContext.runAs(tenantB,
                () -> userService.createUser("titular@beta.test", "Titular Beta Ficticio", PASSWORD, Role.OWNER));
    }

    @Test
    void shouldListTheActiveMembersOfTheCallersFirmByName() throws Exception {
        mockMvc.perform(get("/api/v1/users").with(loggedIn(paralegal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(lawyer.getId().toString()))
                .andExpect(jsonPath("$[0].displayName").value("Abogada Ficticia"))
                .andExpect(jsonPath("$[0].role").value("LAWYER"))
                .andExpect(jsonPath("$[1].displayName").value("Procurador Ficticio"))
                .andExpect(jsonPath("$[1].role").value("PARALEGAL"))
                .andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem(archivedLawyer.getId().toString()))))
                .andExpect(jsonPath("$[*].displayName", Matchers.not(Matchers.hasItem("Titular Beta Ficticio"))))
                .andExpect(jsonPath("$[0].email").doesNotExist());
    }

    @Test
    void shouldRequireASession() throws Exception {
        mockMvc.perform(get("/api/v1/users")).andExpect(status().isUnauthorized());
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal =
                new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
