package ar.gestorpenal.hearing;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Firm B must not see or touch anything of firm A's hearings and coercive measures. */
class HearingTenantIsolationTests extends HearingApiTestSupport {

    private static final LocalDate TODAY = LocalDate.now(HearingCalendar.ZONE);

    private String caseId;
    private String defendantId;
    private String hearingId;
    private String measureId;

    @BeforeEach
    void firmAHasHearingsAndMeasures() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio de la firma A", ""));
        defendantId = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        hearingId = createHearing(lawyer, caseId, hearingJson("2035-08-10", "13:00",
                ", \"defendantIds\": [\"" + defendantId + "\"]"));
        measureId = idOf(postJson(lawyer, "/api/v1/defendants/" + defendantId + "/coercive-measures",
                        "{\"measureCode\": \"detencion-domiciliaria\", \"startsOn\": \"%s\", \"endsOn\": \"%s\"}"
                                .formatted(TODAY.minusDays(5), TODAY.plusDays(2)))
                .andExpect(status().isCreated()));
    }

    @Test
    void anotherFirmShouldNotFindTheHearingsOfACase() throws Exception {
        String url = "/api/v1/hearings/" + hearingId;

        getAs(otherFirmOwner, url).andExpect(status().isNotFound());
        putJson(otherFirmOwner, url, hearingJson("2035-08-10", "13:00", "")).andExpect(status().isNotFound());
        postJson(otherFirmOwner, url + "/reschedule", "{\"startsAt\": \"2035-08-11T13:00:00Z\"}")
                .andExpect(status().isNotFound());
        postJson(otherFirmOwner, url + "/result", "{\"statusCode\": \"efectiva\"}").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, url + "/archive").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, url + "/restore").andExpect(status().isNotFound());
        getAs(otherFirmOwner, "/api/v1/cases/" + caseId + "/hearings").andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/cases/" + caseId + "/hearings", hearingJson("2035-08-10", "15:00", ""))
                .andExpect(status().isNotFound());
        getAs(lawyer, url).andExpect(status().isOk());
    }

    @Test
    void theAgendaOfAnotherFirmShouldNotIncludeTheHearing() throws Exception {
        getAs(otherFirmOwner, "/api/v1/agenda?from=2035-08-10")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
        getAs(otherFirmOwner, "/api/v1/agenda?from=2035-08-10&lawyerId=" + lawyerId)
                .andExpect(jsonPath("$.items", hasSize(0)));
        getAs(owner, "/api/v1/agenda?from=2035-08-10").andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void anotherFirmShouldNotFindTheCoerciveMeasuresOfADefendant() throws Exception {
        String measures = "/api/v1/defendants/" + defendantId + "/coercive-measures";
        String body = "{\"measureCode\": \"presentacion-periodica\", \"startsOn\": \"" + TODAY + "\"}";

        getAs(otherFirmOwner, measures).andExpect(status().isNotFound());
        postJson(otherFirmOwner, measures, body).andExpect(status().isNotFound());
        putJson(otherFirmOwner, "/api/v1/coercive-measures/" + measureId, body).andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/coercive-measures/" + measureId + "/lift", "{\"liftedOn\": \"" + TODAY + "\"}")
                .andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, "/api/v1/coercive-measures/" + measureId + "/archive").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, "/api/v1/coercive-measures/" + measureId + "/restore").andExpect(status().isNotFound());
        getAs(lawyer, measures).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void theDetaineeAlertsOfAnotherFirmShouldNotIncludeTheMeasure() throws Exception {
        getAs(otherFirmOwner, "/api/v1/detainee-alerts?withinDays=90")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        getAs(owner, "/api/v1/detainee-alerts?withinDays=90").andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void aHearingOfFirmBCannotReferenceRecordsOfFirmA() throws Exception {
        String ownCase = createCase(otherFirmOwner, caseJson("Caso ficticio de la firma B", ""));
        String ownDefendant = createDefendant(otherFirmOwner, ownCase, "Dora", "Vega Ejemplo");
        String hearing = hearingJson("2035-08-10", "13:00", ", \"defendantIds\": [\"" + defendantId + "\"]");

        // A defendant, a lawyer or a hearing of firm A does not exist for firm B.
        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/hearings", hearing).andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/hearings",
                        hearingJson("2035-08-10", "13:00", ", \"lawyerIds\": [\"" + lawyerId + "\"]"))
                .andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/defendants/" + ownDefendant + "/coercive-measures",
                        "{\"measureCode\": \"presentacion-periodica\", \"startsOn\": \"%s\", \"orderedByHearingId\": \"%s\"}"
                                .formatted(TODAY, hearingId))
                .andExpect(status().isNotFound());

        // Firm B's own records work and stay out of firm A's agenda.
        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/hearings",
                        hearingJson("2035-08-10", "13:00", ", \"defendantIds\": [\"" + ownDefendant + "\"]"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lawyers[0].id").value(otherFirmOwnerId.toString()));
        getAs(owner, "/api/v1/agenda?from=2035-08-10").andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void aClashShouldNotReachAcrossFirms() throws Exception {
        String ownCase = createCase(otherFirmOwner, caseJson("Caso ficticio de la firma B", ""));

        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/hearings", hearingJson("2035-08-10", "13:00", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
    }

    @Test
    void theCaseSummaryOfAnotherFirmShouldNotCountTheMeasureOrTheHearing() throws Exception {
        String ownCase = createCase(otherFirmOwner, caseJson("Caso ficticio de la firma B", ""));

        getAs(otherFirmOwner, "/api/v1/cases/" + ownCase)
                .andExpect(jsonPath("$.summary.detaineeCount").value(0))
                .andExpect(jsonPath("$.summary.nextHearing").doesNotExist());
        getAs(lawyer, "/api/v1/cases/" + caseId)
                .andExpect(jsonPath("$.summary.detaineeCount").value(1))
                .andExpect(jsonPath("$.summary.nextHearing.id").value(hearingId));
    }
}
