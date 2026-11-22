package ar.gestorpenal.deadline;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DeadlineSuspensionApiTests extends DeadlineApiTestSupport {

    private static final LocalDate CHARGES = LocalDate.of(2026, 1, 15);

    private String caseId;
    private String ana;
    private String suspensions;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, "Caso ficticio de mediación", "");
        ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        suspensions = "/api/v1/cases/" + caseId + "/deadline-suspensions";
    }

    private String createSuspension(String body) throws Exception {
        return idOf(postJson(lawyer, suspensions, body).andExpect(status().isCreated()));
    }

    @Test
    void shouldStopTheRulesThatListMediationWhileItLastsAndMoveThemWhenItEnds() throws Exception {
        String investigation = createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, CHARGES));
        String appeal = createDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, LocalDate.of(2026, 3, 20)));

        String id = createSuspension("{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\", \"notes\": \"Derivación\"}");
        getAs(lawyer, "/api/v1/deadlines/" + investigation)
                .andExpect(jsonPath("$.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.dueOn").doesNotExist());
        getAs(lawyer, "/api/v1/deadlines/" + appeal).andExpect(jsonPath("$.dueOn").value("2026-03-31"));

        putJson(lawyer, "/api/v1/deadline-suspensions/" + id,
                        "{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\", \"endsOn\": \"2026-02-10\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(false));
        getAs(lawyer, "/api/v1/deadlines/" + investigation)
                .andExpect(jsonPath("$.dueOn").value("2026-05-25"))
                .andExpect(jsonPath("$.suspendedDays").value(10));
    }

    @Test
    void shouldApplyASuspensionOfOneDefendantOnlyToTheirDeadlines() throws Exception {
        String beto = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String anas = createDeadline(lawyer, caseId, dayDeadline("duracion-maxima-proceso", ana, CHARGES));
        String betos = createDeadline(lawyer, caseId, dayDeadline("duracion-maxima-proceso", beto, CHARGES));

        postJson(lawyer, suspensions, """
                        {"kind": "FEDERAL_EXTRAORDINARY_APPEAL", "defendantId": "%s", "startsOn": "2026-03-01", "endsOn": "2026-03-31"}
                        """.formatted(ana))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.defendantName").value("Quiroga Ejemplo, Ana"));

        getAs(lawyer, "/api/v1/deadlines/" + anas).andExpect(jsonPath("$.dueOn").value("2029-02-15"));
        getAs(lawyer, "/api/v1/deadlines/" + betos).andExpect(jsonPath("$.dueOn").value("2029-01-15"));
    }

    @Test
    void shouldRejectRebellionAndInconsistentData() throws Exception {
        String otherCase = createCase(lawyer, "Otro caso ficticio", "");
        String beto = createDefendant(lawyer, otherCase, "Beto", "Paz Ejemplo");

        postJson(lawyer, suspensions, "{\"kind\": \"REBELLION\", \"startsOn\": \"2026-02-01\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, suspensions, "{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-10\", \"endsOn\": \"2026-02-01\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, suspensions, "{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-10\", \"defendantId\": \"" + beto + "\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, suspensions, "{\"kind\": \"MEDIATION\"}").andExpect(status().isBadRequest());
    }

    @Test
    void shouldStopApplyingAnArchivedSuspension() throws Exception {
        String investigation = createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, CHARGES));
        String id = createSuspension("{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\"}");

        postEmpty(paralegal, "/api/v1/deadline-suspensions/" + id + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/deadline-suspensions/" + id + "/archive").andExpect(status().isNoContent());

        getAs(lawyer, "/api/v1/deadlines/" + investigation).andExpect(jsonPath("$.dueOn").value("2026-05-15"));
        getAs(lawyer, suspensions).andExpect(jsonPath("$", hasSize(0)));
        getAs(lawyer, suspensions + "?includeArchived=true")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].archived").value(true));
        putJson(lawyer, "/api/v1/deadline-suspensions/" + id, "{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\"}")
                .andExpect(status().isConflict());

        postEmpty(lawyer, "/api/v1/deadline-suspensions/" + id + "/restore").andExpect(status().isNoContent());
        getAs(lawyer, "/api/v1/deadlines/" + investigation).andExpect(jsonPath("$.status").value("SUSPENDED"));
    }

    @Test
    void shouldKeepAnotherFirmsAndReservedSuspensionsOutOfReach() throws Exception {
        String id = createSuspension("{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\"}");
        String reserved = createCase(lawyer, "Caso reservado ficticio", ", \"reserved\": true");

        getAs(otherFirmOwner, suspensions).andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, "/api/v1/deadline-suspensions/" + id + "/archive").andExpect(status().isNotFound());
        postJson(otherLawyer, "/api/v1/cases/" + reserved + "/deadline-suspensions",
                        "{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\"}")
                .andExpect(status().isNotFound());
    }
}
