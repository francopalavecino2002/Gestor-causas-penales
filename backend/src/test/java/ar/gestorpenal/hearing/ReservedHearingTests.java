package ar.gestorpenal.hearing;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/** A hearing of a reserved case does not exist for a lawyer outside its team. */
class ReservedHearingTests extends HearingApiTestSupport {

    @Test
    void everyHearingEndpointShouldAnswerNotFoundForANonMemberOfAReservedCase() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String id = createHearing(lawyer, reservedCase, hearingJson("2035-09-10", "13:00", ""));
        String url = "/api/v1/hearings/" + id;

        postJson(otherLawyer, "/api/v1/cases/" + reservedCase + "/hearings", hearingJson("2035-09-11", "13:00", ""))
                .andExpect(status().isNotFound());
        getAs(otherLawyer, url).andExpect(status().isNotFound());
        putJson(otherLawyer, url, hearingJson("2035-09-10", "13:00", ", \"room\": \"Sala 1\""))
                .andExpect(status().isNotFound());
        postJson(otherLawyer, url + "/reschedule", "{\"startsAt\": \"2035-09-12T13:00:00Z\"}")
                .andExpect(status().isNotFound());
        postJson(otherLawyer, url + "/result", "{\"statusCode\": \"efectiva\"}").andExpect(status().isNotFound());
        postEmpty(otherLawyer, url + "/archive").andExpect(status().isNotFound());
        postEmpty(otherLawyer, url + "/restore").andExpect(status().isNotFound());

        getAs(lawyer, url).andExpect(status().isOk());
        getAs(owner, url).andExpect(status().isOk());
    }
}
