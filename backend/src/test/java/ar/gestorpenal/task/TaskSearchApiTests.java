package ar.gestorpenal.task;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/** The lists behind "mis tareas", a case's tasks, the overdue ones and a day's tasks. */
class TaskSearchApiTests extends TaskApiTestSupport {

    @Test
    void shouldOrderOverdueFirstThenByDueDayWithUndatedTasksLast() throws Exception {
        createTask(lawyer, taskJson("Sin fecha", lawyerId, ""));
        createTask(lawyer, taskJson("En cinco dias", lawyerId, due(TODAY.plusDays(5))));
        createTask(lawyer, taskJson("Hoy", lawyerId, due(TODAY)));
        createTask(lawyer, taskJson("Vencida hace uno", lawyerId, due(TODAY.minusDays(1))));
        createTask(lawyer, taskJson("Vencida hace cinco", lawyerId, due(TODAY.minusDays(5))));
        String doneLate = createTask(lawyer, taskJson("Hecha con fecha pasada", lawyerId, due(TODAY.minusDays(3))));
        postEmpty(lawyer, TASKS + "/" + doneLate + "/done").andExpect(status().isOk());

        getAs(lawyer, TASKS)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(6))
                .andExpect(jsonPath("$.items[0].title").value("Vencida hace cinco"))
                .andExpect(jsonPath("$.items[0].overdue").value(true))
                .andExpect(jsonPath("$.items[1].title").value("Vencida hace uno"))
                .andExpect(jsonPath("$.items[2].title").value("Hecha con fecha pasada"))
                .andExpect(jsonPath("$.items[2].overdue").value(false))
                .andExpect(jsonPath("$.items[3].title").value("Hoy"))
                .andExpect(jsonPath("$.items[4].title").value("En cinco dias"))
                .andExpect(jsonPath("$.items[5].title").value("Sin fecha"));
    }

    @Test
    void shouldListOnlyTheTasksOfTheCurrentUserForScopeMine() throws Exception {
        createTask(lawyer, taskJson("Mia", lawyerId, ""));
        createTask(lawyer, taskJson("De la procuradora", paralegalId, ""));
        createTask(paralegal, taskJson("Tambien mia", lawyerId, ""));

        getAs(lawyer, TASKS + "?scope=mine")
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[?(@.responsible.id != '" + lawyerId + "')]").isEmpty());
        getAs(paralegal, TASKS + "?scope=mine")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("De la procuradora"));
        getAs(lawyer, TASKS + "?scope=all").andExpect(jsonPath("$.total").value(3));
        getAs(lawyer, TASKS).andExpect(jsonPath("$.total").value(3));
    }

    @Test
    void shouldFilterByResponsibleAndRejectAConflictingScope() throws Exception {
        createTask(lawyer, taskJson("Del titular", ownerId, ""));
        createTask(lawyer, taskJson("De la procuradora", paralegalId, ""));

        getAs(lawyer, TASKS + "?responsible=" + ownerId)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Del titular"));
        getAs(lawyer, TASKS + "?scope=mine&responsible=" + ownerId).andExpect(status().isBadRequest());
        getAs(lawyer, TASKS + "?scope=other").andExpect(status().isBadRequest());
    }

    @Test
    void shouldListTheTasksOfACaseAndOfAHearing() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio con tareas", "");
        String otherCase = createCase(lawyer, "Caso ficticio sin tareas", "");
        String hearingId = createHearing(lawyer, caseId);
        createTask(lawyer, taskJson("De la causa", lawyerId, ", \"caseId\": \"" + caseId + "\""));
        createTask(lawyer, taskJson("De la audiencia", lawyerId, ", \"hearingId\": \"" + hearingId + "\""));
        createTask(lawyer, taskJson("Suelta", lawyerId, ""));

        getAs(lawyer, TASKS + "?caseId=" + caseId).andExpect(jsonPath("$.total").value(2));
        getAs(lawyer, TASKS + "?caseId=" + otherCase).andExpect(jsonPath("$.total").value(0));
        getAs(lawyer, TASKS + "?hearingId=" + hearingId)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("De la audiencia"));
    }

    @Test
    void shouldFilterByStatus() throws Exception {
        String done = createTask(lawyer, taskJson("Hecha", lawyerId, ""));
        createTask(lawyer, taskJson("Pendiente", lawyerId, ""));
        postEmpty(lawyer, TASKS + "/" + done + "/done").andExpect(status().isOk());

        getAs(lawyer, TASKS + "?status=DONE")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Hecha"));
        getAs(lawyer, TASKS + "?status=PENDING")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Pendiente"));
        getAs(lawyer, TASKS + "?status=UNKNOWN").andExpect(status().isBadRequest());
    }

    @Test
    void shouldListOnlyThePendingTasksDueBeforeTodayForOverdue() throws Exception {
        createTask(lawyer, taskJson("Vencida", lawyerId, due(TODAY.minusDays(2))));
        createTask(lawyer, taskJson("Vence hoy", lawyerId, due(TODAY)));
        createTask(lawyer, taskJson("Sin fecha", lawyerId, ""));
        String done = createTask(lawyer, taskJson("Hecha y vencida", lawyerId, due(TODAY.minusDays(4))));
        postEmpty(lawyer, TASKS + "/" + done + "/done").andExpect(status().isOk());
        String archived = createTask(lawyer, taskJson("Archivada y vencida", lawyerId, due(TODAY.minusDays(6))));
        postEmpty(lawyer, TASKS + "/" + archived + "/archive").andExpect(status().isNoContent());

        getAs(lawyer, TASKS + "?overdue=true&includeArchived=true")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Vencida"));
    }

    @Test
    void shouldListTheTasksDueOnADay() throws Exception {
        createTask(lawyer, taskJson("Hoy", lawyerId, due(TODAY)));
        createTask(lawyer, taskJson("Manana", lawyerId, due(TODAY.plusDays(1))));

        getAs(lawyer, TASKS + "?dueOn=" + TODAY.plusDays(1))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Manana"));
    }

    @Test
    void shouldPaginateTheList() throws Exception {
        for (int i = 1; i <= 3; i++) {
            createTask(lawyer, taskJson("Tarea " + i, lawyerId, due(TODAY.plusDays(i))));
        }

        getAs(lawyer, TASKS + "?size=2&page=0")
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)));
        getAs(lawyer, TASKS + "?size=2&page=1")
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].title").value("Tarea 3"));
    }

    @Test
    void shouldHideTheTasksOfAReservedCaseFromWhoCannotSeeIt() throws Exception {
        String reservedCase = createCase(lawyer, "Caso reservado ficticio", ", \"reserved\": true");
        String hearingId = createHearing(lawyer, reservedCase);
        String onCase = createTask(lawyer, taskJson("De la reservada", lawyerId, ", \"caseId\": \"" + reservedCase + "\""));
        String onHearing = createTask(lawyer, taskJson("De su audiencia", lawyerId, ", \"hearingId\": \"" + hearingId + "\""));
        createTask(lawyer, taskJson("Comun", lawyerId, ""));

        getAs(otherLawyer, TASKS + "/" + onCase).andExpect(status().isNotFound());
        getAs(otherLawyer, TASKS + "/" + onHearing).andExpect(status().isNotFound());
        putJson(otherLawyer, TASKS + "/" + onCase, taskJson("Cambio", lawyerId, ", \"caseId\": \"" + reservedCase + "\""))
                .andExpect(status().isNotFound());
        postEmpty(otherLawyer, TASKS + "/" + onCase + "/done").andExpect(status().isNotFound());
        postEmpty(otherLawyer, TASKS + "/" + onCase + "/archive").andExpect(status().isNotFound());
        postJson(otherLawyer, TASKS, taskJson("Intruso", lawyerId, ", \"caseId\": \"" + reservedCase + "\""))
                .andExpect(status().isNotFound());
        postJson(otherLawyer, TASKS, taskJson("Intruso", lawyerId, ", \"hearingId\": \"" + hearingId + "\""))
                .andExpect(status().isNotFound());
        getAs(otherLawyer, TASKS)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Comun"));
        getAs(otherLawyer, TASKS + "?caseId=" + reservedCase).andExpect(jsonPath("$.total").value(0));

        getAs(lawyer, TASKS).andExpect(jsonPath("$.total").value(3));
        getAs(owner, TASKS).andExpect(jsonPath("$.total").value(3));
        getAs(owner, TASKS + "/" + onCase).andExpect(status().isOk());
    }

    @Test
    void shouldAnswerATaskOrHearingOfAnInvisibleReservedCaseLikeAMissingOne() throws Exception {
        String reservedCase = createCase(lawyer, "Caso reservado ficticio", ", \"reserved\": true");
        String hearingId = createHearing(lawyer, reservedCase);
        String onCase = createTask(lawyer, taskJson("De la reservada", lawyerId, ", \"caseId\": \"" + reservedCase + "\""));

        getAs(otherLawyer, TASKS + "/" + onCase)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("There is no task " + onCase))
                .andExpect(jsonPath("$.detail").value(not(containsString(reservedCase))));
        postJson(otherLawyer, TASKS, taskJson("Intruso", lawyerId, ", \"hearingId\": \"" + hearingId + "\""))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("There is no hearing " + hearingId));
    }

    @Test
    void shouldLeaveArchivedTasksOutUnlessAsked() throws Exception {
        createTask(lawyer, taskJson("Activa", lawyerId, ""));
        String archived = createTask(lawyer, taskJson("Archivada", lawyerId, ""));
        postEmpty(lawyer, TASKS + "/" + archived + "/archive").andExpect(status().isNoContent());

        getAs(lawyer, TASKS)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Activa"));
        getAs(lawyer, TASKS + "?includeArchived=true").andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void shouldRejectAMalformedFilterAsProblemJson() throws Exception {
        getAs(lawyer, TASKS + "?caseId=not-a-uuid")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        getAs(lawyer, TASKS + "?dueOn=31-12-2026").andExpect(status().isBadRequest());
    }

    @Test
    void shouldNotListTheTasksOfAnotherFirm() throws Exception {
        createTask(lawyer, taskJson("De la firma A", lawyerId, ""));
        createTask(otherFirmOwner, taskJson("De la firma B", otherFirmOwnerId, ""));

        getAs(otherFirmOwner, TASKS)
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].title").value("De la firma B"));
        getAs(otherFirmOwner, TASKS + "?responsible=" + lawyerId).andExpect(jsonPath("$.total").value(0));
    }
}
