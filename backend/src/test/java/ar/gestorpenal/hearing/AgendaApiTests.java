package ar.gestorpenal.hearing;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The agenda shows local days of Neuquén's zone (UTC-3), so a hearing at 23:30 local belongs to that
 * day even though its UTC date is the next one.
 */
class AgendaApiTests extends HearingApiTestSupport {

    private static final String AGENDA = "/api/v1/agenda";

    private String caseId;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio de agenda", ""));
    }

    private String hearingAtUtc(String utcDay, String utcTime, String extraFields) throws Exception {
        return createHearing(lawyer, caseId, hearingJson(utcDay, utcTime, extraFields));
    }

    @Test
    void shouldAssignAHearingToItsLocalDayNotItsUtcDay() throws Exception {
        String morning = hearingAtUtc("2035-05-10", "13:00", "");
        String lateNight = hearingAtUtc("2035-05-11", "02:30", "");
        String previousNight = hearingAtUtc("2035-05-10", "02:30", "");
        String midnight = hearingAtUtc("2035-05-11", "03:00", "");

        getAs(lawyer, AGENDA + "?from=2035-05-10&to=2035-05-10")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2035-05-10"))
                .andExpect(jsonPath("$.to").value("2035-05-10"))
                .andExpect(jsonPath("$.timeZone").value("America/Argentina/Salta"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].hearingId").value(morning))
                .andExpect(jsonPath("$.items[1].hearingId").value(lateNight));
        getAs(lawyer, AGENDA + "?from=2035-05-09&to=2035-05-09")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(previousNight));
        getAs(lawyer, AGENDA + "?from=2035-05-11&to=2035-05-11")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(midnight));
    }

    @Test
    void shouldListARangeOfDaysInChronologicalOrder() throws Exception {
        String third = hearingAtUtc("2035-05-12", "13:00", "");
        String first = hearingAtUtc("2035-05-10", "13:00", "");
        String second = hearingAtUtc("2035-05-11", "13:00", "");
        hearingAtUtc("2035-05-14", "13:00", "");

        getAs(lawyer, AGENDA + "?from=2035-05-10&to=2035-05-12")
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].hearingId").value(first))
                .andExpect(jsonPath("$.items[1].hearingId").value(second))
                .andExpect(jsonPath("$.items[2].hearingId").value(third));
    }

    @Test
    void aSingleFromShouldShowOnlyThatDay() throws Exception {
        String today = hearingAtUtc("2035-05-10", "13:00", "");
        hearingAtUtc("2035-05-11", "13:00", "");

        getAs(lawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.to").value("2035-05-10"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(today));
    }

    @Test
    void withoutParametersItShouldShowTodayInTheFirmsZone() throws Exception {
        String today = LocalDate.now(HearingCalendar.ZONE).toString();

        getAs(lawyer, AGENDA)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(today))
                .andExpect(jsonPath("$.to").value(today))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void shouldFilterByLawyer() throws Exception {
        String mine = hearingAtUtc("2035-05-10", "13:00", "");
        String theirs = hearingAtUtc("2035-05-10", "15:00", ", \"lawyerIds\": [\"" + otherLawyerId + "\"]");

        getAs(owner, AGENDA + "?from=2035-05-10&lawyerId=" + otherLawyerId)
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(theirs));
        getAs(owner, AGENDA + "?from=2035-05-10&lawyerId=" + lawyerId)
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(mine));
        getAs(owner, AGENDA + "?from=2035-05-10").andExpect(jsonPath("$.items", hasSize(2)));
        getAs(owner, AGENDA + "?from=2035-05-10&lawyerId=" + paralegalId).andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void shouldRejectARangeOfMoreThan31DaysOrBackwards() throws Exception {
        getAs(lawyer, AGENDA + "?from=2035-05-01&to=2035-06-01").andExpect(status().isBadRequest());
        getAs(lawyer, AGENDA + "?from=2035-05-01&to=2035-05-31").andExpect(status().isOk());
        getAs(lawyer, AGENDA + "?from=2035-05-10&to=2035-05-09")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-data"));
    }

    @Test
    void shouldLeaveOutArchivedHearingsAndHearingsOfArchivedCases() throws Exception {
        String kept = hearingAtUtc("2035-05-10", "13:00", "");
        String archived = hearingAtUtc("2035-05-10", "15:00", "");
        postEmpty(lawyer, "/api/v1/hearings/" + archived + "/archive").andExpect(status().isNoContent());
        String otherCase = createCase(lawyer, caseJson("Caso archivado ficticio", ""));
        createHearing(lawyer, otherCase, hearingJson("2035-05-10", "17:00", ""));
        postEmpty(lawyer, "/api/v1/cases/" + otherCase + "/archive").andExpect(status().isNoContent());

        getAs(lawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(kept));
    }

    @Test
    void shouldHideHearingsOfAReservedCaseFromThoseWhoCannotSeeIt() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String reserved = createHearing(lawyer, reservedCase, hearingJson("2035-05-10", "13:00", ""));
        String open = hearingAtUtc("2035-05-10", "15:00", "");

        getAs(otherLawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(open));
        getAs(paralegal, AGENDA + "?from=2035-05-10").andExpect(jsonPath("$.items", hasSize(1)));
        getAs(lawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[*].hearingId", hasItem(reserved)));
        getAs(owner, AGENDA + "?from=2035-05-10").andExpect(jsonPath("$.items", hasSize(2)));
        getAs(otherLawyer, "/api/v1/hearings/" + reserved).andExpect(status().isNotFound());
        getAs(otherLawyer, "/api/v1/cases/" + reservedCase + "/hearings").andExpect(status().isNotFound());
    }

    @Test
    void shouldShowTheDetailsOfEachItem() throws Exception {
        String defendant = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String id = hearingAtUtc("2035-05-10", "13:00", """
                , "durationMinutes": 45, "room": "Sala 3", "judge": "Juez Ficticio",
                "defendantIds": ["%s"]""".formatted(defendant));

        getAs(lawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.items[0].hearingId").value(id))
                .andExpect(jsonPath("$.items[0].caseId").value(caseId))
                .andExpect(jsonPath("$.items[0].caseCaption").value("Caso ficticio de agenda"))
                .andExpect(jsonPath("$.items[0].typeCode").value("formulacion-de-cargos"))
                .andExpect(jsonPath("$.items[0].typeName").value("Formulación de cargos"))
                .andExpect(jsonPath("$.items[0].typeArticle").isNotEmpty())
                .andExpect(jsonPath("$.items[0].statusCode").value("programada"))
                .andExpect(jsonPath("$.items[0].statusName").isNotEmpty())
                .andExpect(jsonPath("$.items[0].startsAt").value("2035-05-10T13:00:00Z"))
                .andExpect(jsonPath("$.items[0].durationMinutes").value(45))
                .andExpect(jsonPath("$.items[0].room").value("Sala 3"))
                .andExpect(jsonPath("$.items[0].judge").value("Juez Ficticio"))
                .andExpect(jsonPath("$.items[0].defendants[0].name").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.items[0].lawyers[0].name").value("Abogado Ficticio"))
                .andExpect(jsonPath("$.items[0].detainee").value(false))
                .andExpect(jsonPath("$.items[0].hasClash").value(false));
    }

    @Test
    void shouldFlagAHearingWhoseDefendantIsDetainedUntilTheMeasureIsLifted() throws Exception {
        String detained = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String free = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String withDetainee = hearingAtUtc("2035-05-10", "13:00", ", \"defendantIds\": [\"" + detained + "\"]");
        hearingAtUtc("2035-05-10", "15:00", ", \"defendantIds\": [\"" + free + "\"]");
        LocalDate start = LocalDate.now(HearingCalendar.ZONE).minusDays(3);
        String measure = idOf(postJson(lawyer, "/api/v1/defendants/" + detained + "/coercive-measures",
                        "{\"measureCode\": \"detencion-domiciliaria\", \"startsOn\": \"" + start + "\"}")
                .andExpect(status().isCreated()));

        getAs(lawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.items[0].hearingId").value(withDetainee))
                .andExpect(jsonPath("$.items[0].detainee").value(true))
                .andExpect(jsonPath("$.items[1].detainee").value(false));

        postJson(lawyer, "/api/v1/coercive-measures/" + measure + "/lift",
                        "{\"liftedOn\": \"" + LocalDate.now(HearingCalendar.ZONE) + "\"}")
                .andExpect(status().isOk());
        getAs(lawyer, AGENDA + "?from=2035-05-10").andExpect(jsonPath("$.items[0].detainee").value(false));
    }

    @Test
    void shouldFlagHearingsThatClashAndNotThoseThatDoNot() throws Exception {
        String first = hearingAtUtc("2035-05-10", "13:00", "");
        String second = hearingAtUtc("2035-05-10", "13:30", "");
        hearingAtUtc("2035-05-10", "18:00", "");

        getAs(lawyer, AGENDA + "?from=2035-05-10")
                .andExpect(jsonPath("$.items[0].hearingId").value(first))
                .andExpect(jsonPath("$.items[0].hasClash").value(true))
                .andExpect(jsonPath("$.items[1].hearingId").value(second))
                .andExpect(jsonPath("$.items[1].hasClash").value(true))
                .andExpect(jsonPath("$.items[2].hasClash").value(false));
    }

    @Test
    void aClashWithAHearingOfThePreviousLocalDayShouldStillBeFlagged() throws Exception {
        // 23:30 to 00:30 local on May 10, and 00:00 to 01:00 local on May 11: they overlap at midnight.
        hearingAtUtc("2035-05-11", "02:30", ", \"durationMinutes\": 60");
        String midnight = hearingAtUtc("2035-05-11", "03:00", "");

        getAs(lawyer, AGENDA + "?from=2035-05-11&to=2035-05-11")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].hearingId").value(midnight))
                .andExpect(jsonPath("$.items[0].hasClash").value(true));
    }
}
