package ar.gestorpenal.hearing;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The case summary now shows how many defendants are detained and the next pending hearing (ADR-0016). */
class HearingCaseSummaryTests extends HearingApiTestSupport {

    private static final LocalDate TODAY = LocalDate.now(HearingCalendar.ZONE);

    private String caseId;
    private String caseUrl;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio de resumen", ""));
        caseUrl = "/api/v1/cases/" + caseId;
    }

    private String measure(String defendantId, String code) throws Exception {
        return idOf(postJson(lawyer, "/api/v1/defendants/" + defendantId + "/coercive-measures",
                        "{\"measureCode\": \"%s\", \"startsOn\": \"%s\"}".formatted(code, TODAY.minusDays(5)))
                .andExpect(status().isCreated()));
    }

    @Test
    void aCaseWithoutHearingsOrMeasuresShouldHaveNoNextHearingAndNoDetainees() throws Exception {
        getAs(lawyer, caseUrl)
                .andExpect(jsonPath("$.summary.detaineeCount").value(0))
                .andExpect(jsonPath("$.summary.nextHearing").doesNotExist());
    }

    @Test
    void shouldShowTheEarliestUpcomingPendingHearing() throws Exception {
        createHearing(lawyer, caseId, hearingJson("2035-07-12", "13:00", ""));
        String earliest = createHearing(lawyer, caseId, hearingJson("2035-07-10", "13:00", ""));
        createHearing(lawyer, caseId, hearingJson("2035-07-11", "13:00", ""));

        getAs(lawyer, caseUrl)
                .andExpect(jsonPath("$.summary.nextHearing.id").value(earliest))
                .andExpect(jsonPath("$.summary.nextHearing.startsAt").value("2035-07-10T13:00:00Z"))
                .andExpect(jsonPath("$.summary.nextHearing.typeCode").value("formulacion-de-cargos"));
        getAs(lawyer, "/api/v1/cases")
                .andExpect(jsonPath("$.items[0].summary.nextHearing.id").value(earliest));
    }

    @Test
    void shouldSkipPastHearingsAndThoseThatAreCancelledSuspendedOrHeld() throws Exception {
        createHearing(lawyer, caseId, hearingJson("2020-01-10", "13:00", ""));
        createHearing(lawyer, caseId, hearingJson("2035-07-01", "13:00",
                ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"fallas-tecnicas\""));
        createHearing(lawyer, caseId, hearingJson("2035-07-02", "13:00",
                ", \"statusCode\": \"suspendida\", \"cancellationReasonCode\": \"fallas-tecnicas\""));
        createHearing(lawyer, caseId, hearingJson("2035-07-03", "13:00", ", \"statusCode\": \"efectiva\""));
        String archived = createHearing(lawyer, caseId, hearingJson("2035-07-04", "13:00", ""));
        postEmpty(lawyer, "/api/v1/hearings/" + archived + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.nextHearing").doesNotExist());

        String pending = createHearing(lawyer, caseId, hearingJson("2035-07-20", "13:00", ""));
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.nextHearing.id").value(pending));
    }

    @Test
    void aReschedulingShouldMoveTheNextHearing() throws Exception {
        String first = createHearing(lawyer, caseId, hearingJson("2035-07-10", "13:00", ""));
        String second = createHearing(lawyer, caseId, hearingJson("2035-07-12", "13:00", ""));

        postJson(lawyer, "/api/v1/hearings/" + first + "/reschedule", "{\"startsAt\": \"2035-07-15T13:00:00Z\"}")
                .andExpect(status().isOk());

        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.nextHearing.id").value(second));
    }

    @Test
    void aMeasureOrderedAheadShouldNotMakeADetaineeUntilItStarts() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        createHearing(lawyer, caseId, hearingJson("2035-07-10", "13:00", ", \"defendantIds\": [\"" + ana + "\"]"));
        postJson(lawyer, "/api/v1/defendants/" + ana + "/coercive-measures",
                        "{\"measureCode\": \"detencion-domiciliaria\", \"startsOn\": \"%s\", \"endsOn\": \"%s\"}"
                                .formatted(TODAY.plusDays(3), TODAY.plusDays(30)))
                .andExpect(status().isCreated());

        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(0));
        getAs(lawyer, "/api/v1/agenda?from=2035-07-10").andExpect(jsonPath("$.items[0].detainee").value(false));
        getAs(lawyer, "/api/v1/detainee-alerts?withinDays=90").andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void aMeasureStartingTodayShouldCountAsDetained() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        createHearing(lawyer, caseId, hearingJson("2035-07-10", "13:00", ", \"defendantIds\": [\"" + ana + "\"]"));
        postJson(lawyer, "/api/v1/defendants/" + ana + "/coercive-measures",
                        "{\"measureCode\": \"detencion-domiciliaria\", \"startsOn\": \"%s\"}".formatted(TODAY))
                .andExpect(status().isCreated());

        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(1));
        getAs(lawyer, "/api/v1/agenda?from=2035-07-10").andExpect(jsonPath("$.items[0].detainee").value(true));
    }

    @Test
    void shouldCountDetaineesOncePerActiveDefendant() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String beto = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String carla = createDefendant(lawyer, caseId, "Carla", "Soto Ejemplo");

        measure(carla, "presentacion-periodica");
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(0));

        String anaMeasure = measure(ana, "prision-preventiva");
        measure(ana, "detencion-domiciliaria");
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(1));
        getAs(lawyer, "/api/v1/cases").andExpect(jsonPath("$.items[0].summary.detaineeCount").value(1));

        measure(beto, "detencion-domiciliaria");
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(2));

        postJson(lawyer, "/api/v1/coercive-measures/" + anaMeasure + "/lift", "{\"liftedOn\": \"" + TODAY + "\"}")
                .andExpect(status().isOk());
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(2));

        postEmpty(lawyer, caseUrl + "/defendants/" + beto + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, caseUrl).andExpect(jsonPath("$.summary.detaineeCount").value(1));
    }
}
