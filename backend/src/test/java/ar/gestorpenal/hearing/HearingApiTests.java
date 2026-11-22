package ar.gestorpenal.hearing;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

class HearingApiTests extends HearingApiTestSupport {

    private static final String DAY = "2035-03-12";
    private static final String TIME = "13:00";

    @Autowired
    private JdbcTemplate jdbc;

    private String caseId;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio uno", ""));
    }

    @Test
    void shouldCreateAHearingForTheResponsibleLawyerWithTheDefaults() throws Exception {
        postJson(paralegal, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, TIME, ""))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/hearings/")))
                .andExpect(jsonPath("$.caseId").value(caseId))
                .andExpect(jsonPath("$.caseCaption").value("Caso ficticio uno"))
                .andExpect(jsonPath("$.typeCode").value("formulacion-de-cargos"))
                .andExpect(jsonPath("$.typeName").value("Formulación de cargos"))
                .andExpect(jsonPath("$.startsAt").value("2035-03-12T13:00:00Z"))
                .andExpect(jsonPath("$.durationMinutes").value(60))
                .andExpect(jsonPath("$.statusCode").value("programada"))
                .andExpect(jsonPath("$.lawyers", hasSize(1)))
                .andExpect(jsonPath("$.lawyers[0].id").value(lawyerId.toString()))
                .andExpect(jsonPath("$.defendants", hasSize(0)))
                .andExpect(jsonPath("$.clashes", hasSize(0)))
                .andExpect(jsonPath("$.reschedules", hasSize(0)))
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void shouldCreateAHearingWithTheGivenDefendantsLawyersAndDetails() throws Exception {
        String defendant = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String body = hearingJson(DAY, TIME, """
                , "durationMinutes": 90, "room": "Sala 3", "judge": "Juez Ficticio", "ofijuReference": "OF-1",
                "requestedBy": "DEFENCE", "notes": "Llevar el informe",
                "defendantIds": ["%s"], "lawyerIds": ["%s", "%s"]""".formatted(defendant, lawyerId, otherLawyerId));

        String id = idOf(postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", body).andExpect(status().isCreated()));

        getAs(otherLawyer, "/api/v1/hearings/" + id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.durationMinutes").value(90))
                .andExpect(jsonPath("$.room").value("Sala 3"))
                .andExpect(jsonPath("$.judge").value("Juez Ficticio"))
                .andExpect(jsonPath("$.requestedBy").value("DEFENCE"))
                .andExpect(jsonPath("$.defendants", hasSize(1)))
                .andExpect(jsonPath("$.defendants[0].id").value(defendant))
                .andExpect(jsonPath("$.defendants[0].name").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.lawyers", hasSize(2)));
    }

    @Test
    void shouldRejectAnUnknownHearingTypeAndAnUnknownStatus() throws Exception {
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings",
                        "{\"typeCode\": \"no-existe\", \"startsAt\": \"2035-03-12T13:00:00Z\"}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-data"));
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings",
                        hearingJson(DAY, TIME, ", \"statusCode\": \"inventada\""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectAHearingWithoutTypeOrDateOrWithAnInvalidDuration() throws Exception {
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", "{}").andExpect(status().isBadRequest());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, TIME, ", \"durationMinutes\": 4"))
                .andExpect(status().isBadRequest());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, TIME, ", \"durationMinutes\": 1441"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectADefendantOfAnotherCaseAndAnEmptyLawyerList() throws Exception {
        String otherCase = createCase(lawyer, caseJson("Otro caso ficticio", ""));
        String foreignDefendant = createDefendant(lawyer, otherCase, "Beto", "Paz Ejemplo");

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings",
                        hearingJson(DAY, TIME, ", \"defendantIds\": [\"" + foreignDefendant + "\"]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-data"));
        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, TIME, ", \"lawyerIds\": []"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReplaceTheDetailsDefendantsAndLawyersOnUpdateKeepingWhatWasOmitted() throws Exception {
        String first = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String second = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME,
                ", \"durationMinutes\": 90, \"defendantIds\": [\"" + first + "\"]"));
        String url = "/api/v1/hearings/" + id;

        putJson(paralegal, url, hearingJson(DAY, TIME, ", \"room\": \"Sala 5\", \"judge\": \"Jueza Ficticia\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room").value("Sala 5"))
                .andExpect(jsonPath("$.durationMinutes").value(90))
                .andExpect(jsonPath("$.statusCode").value("programada"))
                .andExpect(jsonPath("$.defendants[0].id").value(first))
                .andExpect(jsonPath("$.lawyers[0].id").value(lawyerId.toString()));

        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"defendantIds\": [\"" + second + "\"], \"lawyerIds\": [\""
                        + otherLawyerId + "\"]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room").doesNotExist())
                .andExpect(jsonPath("$.defendants", hasSize(1)))
                .andExpect(jsonPath("$.defendants[0].id").value(second))
                .andExpect(jsonPath("$.lawyers", hasSize(1)))
                .andExpect(jsonPath("$.lawyers[0].id").value(otherLawyerId.toString()));
    }

    @Test
    void theDateShouldOnlyChangeByRescheduling() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));

        putJson(lawyer, "/api/v1/hearings/" + id, hearingJson(DAY, "14:00", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The date of a hearing changes by rescheduling it"));
    }

    @Test
    void shouldApplyTheStatusRulesOnUpdate() throws Exception {
        String url = "/api/v1/hearings/" + createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));

        // A cancellation reason needs a cancelled or suspended hearing.
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"cancellationReasonCode\": \"fallas-tecnicas\""))
                .andExpect(status().isBadRequest());
        // Reconverted needs the type it was held as, and only reconverted accepts it.
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"statusCode\": \"reconvertida\""))
                .andExpect(status().isBadRequest());
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"statusCode\": \"efectiva\", \"heldAsTypeCode\": \"juicio-directo\""))
                .andExpect(status().isBadRequest());
        // A result needs a hearing that took place.
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"statusCode\": \"programada\", \"resultSummary\": \"Resuelto\""))
                .andExpect(status().isBadRequest());
        // reprogramada is reached by rescheduling.
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"statusCode\": \"reprogramada\""))
                .andExpect(status().isBadRequest());

        putJson(lawyer, url, hearingJson(DAY, TIME,
                        ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"fallas-tecnicas\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("cancelada"))
                .andExpect(jsonPath("$.cancellationReasonCode").value("fallas-tecnicas"));
        putJson(lawyer, url, hearingJson(DAY, TIME,
                        ", \"statusCode\": \"reconvertida\", \"heldAsTypeCode\": \"juicio-directo\", \"resultSummary\": \"Se hizo juicio\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("reconvertida"))
                .andExpect(jsonPath("$.heldAsTypeCode").value("juicio-directo"))
                .andExpect(jsonPath("$.cancellationReasonCode").doesNotExist());
    }

    @Test
    void shouldKeepAHistoryOfReschedulesNewestFirst() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        String url = "/api/v1/hearings/" + id;

        postJson(otherLawyer, url + "/reschedule",
                        "{\"startsAt\": \"2035-03-14T13:00:00Z\", \"reason\": \"Pedido de la defensa\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("reprogramada"))
                .andExpect(jsonPath("$.startsAt").value("2035-03-14T13:00:00Z"))
                .andExpect(jsonPath("$.reschedules", hasSize(1)))
                .andExpect(jsonPath("$.reschedules[0].previousStartsAt").value("2035-03-12T13:00:00Z"))
                .andExpect(jsonPath("$.reschedules[0].newStartsAt").value("2035-03-14T13:00:00Z"))
                .andExpect(jsonPath("$.reschedules[0].reason").value("Pedido de la defensa"))
                .andExpect(jsonPath("$.reschedules[0].createdByUserId").value(otherLawyerId.toString()));
        postJson(lawyer, url + "/reschedule", "{\"startsAt\": \"2035-03-15T13:00:00Z\"}").andExpect(status().isOk());

        getAs(lawyer, url)
                .andExpect(jsonPath("$.reschedules", hasSize(2)))
                .andExpect(jsonPath("$.reschedules[0].newStartsAt").value("2035-03-15T13:00:00Z"))
                .andExpect(jsonPath("$.reschedules[1].newStartsAt").value("2035-03-14T13:00:00Z"));
    }

    @Test
    void shouldRejectReschedulingToTheSameTimeAndReschedulingACancelledHearing() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        String url = "/api/v1/hearings/" + id;

        postJson(lawyer, url + "/reschedule", "{\"startsAt\": \"2035-03-12T13:00:00Z\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, url + "/reschedule", "{}").andExpect(status().isBadRequest());

        putJson(lawyer, url, hearingJson(DAY, TIME,
                        ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"pedido-del-fiscal\""))
                .andExpect(status().isOk());
        postJson(lawyer, url + "/reschedule", "{\"startsAt\": \"2035-03-20T13:00:00Z\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-state"));
    }

    @Test
    void aSuspendedHearingShouldBeReschedulable() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        String url = "/api/v1/hearings/" + id;
        putJson(lawyer, url, hearingJson(DAY, TIME,
                        ", \"statusCode\": \"suspendida\", \"cancellationReasonCode\": \"ausencia-del-imputado\""))
                .andExpect(status().isOk());

        postJson(lawyer, url + "/reschedule", "{\"startsAt\": \"2035-03-20T13:00:00Z\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("reprogramada"))
                .andExpect(jsonPath("$.cancellationReasonCode").doesNotExist());
    }

    @Test
    void shouldRecordAResultAndCreateTheLinkedNextHearing() throws Exception {
        String defendant = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME,
                ", \"defendantIds\": [\"" + defendant + "\"], \"lawyerIds\": [\"" + lawyerId + "\", \"" + otherLawyerId + "\"]"));

        String result = """
                {"statusCode": "cuarto-intermedio", "resultSummary": "Se pasó a cuarto intermedio",
                 "nextHearing": {"typeCode": "formulacion-de-cargos", "startsAt": "2035-03-13T13:00:00Z",
                                 "durationMinutes": 30, "room": "Sala 2"}}""";
        String nextId = postJson(otherLawyer, "/api/v1/hearings/" + id + "/result", result)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("cuarto-intermedio"))
                .andExpect(jsonPath("$.resultSummary").value("Se pasó a cuarto intermedio"))
                .andReturn().getResponse().getContentAsString();
        nextId = com.jayway.jsonpath.JsonPath.read(nextId, "$.nextHearingId");

        getAs(lawyer, "/api/v1/hearings/" + nextId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseId").value(caseId))
                .andExpect(jsonPath("$.statusCode").value("programada"))
                .andExpect(jsonPath("$.startsAt").value("2035-03-13T13:00:00Z"))
                .andExpect(jsonPath("$.durationMinutes").value(30))
                .andExpect(jsonPath("$.room").value("Sala 2"))
                .andExpect(jsonPath("$.defendants[0].id").value(defendant))
                .andExpect(jsonPath("$.lawyers", hasSize(2)));
        getAs(lawyer, "/api/v1/cases/" + caseId + "/hearings").andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void shouldRecordAReconvertedResultWithoutAFollowUp() throws Exception {
        String url = "/api/v1/hearings/" + createHearing(lawyer, caseId, hearingJson(DAY, TIME, "")) + "/result";

        postJson(lawyer, url, "{\"statusCode\": \"reconvertida\"}").andExpect(status().isBadRequest());
        postJson(lawyer, url, "{\"statusCode\": \"reconvertida\", \"heldAsTypeCode\": \"juicio-directo\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("reconvertida"))
                .andExpect(jsonPath("$.heldAsTypeCode").value("juicio-directo"))
                .andExpect(jsonPath("$.nextHearingId").doesNotExist());
        getAs(lawyer, "/api/v1/cases/" + caseId + "/hearings").andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void theResultShouldOnlyBeAnOutcomeOfAHearingThatTookPlace() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        String url = "/api/v1/hearings/" + id;

        postJson(lawyer, url + "/result", "{\"statusCode\": \"cancelada\"}").andExpect(status().isBadRequest());
        postJson(lawyer, url + "/result", "{\"statusCode\": \"programada\"}").andExpect(status().isBadRequest());
        postJson(lawyer, url + "/result", "{\"statusCode\": \"efectiva\", \"heldAsTypeCode\": \"juicio-directo\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, url + "/result",
                        "{\"statusCode\": \"efectiva\", \"nextHearing\": {\"typeCode\": \"no-existe\", \"startsAt\": \"2035-03-13T13:00:00Z\"}}")
                .andExpect(status().isBadRequest());

        putJson(lawyer, url, hearingJson(DAY, TIME,
                        ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"fallas-tecnicas\""))
                .andExpect(status().isOk());
        postJson(lawyer, url + "/result", "{\"statusCode\": \"efectiva\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-state"));
    }

    @Test
    void anArchivedHearingShouldBeReadOnlyUntilItIsRestored() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        String url = "/api/v1/hearings/" + id;

        postEmpty(paralegal, url + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, url + "/archive").andExpect(status().isNoContent());

        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"room\": \"Sala 9\""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));
        postJson(lawyer, url + "/reschedule", "{\"startsAt\": \"2035-03-20T13:00:00Z\"}")
                .andExpect(status().isConflict());
        postJson(lawyer, url + "/result", "{\"statusCode\": \"efectiva\"}").andExpect(status().isConflict());
        getAs(lawyer, url).andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(true));
        getAs(lawyer, "/api/v1/cases/" + caseId + "/hearings").andExpect(jsonPath("$", hasSize(0)));
        getAs(lawyer, "/api/v1/cases/" + caseId + "/hearings?includeArchived=true").andExpect(jsonPath("$", hasSize(1)));

        postEmpty(paralegal, url + "/restore").andExpect(status().isForbidden());
        postEmpty(lawyer, url + "/restore").andExpect(status().isNoContent());
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"room\": \"Sala 9\"")).andExpect(status().isOk());
    }

    @Test
    void anArchivedCaseShouldNotGetNewHearingsOrEditsUntilItIsRestored() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());

        postJson(lawyer, "/api/v1/cases/" + caseId + "/hearings", hearingJson(DAY, TIME, ""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));
        putJson(lawyer, "/api/v1/hearings/" + id, hearingJson(DAY, TIME, "")).andExpect(status().isConflict());
        getAs(lawyer, "/api/v1/hearings/" + id).andExpect(status().isOk());
    }

    @Test
    void aMistakenCancellationCanBeUndoneByEditingTheStatusBack() throws Exception {
        String url = "/api/v1/hearings/" + createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        putJson(lawyer, url, hearingJson(DAY, TIME,
                        ", \"statusCode\": \"cancelada\", \"cancellationReasonCode\": \"fallas-tecnicas\""))
                .andExpect(status().isOk());

        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"statusCode\": \"programada\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value("programada"))
                .andExpect(jsonPath("$.cancellationReasonCode").doesNotExist());
    }

    @Test
    void aHearingThatAlreadyHasAResultCannotBeRescheduled() throws Exception {
        String url = "/api/v1/hearings/" + createHearing(lawyer, caseId, hearingJson(DAY, TIME, ""));
        for (String result : new String[] {
            "{\"statusCode\": \"efectiva\"}",
            "{\"statusCode\": \"reconvertida\", \"heldAsTypeCode\": \"juicio-directo\"}",
            "{\"statusCode\": \"cuarto-intermedio\"}"
        }) {
            postJson(lawyer, url + "/result", result).andExpect(status().isOk());
            postJson(lawyer, url + "/reschedule", "{\"startsAt\": \"2035-03-20T13:00:00Z\"}")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-state"));
        }
    }

    @Test
    void aSecondNextHearingShouldBeRefused() throws Exception {
        String url = "/api/v1/hearings/" + createHearing(lawyer, caseId, hearingJson(DAY, TIME, "")) + "/result";
        String withNext = "{\"statusCode\": \"cuarto-intermedio\", \"nextHearing\": "
                + "{\"typeCode\": \"formulacion-de-cargos\", \"startsAt\": \"2035-03-13T13:00:00Z\"}}";
        postJson(lawyer, url, withNext).andExpect(status().isOk());

        postJson(lawyer, url, withNext)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-state"));
        postJson(lawyer, url, "{\"statusCode\": \"efectiva\"}").andExpect(status().isOk());
        getAs(lawyer, "/api/v1/cases/" + caseId + "/hearings").andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void anArchivedDefendantOrInactiveLawyerAlreadyAttachedIsKeptButNewOnesAreRefused() throws Exception {
        String attached = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String other = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String url = "/api/v1/hearings/" + createHearing(lawyer, caseId, hearingJson(DAY, TIME,
                ", \"defendantIds\": [\"" + attached + "\"], \"lawyerIds\": [\"" + lawyerId + "\", \"" + otherLawyerId + "\"]"));
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + attached + "/archive").andExpect(status().isNoContent());
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + other + "/archive").andExpect(status().isNoContent());
        jdbc.update("UPDATE app_user SET archived_at = now() WHERE id IN (?, ?)", otherLawyerId, paralegalId);

        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"room\": \"Sala 7\", \"defendantIds\": [\"" + attached
                        + "\"], \"lawyerIds\": [\"" + lawyerId + "\", \"" + otherLawyerId + "\"]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room").value("Sala 7"))
                .andExpect(jsonPath("$.defendants", hasSize(1)))
                .andExpect(jsonPath("$.lawyers", hasSize(2)));
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"defendantIds\": [\"" + attached + "\", \"" + other + "\"]"))
                .andExpect(status().isBadRequest());
        putJson(lawyer, url, hearingJson(DAY, TIME, ", \"lawyerIds\": [\"" + lawyerId + "\", \"" + paralegalId + "\"]"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theFollowUpShouldCopyOnlyActiveDefendantsAndLawyersFallingBackToTheResponsible() throws Exception {
        String archived = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        String active = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME,
                ", \"defendantIds\": [\"" + archived + "\", \"" + active + "\"], \"lawyerIds\": [\"" + lawyerId + "\", \""
                        + otherLawyerId + "\"]"));
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + archived + "/archive").andExpect(status().isNoContent());
        jdbc.update("UPDATE app_user SET archived_at = now() WHERE id = ?", otherLawyerId);
        String next = "{\"statusCode\": \"cuarto-intermedio\", \"nextHearing\": "
                + "{\"typeCode\": \"formulacion-de-cargos\", \"startsAt\": \"2035-03-13T13:00:00Z\"}}";

        String nextId = com.jayway.jsonpath.JsonPath.read(
                postJson(lawyer, "/api/v1/hearings/" + id + "/result", next)
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString(),
                "$.nextHearingId");

        getAs(lawyer, "/api/v1/hearings/" + nextId)
                .andExpect(jsonPath("$.defendants", hasSize(1)))
                .andExpect(jsonPath("$.defendants[0].id").value(active))
                .andExpect(jsonPath("$.lawyers", hasSize(1)))
                .andExpect(jsonPath("$.lawyers[0].id").value(lawyerId.toString()));
    }

    @Test
    void theFollowUpShouldGoToTheResponsibleWhenNoAttendingLawyerIsActive() throws Exception {
        String id = createHearing(lawyer, caseId, hearingJson(DAY, TIME, ", \"lawyerIds\": [\"" + otherLawyerId + "\"]"));
        jdbc.update("UPDATE app_user SET archived_at = now() WHERE id = ?", otherLawyerId);

        String nextId = com.jayway.jsonpath.JsonPath.read(
                postJson(lawyer, "/api/v1/hearings/" + id + "/result",
                                "{\"statusCode\": \"cuarto-intermedio\", \"nextHearing\": "
                                        + "{\"typeCode\": \"formulacion-de-cargos\", \"startsAt\": \"2035-03-13T13:00:00Z\"}}")
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString(),
                "$.nextHearingId");

        getAs(lawyer, "/api/v1/hearings/" + nextId)
                .andExpect(jsonPath("$.lawyers", hasSize(1)))
                .andExpect(jsonPath("$.lawyers[0].id").value(lawyerId.toString()));
    }

    @Test
    void shouldListTheHearingsOfACaseNewestFirst() throws Exception {
        createHearing(lawyer, caseId, hearingJson("2035-03-10", TIME, ""));
        createHearing(lawyer, caseId, hearingJson("2035-03-12", TIME, ""));
        createHearing(lawyer, caseId, hearingJson("2035-03-11", TIME, ""));

        getAs(paralegal, "/api/v1/cases/" + caseId + "/hearings")
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].startsAt").value("2035-03-12T13:00:00Z"))
                .andExpect(jsonPath("$[1].startsAt").value("2035-03-11T13:00:00Z"))
                .andExpect(jsonPath("$[2].startsAt").value("2035-03-10T13:00:00Z"));
    }
}
