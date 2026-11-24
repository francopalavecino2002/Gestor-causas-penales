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

    private static final String ORIGINAL_CASES = " AND case_id IN (SELECT id FROM case_file"
            + " WHERE internal_number IN ('DEMO-001', 'DEMO-002'))";

    @Test
    void shouldCreateTheDemoFirmWithThreeLawyersAndAParalegal() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        List<AppUser> demoUsers = TenantContext.callAs(tenantId, users::findAll);

        assertThat(demoUsers)
                .extracting(AppUser::getEmail, AppUser::getDisplayName, AppUser::getRole)
                .containsExactlyInAnyOrder(
                        tuple("lucia.ejemplo@example.com", "Lucía Ejemplo", Role.OWNER),
                        tuple("martin.prueba@example.com", "Martín Prueba", Role.LAWYER),
                        tuple("sofia.ficticia@example.com", "Sofía Ficticia", Role.PARALEGAL),
                        tuple("julian.muestra@example.com", "Julián Muestra", Role.LAWYER));
    }

    @Test
    void shouldNotDuplicateAnythingWhenRunAgain() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        seeder.run(new DefaultApplicationArguments());

        assertThat(tenants.findActiveIdBySlug("estudio-demo")).contains(tenantId);
        List<AppUser> demoUsers = TenantContext.callAs(tenantId, users::findAll);
        assertThat(demoUsers).hasSize(4);
    }

    @Test
    void shouldCreateTheTwoOriginalCasesOneOfThemReservedWithoutDuplicatingOnARerun() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        seeder.run(new DefaultApplicationArguments());

        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM case_file WHERE tenant_id = ? AND internal_number IN ('DEMO-001', 'DEMO-002')",
                        Integer.class,
                        tenantId))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM case_file WHERE tenant_id = ? AND reserved AND internal_number = 'DEMO-002'",
                        Integer.class,
                        tenantId))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM defendant WHERE tenant_id = ?" + ORIGINAL_CASES, Integer.class, tenantId))
                .isEqualTo(3);
        assertThat(jdbc.queryForObject(
                        "SELECT count(DISTINCT d.stage_code) FROM defendant d JOIN case_file c ON c.id = d.case_id"
                                + " WHERE d.tenant_id = ? AND c.internal_number = 'DEMO-001'",
                        Integer.class,
                        tenantId))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM case_team_member WHERE tenant_id = ? AND team_role = 'RESPONSIBLE'"
                                + ORIGINAL_CASES,
                        Integer.class,
                        tenantId))
                .isEqualTo(2);
    }

    @Test
    void shouldSeedHearingsAndMeasuresWithAClashAndKeepThemOnARerun() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        seeder.run(new DefaultApplicationArguments());

        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM hearing WHERE tenant_id = ?" + ORIGINAL_CASES, Integer.class, tenantId))
                .isEqualTo(4);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM hearing_lawyer WHERE tenant_id = ? AND archived_at IS NULL"
                                + " AND hearing_id IN (SELECT id FROM hearing WHERE true" + ORIGINAL_CASES + ")",
                        Integer.class,
                        tenantId))
                .isEqualTo(4);
        String originalDefendants = " AND defendant_id IN (SELECT id FROM defendant WHERE true" + ORIGINAL_CASES + ")";
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM coercive_measure WHERE tenant_id = ?" + originalDefendants,
                        Integer.class,
                        tenantId))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM coercive_measure WHERE tenant_id = ? AND measure_code = 'prision-preventiva'"
                                + " AND ends_on IS NOT NULL AND next_review_on IS NOT NULL" + originalDefendants,
                        Integer.class,
                        tenantId))
                .isEqualTo(1);
        // Two hearings of the same lawyer overlap: both start on the same day, half an hour apart. It is
        // the only clash of the whole demo: the rest of the agenda is laid out so that nobody double-books.
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM hearing a JOIN hearing b ON a.tenant_id = b.tenant_id AND a.id < b.id"
                                + " JOIN hearing_lawyer la ON la.hearing_id = a.id JOIN hearing_lawyer lb ON lb.hearing_id = b.id"
                                + " WHERE a.tenant_id = ? AND la.user_id = lb.user_id"
                                + " AND a.starts_at < b.starts_at + b.duration_minutes * interval '1 minute'"
                                + " AND b.starts_at < a.starts_at + a.duration_minutes * interval '1 minute'",
                        Integer.class,
                        tenantId))
                .isEqualTo(1);
    }

    @Test
    void shouldSeedDeadlinesOfTheDetainedDefendantAndTheCaseAndKeepThemOnARerun() {
        UUID tenantId = tenants.findActiveIdBySlug("estudio-demo").orElseThrow();

        seeder.run(new DefaultApplicationArguments());

        assertThat(jdbc.queryForList(
                        "SELECT rule_code FROM deadline WHERE tenant_id = ?" + ORIGINAL_CASES + " ORDER BY rule_code",
                        String.class,
                        tenantId))
                .containsExactly(
                        "duracion-fijada-prision-preventiva",
                        "duracion-maxima-prision-preventiva",
                        "impugnacion-ordinaria",
                        "investigacion-preparatoria");
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM deadline WHERE tenant_id = ? AND defendant_id IS NULL" + ORIGINAL_CASES,
                        Integer.class,
                        tenantId))
                .isEqualTo(1);
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
                        "lucia.ejemplo@example.com",
                        "martin.prueba@example.com",
                        "sofia.ficticia@example.com",
                        "julian.muestra@example.com");
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
