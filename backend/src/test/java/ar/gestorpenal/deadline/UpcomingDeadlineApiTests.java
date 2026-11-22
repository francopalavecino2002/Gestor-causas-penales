package ar.gestorpenal.deadline;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class UpcomingDeadlineApiTests extends DeadlineApiTestSupport {

    private static final String UPCOMING = "/api/v1/deadlines";

    private String caseId;
    private String ana;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, "Caso ficticio de vencimientos", "");
        ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
    }

    @Test
    void shouldListDetaineeDeadlinesFirstThenTheSoonest() throws Exception {
        // Overdue but not about a detainee: it goes after the detainee's deadline due in 5 days.
        String overdueInvestigation =
                createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, TODAY.minusMonths(5)));
        String detaineeReview = createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY));
        String appeal = createDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY)
                + ", \"setDueOn\": \"" + TODAY.plusDays(10) + "\"");

        getAs(otherLawyer, UPCOMING)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].id").value(detaineeReview))
                .andExpect(jsonPath("$[0].status").value("RUNNING"))
                .andExpect(jsonPath("$[1].id").value(overdueInvestigation))
                .andExpect(jsonPath("$[1].status").value("OVERDUE"))
                .andExpect(jsonPath("$[1].daysLeft").isNumber())
                .andExpect(jsonPath("$[2].id").value(appeal))
                .andExpect(jsonPath("$[2].disclaimer").value(DISCLAIMER));
    }

    @Test
    void shouldHonourTheWindowButAlwaysShowOverdueAndNotCalculableDeadlines() throws Exception {
        createDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY) + ", \"setDueOn\": \"" + TODAY.plusDays(15) + "\"");
        createDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY.minusDays(10))
                + ", \"setDueOn\": \"" + TODAY.minusDays(2) + "\"");
        createDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, TODAY.withYear(2031)));

        getAs(lawyer, UPCOMING + "?withinDays=7")
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].status").value("OVERDUE"))
                .andExpect(jsonPath("$[1].status").value("NOT_CALCULABLE"));
        getAs(lawyer, UPCOMING + "?withinDays=20").andExpect(jsonPath("$", hasSize(3)));
        getAs(lawyer, UPCOMING + "?withinDays=0").andExpect(status().isBadRequest());
        getAs(lawyer, UPCOMING + "?withinDays=366").andExpect(status().isBadRequest());
    }

    @Test
    void shouldLeaveOutMetSuspendedArchivedAndDisabledDeadlines() throws Exception {
        String met = createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY));
        putJson(lawyer, "/api/v1/deadlines/" + met,
                        "{" + dayDeadline("revision-prision-preventiva", ana, TODAY) + ", \"metOn\": \"" + TODAY + "\"}")
                .andExpect(status().isOk());
        String archived = createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY));
        postEmpty(lawyer, "/api/v1/deadlines/" + archived + "/archive").andExpect(status().isNoContent());
        createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, TODAY.minusMonths(4)));
        postJson(lawyer, "/api/v1/cases/" + caseId + "/deadline-suspensions",
                        "{\"kind\": \"MEDIATION\", \"startsOn\": \"" + TODAY.minusDays(30) + "\"}")
                .andExpect(status().isCreated());
        createDeadline(lawyer, caseId, dayDeadline("revision-rechazo-querellante", null, TODAY.minusDays(20)));
        getAs(lawyer, UPCOMING).andExpect(jsonPath("$", hasSize(1)));

        putJson(owner, "/api/v1/deadline-rules/revision-rechazo-querellante/settings",
                        "{\"enabled\": false, \"alertDaysBefore\": 1}")
                .andExpect(status().isOk());
        getAs(lawyer, UPCOMING).andExpect(jsonPath("$", hasSize(0)));
        // The case still lists it, flagged as a disabled rule.
        getAs(lawyer, "/api/v1/cases/" + caseId + "/deadlines")
                .andExpect(jsonPath("$[?(@.rule.code == 'revision-rechazo-querellante')].rule.enabled").value(false));
    }

    @Test
    void shouldLeaveOutTheDeadlinesOfArchivedCasesAndDefendants() throws Exception {
        String beto = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY));
        createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", beto, TODAY));
        getAs(lawyer, UPCOMING).andExpect(jsonPath("$", hasSize(2)));

        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + beto + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, UPCOMING).andExpect(jsonPath("$", hasSize(1)));

        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, UPCOMING).andExpect(jsonPath("$", hasSize(0)));
    }
}
