package ar.gestorpenal.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantService;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
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

/** The demo story of T30: what a lawyer should see in a 10-minute demo, whatever day it is shown. */
@SpringBootTest(properties = "app.demo.password=" + DemoPortfolioTests.PASSWORD)
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Import(TestcontainersConfiguration.class)
class DemoPortfolioTests {

    static final String PASSWORD = "clave-demo-ficticia";

    private static final ZoneId FIRM_ZONE = ZoneId.of("America/Argentina/Salta");

    private static final List<String> TABLES =
            List.of("case_file", "defendant", "person", "hearing", "coercive_measure", "deadline");

    @Autowired
    private DemoDataSeeder seeder;

    @Autowired
    private TenantService tenants;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void shouldSeedAboutTwentyFiveCasesWithDefendantsInEveryStage() {
        UUID tenantId = demoFirm();

        assertThat(count("SELECT count(*) FROM case_file WHERE tenant_id = ?", tenantId))
                .isEqualTo(25);
        assertThat(count("SELECT count(DISTINCT stage_code) FROM defendant WHERE tenant_id = ?", tenantId))
                .as("the 10 stages of stages.yml, closed included")
                .isEqualTo(10);
        assertThat(count(
                        "SELECT count(*) FROM (SELECT case_id FROM defendant WHERE tenant_id = ?"
                                + " GROUP BY case_id HAVING count(*) > 1) multi",
                        tenantId))
                .isGreaterThanOrEqualTo(4);
        assertThat(count(
                        "SELECT count(*) FROM defendant WHERE tenant_id = ? AND status = 'CLOSED'"
                                + " AND closing_outcome_code IS NOT NULL",
                        tenantId))
                .isGreaterThanOrEqualTo(3);
        assertThat(count(
                        "SELECT count(DISTINCT user_id) FROM case_team_member WHERE tenant_id = ?"
                                + " AND team_role = 'RESPONSIBLE'",
                        tenantId))
                .as("the cases are spread across the three lawyers")
                .isEqualTo(3);
    }

    @Test
    void shouldFillTheNextFiveWeekdaysWithFrequentHearingTypesAndNoWeekendHearings() {
        UUID tenantId = demoFirm();
        // The context is cached: a suite crossing midnight in the firm's zone would shift this window.
        LocalDate today = LocalDate.now(FIRM_ZONE);
        Date firstWeekday = Date.valueOf(DemoCalendar.weekday(today, 0));
        Date fifthWeekday = Date.valueOf(DemoCalendar.weekday(today, 4));
        String localDay = "(starts_at AT TIME ZONE 'America/Argentina/Salta')::date";

        assertThat(count(
                        "SELECT count(*) FROM hearing WHERE tenant_id = ? AND " + localDay + " BETWEEN ? AND ?",
                        tenantId, firstWeekday, fifthWeekday))
                .isGreaterThanOrEqualTo(15);
        assertThat(count(
                        "SELECT count(DISTINCT type_code) FROM hearing WHERE tenant_id = ? AND " + localDay
                                + " BETWEEN ? AND ?",
                        tenantId, firstWeekday, fifthWeekday))
                .isGreaterThanOrEqualTo(8);
        assertThat(count(
                        "SELECT count(*) FROM hearing WHERE tenant_id = ? AND " + localDay + " = ?",
                        tenantId, firstWeekday))
                .as("the agenda of today (or of Monday, on a weekend) is never empty")
                .isGreaterThanOrEqualTo(4);
        assertThat(count(
                        "SELECT count(*) FROM hearing WHERE tenant_id = ?"
                                + " AND extract(isodow FROM starts_at AT TIME ZONE 'America/Argentina/Salta') > 5"
                                + " AND case_id NOT IN (SELECT id FROM case_file"
                                + " WHERE internal_number IN ('DEMO-001', 'DEMO-002'))",
                        tenantId))
                .isZero();
    }

    @Test
    void shouldWarnAboutTwoDetaineesWhoseDeadlinesExpireWithinFortyEightHours() throws Exception {
        String json = mockMvc.perform(get("/api/v1/deadlines").param("withinDays", "2").session(logInAsOwner()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        List<String> detainees = JsonPath.read(
                json, "$[?(@.rule.detainee == true && @.hoursLeft >= 0 && @.hoursLeft <= 48)].defendantId");
        List<String> disclaimers = JsonPath.read(json, "$[*].disclaimer");

        assertThat(new HashSet<>(detainees)).hasSizeGreaterThanOrEqualTo(2);
        assertThat(disclaimers).isNotEmpty().allSatisfy(text -> assertThat(text).isNotBlank());
    }

    @Test
    void shouldShowAnAlternativeOutcomeInItsProbationPeriod() {
        UUID tenantId = demoFirm();

        assertThat(count(
                        "SELECT count(*) FROM defendant d JOIN deadline l ON l.case_id = d.case_id"
                                + " WHERE d.tenant_id = ? AND d.status = 'SUSPENDED' AND l.rule_code = 'plazo-judicial'"
                                + " AND l.set_due_on > ? AND l.notes LIKE '%art. 108%'",
                        tenantId, Date.valueOf(LocalDate.now(FIRM_ZONE))))
                .isEqualTo(1);
    }

    @Test
    void shouldKeepTheValidarItemsVisible() {
        UUID tenantId = demoFirm();

        assertThat(count("SELECT count(*) FROM defendant WHERE tenant_id = ? AND indigenous_people", tenantId))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM deadline WHERE tenant_id = ? AND notes LIKE '%[validar]%'", tenantId))
                .isGreaterThanOrEqualTo(1);
    }

    @Test
    void shouldNotDuplicateTheRichPortfolioWhenRunAgain() {
        UUID tenantId = demoFirm();
        List<Integer> before = TABLES.stream().map(table -> rows(table, tenantId)).toList();

        seeder.run(new DefaultApplicationArguments());

        assertThat(TABLES.stream().map(table -> rows(table, tenantId)).toList()).isEqualTo(before);
    }

    private UUID demoFirm() {
        return tenants.findActiveIdBySlug("estudio-demo").orElseThrow();
    }

    private int rows(String table, UUID tenantId) {
        return count("SELECT count(*) FROM " + table + " WHERE tenant_id = ?", tenantId);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private MockHttpSession logInAsOwner() throws Exception {
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
        return (MockHttpSession) login.getRequest().getSession(false);
    }
}
