package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The firm's choice of practice areas (ADR-0032, T43) through the real filter chain: every member sees
 * the package's areas, only the owner changes them, the choice is validated, an area with active cases
 * stays on, and every change is in the change history.
 */
class PracticeAreaSettingsApiTests extends CaseApiTestSupport {

    private static final String CIVIL_CASE = """
            {"caption": "Actor Ficticio c/ Demandado Ficticio", "circumscriptionCode": "i-confluencia",
             "actionType": "ordinario", "represents": "actor", "practiceArea": "civil"}
            """;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    private static String codes(String... codes) {
        return Arrays.stream(codes).map(code -> "\"" + code + "\"").collect(Collectors.joining(", ", "{\"codes\": [", "]}"));
    }

    @Test
    void everyMemberShouldSeeTheAreasOfThePackageWithWhetherTheyAreOn() throws Exception {
        mockMvc.perform(get("/api/v1/practice-areas/available").with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("penal"))
                .andExpect(jsonPath("$[0].enabled").value(true))
                .andExpect(jsonPath("$[0].law").value("CPP de Neuquén (Ley 2784)"))
                .andExpect(jsonPath("$[?(@.code == 'civil')].enabled").value(hasItem(false)))
                .andExpect(jsonPath("$[?(@.code == 'civil')].flags[*]").value(hasItem("validar")))
                .andExpect(jsonPath("$[?(@.code == 'laboral')].modules[*]", hasSize(0)));
    }

    @Test
    void theOwnerShouldTurnAreasOnAndOffWithTheDefaultAreaFirst() throws Exception {
        putJson(owner, "/api/v1/practice-areas/enabled", codes("civil", "penal", "civil"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'civil')].enabled").value(hasItem(true)));
        mockMvc.perform(get("/api/v1/practice-areas").with(lawyer))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].code").value("penal"))
                .andExpect(jsonPath("$[1].code").value("civil"));

        putJson(owner, "/api/v1/practice-areas/enabled", codes("civil")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/practice-areas").with(owner))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("civil"));
        mockMvc.perform(get("/api/v1/practice-areas").with(otherFirmOwner))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("penal"));
    }

    @Test
    void everyChangeShouldBeInTheChangeHistory() throws Exception {
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal", "laboral")).andExpect(status().isOk());
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal", "laboral")).andExpect(status().isOk());

        List<Map<String, Object>> events = jdbc.queryForList("""
                select actor_user_id, action, changes::text as changes from audit_event
                where tenant_id = ? and entity_type = 'Tenant' and entity_id = ?
                """, tenantA, tenantA);
        assertThat(events).hasSize(1);
        Map<String, Object> event = events.get(0);
        assertThat(event.get("actor_user_id")).isEqualTo(ownerId);
        assertThat(event.get("action")).isEqualTo("UPDATE");
        assertThat((String) event.get("changes"))
                .contains("\"field\": \"enabledPracticeAreas\"")
                .contains("\"oldValue\": \"penal\"")
                .contains("\"newValue\": \"penal,laboral\"");
    }

    @Test
    void onlyTheOwnerShouldChooseTheAreas() throws Exception {
        putJson(lawyer, "/api/v1/practice-areas/enabled", codes("penal", "civil")).andExpect(status().isForbidden());
        putJson(paralegal, "/api/v1/practice-areas/enabled", codes("penal", "civil")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/practice-areas").with(owner)).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void shouldRejectAnEmptyChoiceOrAnAreaThePackageLacks() throws Exception {
        putJson(owner, "/api/v1/practice-areas/enabled", "{\"codes\": []}").andExpect(status().isBadRequest());
        putJson(owner, "/api/v1/practice-areas/enabled", "{}").andExpect(status().isBadRequest());
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal", "inexistente"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-practice-areas"))
                .andExpect(jsonPath("$.detail").value(not(containsString("inexistente"))));
        putJson(owner, "/api/v1/practice-areas/enabled", codes(" ")).andExpect(status().isBadRequest());
        String tooLong = "x".repeat(51);
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal", tooLong))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(not(containsString(tooLong))));
        assertThat(jdbc.queryForObject(
                        "select array_to_string(enabled_practice_areas, ',') from tenant where id = ?", String.class, tenantA))
                .isEqualTo("penal");
    }

    @Test
    void openingACaseShouldWaitWhileTheAreasAreBeingChanged() throws Exception {
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal", "civil")).andExpect(status().isOk());
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            // What a change of the areas holds while it checks for active cases.
            try (PreparedStatement lock = connection.prepareStatement("select id from tenant where id = ? for update")) {
                lock.setObject(1, tenantA);
                lock.executeQuery().close();
            }
            CompletableFuture<String> opening = CompletableFuture.supplyAsync(() -> {
                try {
                    return createCase(owner, CIVIL_CASE);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            Thread.sleep(700);
            assertThat(opening).isNotDone();
            connection.rollback();
            assertThat(opening.get(10, TimeUnit.SECONDS)).isNotBlank();
        }
    }

    @Test
    void anAreaWithActiveCasesShouldStayOnUntilTheyAreArchived() throws Exception {
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal", "civil")).andExpect(status().isOk());
        String civil = createCase(owner, CIVIL_CASE);
        createCase(owner, caseJson("Causa penal ficticia", ""));

        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/practice-area-in-use"));
        putJson(owner, "/api/v1/practice-areas/enabled", codes("civil"))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/v1/cases/" + civil + "/archive").with(owner).with(CSRF))
                .andExpect(status().isNoContent());
        putJson(owner, "/api/v1/practice-areas/enabled", codes("penal")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/cases/" + civil).with(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.practiceArea").value("civil"));
    }

    @Test
    void shouldRequireALoginToSeeOrChooseTheAreas() throws Exception {
        mockMvc.perform(get("/api/v1/practice-areas/available")).andExpect(status().isUnauthorized());
    }
}
