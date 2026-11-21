package ar.gestorpenal.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = "app.demo.password=" + DemoDataSeederTests.PASSWORD)
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Import(TestcontainersConfiguration.class)
class DemoDataSeederTests {

    static final String PASSWORD = "clave-demo-ficticia";

    @Autowired
    private DemoDataSeeder seeder;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserRepository users;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void shouldCreateTheDemoFirmWithItsThreeUsers() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        List<AppUser> demoUsers = TenantContext.callAs(tenantId, users::findAll);

        assertThat(demoUsers)
                .extracting(AppUser::getEmail, AppUser::getDisplayName, AppUser::getRole)
                .containsExactlyInAnyOrder(
                        tuple("lucia.ejemplo@example.com", "Lucía Ejemplo", Role.OWNER),
                        tuple("martin.prueba@example.com", "Martín Prueba", Role.LAWYER),
                        tuple("sofia.ficticia@example.com", "Sofía Ficticia", Role.PARALEGAL));
    }

    @Test
    void shouldNotDuplicateAnythingWhenRunAgain() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        seeder.run(new DefaultApplicationArguments());

        assertThat(tenants.findActiveIdBySlug("estudio-demo")).contains(tenantId);
        List<AppUser> demoUsers = TenantContext.callAs(tenantId, users::findAll);
        assertThat(demoUsers).hasSize(3);
    }

    /** Simulates a run that failed after creating the firm; raw SQL because the app never deletes. */
    @Test
    void shouldCreateOnlyTheMissingUsersOfAPartiallySeededFirm() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();
        jdbc.update("DELETE FROM app_user WHERE tenant_id = ? AND email = ?", tenantId, "sofia.ficticia@example.com");

        seeder.run(new DefaultApplicationArguments());

        List<AppUser> demoUsers = TenantContext.callAs(tenantId, users::findAll);
        assertThat(demoUsers)
                .extracting(AppUser::getEmail)
                .containsExactlyInAnyOrder(
                        "lucia.ejemplo@example.com", "martin.prueba@example.com", "sofia.ficticia@example.com");
    }

    @Test
    void shouldLeaveAnArchivedDemoFirmAlone() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();
        jdbc.update("UPDATE tenant SET archived_at = now() WHERE id = ?", tenantId);
        try {
            seeder.run(new DefaultApplicationArguments());

            assertThat(tenants.findActiveIdBySlug("estudio-demo")).isEmpty();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM tenant WHERE slug = 'estudio-demo'", Integer.class))
                    .isEqualTo(1);
        } finally {
            jdbc.update("UPDATE tenant SET archived_at = NULL WHERE id = ?", tenantId);
        }
    }

    @Test
    void shouldLetADemoUserLogIn() throws Exception {
        MvcResult csrf = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isNoContent())
                .andReturn();
        Cookie token = csrf.getResponse().getCookie("XSRF-TOKEN");
        assertThat(token).isNotNull();

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(token)
                        .header("X-XSRF-TOKEN", token.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tenant": "estudio-demo", "email": "lucia.ejemplo@example.com", "password": "%s"}"""
                                .formatted(PASSWORD)))
                .andExpect(status().isNoContent())
                .andReturn();

        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        mockMvc.perform(get("/api/v1/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenant.slug").value("estudio-demo"))
                .andExpect(jsonPath("$.role").value("OWNER"));
    }
}
