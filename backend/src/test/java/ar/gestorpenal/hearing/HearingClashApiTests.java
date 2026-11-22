package ar.gestorpenal.hearing;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Overlapping hearings of the same lawyer are warnings next to the hearing, never errors. */
class HearingClashApiTests extends HearingApiTestSupport {

    private static final String DAY = "2035-04-10";

    private String caseId;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio con choques", ""));
    }

    private String hearingAt(String utcTime, String extraFields) throws Exception {
        return createHearing(lawyer, caseId, hearingJson(DAY, utcTime, extraFields));
    }

    @Test
    void shouldWarnAboutAnOverlapForASharedLawyerWithoutRejectingTheHearing() throws Exception {
        String first = hearingAt("13:00", "");

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, "13:30", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(1)))
                .andExpect(jsonPath("$.clashes[0].hearingId").value(first))
                .andExpect(jsonPath("$.clashes[0].userId").value(lawyerId.toString()))
                .andExpect(jsonPath("$.clashes[0].startsAt").value("2035-04-10T13:00:00Z"))
                .andExpect(jsonPath("$.clashes[0].caseId").value(caseId))
                .andExpect(jsonPath("$.clashes[0].caseCaption").value("Caso ficticio con choques"))
                .andExpect(jsonPath("$.clashes[0].reserved").value(false));
        getAs(lawyer, "/api/v1/hearings/" + first).andExpect(jsonPath("$.clashes", hasSize(1)));
    }

    @Test
    void shouldNotClashForDifferentLawyers() throws Exception {
        hearingAt("13:00", "");

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings",
                        hearingJson(DAY, "13:30", ", \"lawyerIds\": [\"" + otherLawyerId + "\"]"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
    }

    @Test
    void shouldNotClashWhenOneHearingStartsWhenTheOtherEnds() throws Exception {
        hearingAt("13:00", "");

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, "14:00", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, "12:00", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
    }

    @Test
    void shouldNotClashWithACancelledOrSuspendedHearing() throws Exception {
        hearingAt("13:00", ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"fallas-tecnicas\"");
        hearingAt("13:00", ", \"statusCode\": \"suspendida\", \"cancellationReasonCode\": \"fallas-tecnicas\"");

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, "13:15", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
    }

    @Test
    void aHearingThatBecomesCancelledShouldStopClashing() throws Exception {
        String first = hearingAt("13:00", "");
        String second = hearingAt("13:30", "");
        getAs(lawyer, "/api/v1/hearings/" + second).andExpect(jsonPath("$.clashes", hasSize(1)));

        putJson(lawyer, "/api/v1/hearings/" + first, hearingJson(DAY, "13:00",
                        ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"fallas-tecnicas\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
        getAs(lawyer, "/api/v1/hearings/" + second).andExpect(jsonPath("$.clashes", hasSize(0)));
    }

    @Test
    void anArchivedHearingShouldNotClash() throws Exception {
        String first = hearingAt("13:00", "");
        postEmpty(lawyer, "/api/v1/hearings/" + first + "/archive").andExpect(status().isNoContent());

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, "13:15", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(0)));
    }

    @Test
    void reschedulingIntoAnOverlapShouldWarn() throws Exception {
        hearingAt("13:00", "");
        String second = hearingAt("16:00", "");

        postJson(lawyer, "/api/v1/hearings/" + second + "/reschedule", "{\"startsAt\": \"2035-04-10T13:15:00Z\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clashes", hasSize(1)));
    }

    @Test
    void aClashWithAReservedCaseTheUserCannotSeeShouldBeMasked() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        createHearing(lawyer, reservedCase, hearingJson(DAY, "13:00", ""));

        postJson(otherLawyer, "/api/v1/cases/" + caseId + "/hearings",
                        hearingJson(DAY, "13:15", ", \"lawyerIds\": [\"" + lawyerId + "\"]"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clashes", hasSize(1)))
                .andExpect(jsonPath("$.clashes[0].reserved").value(true))
                .andExpect(jsonPath("$.clashes[0].userId").value(lawyerId.toString()))
                .andExpect(jsonPath("$.clashes[0].caseId").doesNotExist())
                .andExpect(jsonPath("$.clashes[0].caseCaption").doesNotExist());
    }

    @Test
    void theTeamAndTheOwnerShouldSeeTheReservedCaseInAClash() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        createHearing(lawyer, reservedCase, hearingJson(DAY, "13:00", ""));
        String open = createHearing(otherLawyer, caseId, hearingJson(DAY, "13:15", ", \"lawyerIds\": [\"" + lawyerId + "\"]"));

        getAs(lawyer, "/api/v1/hearings/" + open)
                .andExpect(jsonPath("$.clashes[0].reserved").value(false))
                .andExpect(jsonPath("$.clashes[0].caseId").value(reservedCase))
                .andExpect(jsonPath("$.clashes[0].caseCaption").value("Caso reservado ficticio"));
        getAs(owner, "/api/v1/hearings/" + open)
                .andExpect(jsonPath("$.clashes[0].caseId").value(reservedCase));
    }
}
