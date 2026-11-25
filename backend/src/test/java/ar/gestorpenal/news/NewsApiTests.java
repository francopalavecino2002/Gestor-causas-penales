package ar.gestorpenal.news;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** The wall built from the audit log: what is news, in which order, and for whom. */
class NewsApiTests extends NewsApiTestSupport {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("America/Argentina/Salta"));

    @Test
    void shouldListWhatChangedInTheFirmNewestFirst() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio de novedades", "");
        String hearingId = createHearing(lawyer, caseId, "2035-03-10T13:00:00Z");
        postJson(otherLawyer, "/api/v1/hearings/" + hearingId + "/reschedule", "{\"startsAt\": \"2035-03-17T13:00:00Z\"}")
                .andExpect(status().isOk());
        // Editing the notes is not news.
        putJson(lawyer, "/api/v1/hearings/" + hearingId,
                        "{\"typeCode\": \"formulacion-de-cargos\", \"startsAt\": \"2035-03-17T13:00:00Z\", \"notes\": \"Nota ficticia\"}")
                .andExpect(status().isOk());
        postJson(lawyer, "/api/v1/hearings/" + hearingId + "/result",
                        "{\"statusCode\": \"efectiva\", \"resultSummary\": \"Resumen ficticio que no va al muro\"}")
                .andExpect(status().isOk());
        createPost(paralegal, "Mañana cierra la mesa de entradas a las 12");

        getAs(otherLawyer, NEWS)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(5))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].kind").value("POST"))
                .andExpect(jsonPath("$.items[0].post.body").value("Mañana cierra la mesa de entradas a las 12"))
                .andExpect(jsonPath("$.items[0].post.canArchive").value(false))
                .andExpect(jsonPath("$.items[0].actor.displayName").value("Procurador Ficticio"))
                .andExpect(jsonPath("$.items[0].caseLink").doesNotExist())
                .andExpect(jsonPath("$.items[1].kind").value("HEARING_RESULT"))
                .andExpect(jsonPath("$.items[1].hearing.statusCode").value("efectiva"))
                .andExpect(jsonPath("$.items[1].hearing.statusName").isString())
                .andExpect(jsonPath("$.items[1].caseLink.caption").value("Caso ficticio de novedades"))
                .andExpect(jsonPath("$.items[2].kind").value("HEARING_RESCHEDULED"))
                .andExpect(jsonPath("$.items[2].actor.id").value(otherLawyerId.toString()))
                .andExpect(jsonPath("$.items[2].hearing.previousStartsAt").value("2035-03-10T13:00:00Z"))
                .andExpect(jsonPath("$.items[2].hearing.newStartsAt").value("2035-03-17T13:00:00Z"))
                .andExpect(jsonPath("$.items[3].kind").value("HEARING_SCHEDULED"))
                .andExpect(jsonPath("$.items[3].hearing.id").value(hearingId))
                .andExpect(jsonPath("$.items[3].hearing.typeName").isString())
                .andExpect(jsonPath("$.items[3].hearing.startsAt").value("2035-03-17T13:00:00Z"))
                .andExpect(jsonPath("$.items[4].kind").value("CASE_OPENED"))
                .andExpect(jsonPath("$.items[4].caseLink.id").value(caseId))
                .andExpect(jsonPath("$.items[4].caseLink.practiceArea").value("penal"))
                .andExpect(content().string(not(containsString("Resumen ficticio"))));
    }

    @Test
    void shouldReportARecessAsAResultAndItsNextHearingAsScheduled() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio con cuarto intermedio", "");
        String hearingId = createHearing(lawyer, caseId, "2035-07-10T13:00:00Z");
        String result = """
                {"statusCode": "cuarto-intermedio", "resultSummary": "Resumen ficticio",
                 "nextHearing": {"typeCode": "formulacion-de-cargos", "startsAt": "2035-07-13T13:00:00Z"}}""";
        postJson(lawyer, "/api/v1/hearings/" + hearingId + "/result", result).andExpect(status().isOk());

        getAs(lawyer, NEWS)
                .andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.items[?(@.kind == 'HEARING_RESULT')].hearing.id").value(hearingId))
                .andExpect(jsonPath("$.items[?(@.kind == 'HEARING_RESULT')].hearing.statusCode").value("cuarto-intermedio"))
                .andExpect(jsonPath("$.items[?(@.kind == 'HEARING_SCHEDULED')]", hasSize(2)));
    }

    @Test
    void shouldShowReservedCaseEntriesOnlyToItsTeamAndTheOwner() throws Exception {
        String reserved = createCase(lawyer, "Caso reservado ficticio", ", \"reserved\": true");
        createHearing(lawyer, reserved, "2035-04-10T13:00:00Z");
        createCase(lawyer, "Caso comun ficticio", "");

        getAs(otherLawyer, NEWS)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].caseLink.caption").value("Caso comun ficticio"))
                .andExpect(content().string(not(containsString("reservado"))))
                .andExpect(content().string(not(containsString(reserved))));
        getAs(paralegal, NEWS).andExpect(jsonPath("$.total").value(1));
        getAs(lawyer, NEWS).andExpect(jsonPath("$.total").value(3));
        getAs(owner, NEWS).andExpect(jsonPath("$.total").value(3));
    }

    @Test
    void shouldLeaveOutArchivedCasesHearingsAndPosts() throws Exception {
        String archivedCase = createCase(lawyer, "Caso ficticio archivado", "");
        postEmpty(lawyer, "/api/v1/cases/" + archivedCase + "/archive").andExpect(status().isNoContent());
        String caseId = createCase(lawyer, "Caso ficticio activo", "");
        String hearing = createHearing(lawyer, caseId, "2035-05-10T13:00:00Z");
        postEmpty(lawyer, "/api/v1/hearings/" + hearing + "/archive").andExpect(status().isNoContent());
        String post = createPost(lawyer, "Aviso ficticio cargado por error");
        postEmpty(lawyer, POSTS + "/" + post + "/archive").andExpect(status().isNoContent());

        getAs(owner, NEWS)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].kind").value("CASE_OPENED"))
                .andExpect(jsonPath("$.items[0].caseLink.id").value(caseId));

        postEmpty(lawyer, POSTS + "/" + post + "/restore").andExpect(status().isNoContent());
        getAs(owner, NEWS).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.items[0].post.id").value(post));
    }

    @Test
    void shouldPaginateWithTheRightTotal() throws Exception {
        for (int i = 1; i <= 5; i++) {
            createPost(lawyer, "Aviso ficticio " + i);
        }
        String reserved = createCase(owner, "Caso reservado ficticio", ", \"reserved\": true");
        createHearing(owner, reserved, "2035-06-10T13:00:00Z");

        getAs(paralegal, NEWS + "?page=1&size=2")
                .andExpect(jsonPath("$.total").value(5))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].post.body").value("Aviso ficticio 3"))
                .andExpect(jsonPath("$.items[1].post.body").value("Aviso ficticio 2"));
        getAs(paralegal, NEWS + "?page=2&size=2").andExpect(jsonPath("$.items", hasSize(1)));
        getAs(paralegal, NEWS + "?size=500").andExpect(jsonPath("$.size").value(NewsService.MAX_PAGE_SIZE));
    }

    @Test
    void shouldListDeadlinesDueSoonWithTheirSourceOnTheFirstPageOnly() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio con plazo", "");
        createDeadline(caseId, TODAY.plusDays(1));
        createDeadline(caseId, TODAY.plusDays(20));
        String reserved = createCase(lawyer, "Caso reservado ficticio", ", \"reserved\": true");
        createDeadline(reserved, TODAY.plusDays(1));

        getAs(otherLawyer, NEWS)
                .andExpect(jsonPath("$.dueSoon", hasSize(1)))
                .andExpect(jsonPath("$.dueSoon[0].caseCaption").value("Caso ficticio con plazo"))
                .andExpect(jsonPath("$.dueSoon[0].dueOn").value(TODAY.plusDays(1).toString()))
                .andExpect(jsonPath("$.dueSoon[0].source").isString())
                .andExpect(jsonPath("$.dueSoon[0].disclaimer").value("Cálculo asistido: verificá con la norma."));
        getAs(lawyer, NEWS).andExpect(jsonPath("$.dueSoon", hasSize(2)));
        getAs(lawyer, NEWS + "?page=1").andExpect(jsonPath("$.dueSoon", hasSize(0)));
    }

    @Test
    void shouldKeepEachFirmsWallApart() throws Exception {
        createCase(lawyer, "Caso ficticio de la firma A", "");
        String post = createPost(lawyer, "Aviso ficticio de la firma A");

        getAs(otherFirmOwner, NEWS)
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.dueSoon", hasSize(0)));
        postEmpty(otherFirmOwner, POSTS + "/" + post + "/archive").andExpect(status().isNotFound());
        getAs(lawyer, NEWS).andExpect(jsonPath("$.total").value(2));
    }

    private void createDeadline(String caseId, LocalDate dueOn) throws Exception {
        String json = "{\"ruleCode\": \"plazo-judicial\", \"triggeredOn\": \"" + TODAY + "\", \"setDueOn\": \"" + dueOn + "\"}";
        postJson(lawyer, "/api/v1/cases/" + caseId + "/deadlines", json).andExpect(status().isCreated());
    }
}
