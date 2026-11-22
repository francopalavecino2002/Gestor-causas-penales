package ar.gestorpenal.hearing;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DetaineeAlertApiTests extends HearingApiTestSupport {

    private static final LocalDate TODAY = LocalDate.now(HearingCalendar.ZONE);
    private static final String ALERTS = "/api/v1/detainee-alerts";
    private static final String DISCLAIMER = "Cálculo asistido: verificá con la norma.";

    private String caseId;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio de detenidos", ""));
    }

    private String measure(String defendantId, String code, LocalDate startsOn, LocalDate endsOn, LocalDate review)
            throws Exception {
        String body = "{\"measureCode\": \"%s\", \"startsOn\": \"%s\"%s%s}".formatted(
                code,
                startsOn,
                endsOn == null ? "" : ", \"endsOn\": \"" + endsOn + "\"",
                review == null ? "" : ", \"nextReviewOn\": \"" + review + "\"");
        return idOf(postJson(lawyer, "/api/v1/defendants/" + defendantId + "/coercive-measures", body)
                .andExpect(status().isCreated()));
    }

    @Test
    void shouldListTheAlertsMostUrgentFirstWithTheirSourceAndDisclaimer() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String beto = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String carla = createDefendant(lawyer, caseId, "Carla", "Soto Ejemplo");
        String preventive = measure(ana, "prision-preventiva", TODAY.minusDays(100), TODAY.plusDays(5), TODAY.plusDays(10));
        String houseArrest = measure(beto, "detencion-domiciliaria", TODAY.minusDays(30), TODAY.minusDays(2), null);
        String noDuration = measure(carla, "prision-preventiva", TODAY.minusDays(10), null, null);
        // Not custodial: never an alert, whatever its dates.
        measure(carla, "presentacion-periodica", TODAY.minusDays(10), TODAY.plusDays(1), TODAY.plusDays(1));

        getAs(otherLawyer, ALERTS)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].kind").value("ENDS"))
                .andExpect(jsonPath("$[0].measureId").value(houseArrest))
                .andExpect(jsonPath("$[0].daysLeft").value(-2))
                .andExpect(jsonPath("$[0].dueOn").value(TODAY.minusDays(2).toString()))
                .andExpect(jsonPath("$[0].article").value("116"))
                .andExpect(jsonPath("$[0].defendantId").value(beto))
                .andExpect(jsonPath("$[0].defendantName").value("Paz Ejemplo, Beto"))
                .andExpect(jsonPath("$[0].caseId").value(caseId))
                .andExpect(jsonPath("$[0].caseCaption").value("Caso ficticio de detenidos"))
                .andExpect(jsonPath("$[0].disclaimer").value(DISCLAIMER))
                .andExpect(jsonPath("$[1].kind").value("ENDS"))
                .andExpect(jsonPath("$[1].measureId").value(preventive))
                .andExpect(jsonPath("$[1].daysLeft").value(5))
                .andExpect(jsonPath("$[2].kind").value("REVIEW"))
                .andExpect(jsonPath("$[2].measureId").value(preventive))
                .andExpect(jsonPath("$[2].daysLeft").value(10))
                .andExpect(jsonPath("$[2].article").value("118"))
                .andExpect(jsonPath("$[3].kind").value("NO_DURATION"))
                .andExpect(jsonPath("$[3].measureId").value(noDuration))
                .andExpect(jsonPath("$[3].dueOn").doesNotExist())
                .andExpect(jsonPath("$[3].daysLeft").doesNotExist());
    }

    @Test
    void shouldHonourTheWindowAndRejectOneOutsideOneToNinetyDays() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        measure(ana, "prision-preventiva", TODAY.minusDays(100), TODAY.plusDays(60), TODAY.plusDays(10));

        getAs(lawyer, ALERTS + "?withinDays=7").andExpect(jsonPath("$", hasSize(0)));
        getAs(lawyer, ALERTS + "?withinDays=10").andExpect(jsonPath("$", hasSize(1)));
        getAs(lawyer, ALERTS + "?withinDays=90").andExpect(jsonPath("$", hasSize(2)));
        getAs(lawyer, ALERTS + "?withinDays=0").andExpect(status().isBadRequest());
        getAs(lawyer, ALERTS + "?withinDays=91").andExpect(status().isBadRequest());
    }

    @Test
    void shouldAlertWhenPreventivePrisonReachesItsMaximumDuration() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        LocalDate startsOn = TODAY.minusYears(1).plusDays(7);
        String id = measure(ana, "prision-preventiva", startsOn, TODAY.plusDays(60), null);

        getAs(lawyer, ALERTS)
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].kind").value("MAX_DURATION"))
                .andExpect(jsonPath("$[0].measureId").value(id))
                .andExpect(jsonPath("$[0].article").value("119"))
                .andExpect(jsonPath("$[0].dueOn").value(startsOn.plusYears(1).toString()))
                .andExpect(jsonPath("$[0].daysLeft").value(ChronoUnit.DAYS.between(TODAY, startsOn.plusYears(1))));
    }

    @Test
    void shouldNotAlertAboutLiftedArchivedOrArchivedDefendantsMeasures() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String beto = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String carla = createDefendant(lawyer, caseId, "Carla", "Soto Ejemplo");
        String lifted = measure(ana, "detencion-domiciliaria", TODAY.minusDays(30), TODAY.plusDays(2), null);
        String archived = measure(beto, "detencion-domiciliaria", TODAY.minusDays(30), TODAY.plusDays(2), null);
        measure(carla, "detencion-domiciliaria", TODAY.minusDays(30), TODAY.plusDays(2), null);
        getAs(lawyer, ALERTS).andExpect(jsonPath("$", hasSize(3)));

        postJson(lawyer, "/api/v1/coercive-measures/" + lifted + "/lift", "{\"liftedOn\": \"" + TODAY + "\"}")
                .andExpect(status().isOk());
        postEmpty(lawyer, "/api/v1/coercive-measures/" + archived + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, ALERTS).andExpect(jsonPath("$", hasSize(1)));

        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + carla + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, ALERTS).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldNotAlertAboutAnArchivedCase() throws Exception {
        String ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        measure(ana, "detencion-domiciliaria", TODAY.minusDays(30), TODAY.plusDays(2), null);
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());

        getAs(lawyer, ALERTS).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldHideTheAlertsOfAReservedCaseFromThoseOutsideItsTeam() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String ana = createDefendant(lawyer, reservedCase, "Ana", "Quiroga Ejemplo");
        measure(ana, "detencion-domiciliaria", TODAY.minusDays(30), TODAY.plusDays(2), null);

        getAs(otherLawyer, ALERTS).andExpect(jsonPath("$", hasSize(0)));
        getAs(paralegal, ALERTS).andExpect(jsonPath("$", hasSize(0)));
        getAs(lawyer, ALERTS).andExpect(jsonPath("$", hasSize(1)));
        getAs(owner, ALERTS).andExpect(jsonPath("$", hasSize(1)));
    }
}
