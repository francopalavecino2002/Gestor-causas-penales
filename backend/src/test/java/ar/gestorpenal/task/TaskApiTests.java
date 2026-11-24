package ar.gestorpenal.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.tenancy.TenantContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class TaskApiTests extends TaskApiTestSupport {

    @Autowired
    private AuditTrail auditTrail;

    @Test
    void shouldCreateAPendingTaskWithItsResponsibleAndNoLinks() throws Exception {
        postJson(lawyer, TASKS, taskJson("  Pedir copias del legajo  ", paralegalId, due(TODAY.plusDays(2))))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.title").value("Pedir copias del legajo"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.overdue").value(false))
                .andExpect(jsonPath("$.dueDate").value(TODAY.plusDays(2).toString()))
                .andExpect(jsonPath("$.responsible.id").value(paralegalId.toString()))
                .andExpect(jsonPath("$.responsible.displayName").value("Procurador Ficticio"))
                .andExpect(jsonPath("$.createdBy").value(lawyerId.toString()))
                .andExpect(jsonPath("$.caseRef").doesNotExist())
                .andExpect(jsonPath("$.hearing").doesNotExist())
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void shouldLinkATaskToACaseAndShowItsCaption() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio de tareas", "");

        postJson(lawyer, TASKS, taskJson("Armar la carpeta", lawyerId, ", \"caseId\": \"" + caseId + "\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.caseRef.id").value(caseId))
                .andExpect(jsonPath("$.caseRef.caption").value("Caso ficticio de tareas"))
                .andExpect(jsonPath("$.hearing").doesNotExist());
    }

    @Test
    void shouldDeriveTheCaseFromTheHearing() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio con audiencia", "");
        String hearingId = createHearing(lawyer, caseId);

        postJson(lawyer, TASKS, taskJson("Preparar la audiencia", lawyerId, ", \"hearingId\": \"" + hearingId + "\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.caseRef.id").value(caseId))
                .andExpect(jsonPath("$.hearing.id").value(hearingId))
                .andExpect(jsonPath("$.hearing.typeCode").value("formulacion-de-cargos"))
                .andExpect(jsonPath("$.hearing.typeName").isNotEmpty())
                .andExpect(jsonPath("$.hearing.startsAt").isNotEmpty());
    }

    @Test
    void shouldAcceptABothGivenCaseAndHearingThatMatch() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio coincidente", "");
        String hearingId = createHearing(lawyer, caseId);

        postJson(lawyer, TASKS, taskJson("Tarea coincidente", lawyerId,
                        ", \"caseId\": \"" + caseId + "\", \"hearingId\": \"" + hearingId + "\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.caseRef.id").value(caseId));
    }

    @Test
    void shouldRejectAHearingThatIsNotInTheGivenCase() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio uno", "");
        String otherCase = createCase(lawyer, "Caso ficticio dos", "");
        String hearingId = createHearing(lawyer, otherCase);

        postJson(lawyer, TASKS, taskJson("Tarea cruzada", lawyerId,
                        ", \"caseId\": \"" + caseId + "\", \"hearingId\": \"" + hearingId + "\""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void shouldRejectInvalidTaskData() throws Exception {
        postJson(lawyer, TASKS, taskJson("   ", lawyerId, "")).andExpect(status().isBadRequest());
        postJson(lawyer, TASKS, taskJson("x".repeat(201), lawyerId, "")).andExpect(status().isBadRequest());
        postJson(lawyer, TASKS, "{\"title\": \"Sin responsable\"}").andExpect(status().isBadRequest());
        postJson(lawyer, TASKS, taskJson("Fecha absurda", lawyerId, ", \"dueDate\": \"1800-01-01\""))
                .andExpect(status().isBadRequest());
        postJson(lawyer, TASKS, taskJson("Notas largas", lawyerId, ", \"notes\": \"" + "n".repeat(2001) + "\""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectAResponsibleThatIsNotAnActiveMemberOfTheFirm() throws Exception {
        postJson(lawyer, TASKS, taskJson("Responsable ajeno", otherFirmOwnerId, "")).andExpect(status().isBadRequest());
        postJson(lawyer, TASKS, taskJson("Responsable inexistente", UUID.randomUUID(), ""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldAnswerNotFoundForTheCaseOrHearingOfAnotherFirm() throws Exception {
        String otherFirmCase = createCase(otherFirmOwner, "Caso ficticio ajeno", "");
        String otherFirmHearing = createHearing(otherFirmOwner, otherFirmCase);

        postJson(lawyer, TASKS, taskJson("Caso ajeno", lawyerId, ", \"caseId\": \"" + otherFirmCase + "\""))
                .andExpect(status().isNotFound());
        postJson(lawyer, TASKS, taskJson("Audiencia ajena", lawyerId, ", \"hearingId\": \"" + otherFirmHearing + "\""))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldNotShowATaskOfAnotherFirm() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea de la firma A", lawyerId, ""));

        getAs(otherFirmOwner, TASKS + "/" + id).andExpect(status().isNotFound());
        putJson(otherFirmOwner, TASKS + "/" + id, taskJson("Cambio ajeno", otherFirmOwnerId, ""))
                .andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, TASKS + "/" + id + "/done").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, TASKS + "/" + id + "/archive").andExpect(status().isNotFound());
        getAs(otherFirmOwner, TASKS).andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void shouldEditATaskIncludingItsResponsibleAndLinks() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio a vincular", "");
        String id = createTask(lawyer, taskJson("Titulo inicial", lawyerId, ""));

        putJson(lawyer, TASKS + "/" + id, taskJson("Titulo nuevo", paralegalId,
                        due(TODAY.plusDays(5)) + ", \"notes\": \"Con nota\", \"caseId\": \"" + caseId + "\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Titulo nuevo"))
                .andExpect(jsonPath("$.notes").value("Con nota"))
                .andExpect(jsonPath("$.responsible.id").value(paralegalId.toString()))
                .andExpect(jsonPath("$.caseRef.id").value(caseId))
                .andExpect(jsonPath("$.dueDate").value(TODAY.plusDays(5).toString()));

        putJson(lawyer, TASKS + "/" + id, taskJson("Sin vinculo", paralegalId, ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseRef").doesNotExist())
                .andExpect(jsonPath("$.dueDate").doesNotExist());
    }

    @Test
    void shouldMarkATaskDoneAndReopenIt() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea a cerrar", paralegalId, due(TODAY.minusDays(1))));
        getAs(lawyer, TASKS + "/" + id).andExpect(jsonPath("$.overdue").value(true));

        postEmpty(paralegal, TASKS + "/" + id + "/done")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.doneAt").isNotEmpty())
                .andExpect(jsonPath("$.overdue").value(false));

        postEmpty(paralegal, TASKS + "/" + id + "/reopen")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.doneAt").doesNotExist())
                .andExpect(jsonPath("$.overdue").value(true));
    }

    @Test
    void shouldLetAnyMemberMarkAnyTaskDone() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea de otro", lawyerId, ""));

        postEmpty(otherParalegal, TASKS + "/" + id + "/done")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    @Test
    void shouldLetEveryRoleCreateATask() throws Exception {
        for (var user : List.of(owner, lawyer, paralegal)) {
            postJson(user, TASKS, taskJson("Tarea de cualquier rol", lawyerId, "")).andExpect(status().isCreated());
        }
    }

    @Test
    void shouldLetOnlyTheCreatorTheResponsibleTheOwnerAndLawyersEditOrArchive() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea protegida", paralegalId, ""));
        String url = TASKS + "/" + id;
        String body = taskJson("Cambio", paralegalId, "");

        putJson(otherParalegal, url, body).andExpect(status().isForbidden());
        postEmpty(otherParalegal, url + "/archive").andExpect(status().isForbidden());
        postEmpty(otherParalegal, url + "/restore").andExpect(status().isForbidden());

        putJson(paralegal, url, taskJson("Cambio del responsable", paralegalId, "")).andExpect(status().isOk());
        putJson(otherLawyer, url, taskJson("Cambio de otro abogado", paralegalId, "")).andExpect(status().isOk());
        putJson(owner, url, taskJson("Cambio del titular", paralegalId, "")).andExpect(status().isOk());
    }

    @Test
    void shouldLetAParalegalEditAndArchiveATaskTheyCreated() throws Exception {
        String id = createTask(paralegal, taskJson("Mi tarea", lawyerId, ""));

        putJson(paralegal, TASKS + "/" + id, taskJson("Mi tarea editada", lawyerId, "")).andExpect(status().isOk());
        postEmpty(paralegal, TASKS + "/" + id + "/archive").andExpect(status().isNoContent());
    }

    @Test
    void shouldArchiveAndRestoreATaskKeepingItReadable() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea a archivar", lawyerId, ""));
        String url = TASKS + "/" + id;

        postEmpty(lawyer, url + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, url).andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(true));
        getAs(lawyer, TASKS).andExpect(jsonPath("$.total").value(0));
        getAs(lawyer, TASKS + "?includeArchived=true").andExpect(jsonPath("$.total").value(1));

        postEmpty(lawyer, url + "/restore").andExpect(status().isNoContent());
        getAs(lawyer, url).andExpect(jsonPath("$.archived").value(false));
        getAs(lawyer, TASKS).andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void shouldKeepAnArchivedTaskReadOnlyUntilItIsRestored() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea archivada", lawyerId, ""));
        String url = TASKS + "/" + id;
        postEmpty(lawyer, url + "/archive").andExpect(status().isNoContent());

        putJson(lawyer, url, taskJson("Cambio", lawyerId, "")).andExpect(status().isConflict());
        postEmpty(lawyer, url + "/done").andExpect(status().isConflict());
        postEmpty(lawyer, url + "/reopen").andExpect(status().isConflict());
    }

    @Test
    void shouldRejectLinkingATaskToAnArchivedCase() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio archivado", "");
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());

        postJson(lawyer, TASKS, taskJson("Tarea de caso archivado", lawyerId, ", \"caseId\": \"" + caseId + "\""))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldLetATaskKeepItsLinkAfterItsCaseIsArchived() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio que se archiva", "");
        String id = createTask(lawyer, taskJson("Tarea vinculada", lawyerId, ", \"caseId\": \"" + caseId + "\""));
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());

        postEmpty(lawyer, TASKS + "/" + id + "/done").andExpect(status().isOk());
        putJson(lawyer, TASKS + "/" + id,
                        taskJson("Tarea vinculada y editada", lawyerId, ", \"caseId\": \"" + caseId + "\""))
                .andExpect(status().isOk());
    }

    @Test
    void shouldNotOfferADeleteEndpoint() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea que no se borra", lawyerId, ""));

        mockMvc.perform(delete(TASKS + "/" + id).with(owner).with(CSRF)).andExpect(status().is4xxClientError());

        getAs(owner, TASKS + "/" + id).andExpect(status().isOk());
    }

    @Test
    void shouldRecordTheHistoryOfATask() throws Exception {
        String id = createTask(lawyer, taskJson("Tarea auditada", lawyerId, ""));
        postEmpty(lawyer, TASKS + "/" + id + "/done").andExpect(status().isOk());
        postEmpty(lawyer, TASKS + "/" + id + "/archive").andExpect(status().isNoContent());

        List<AuditEvent> history =
                TenantContext.callAs(tenantA, () -> auditTrail.historyOf(Task.class, UUID.fromString(id)));

        assertThat(history).extracting(AuditEvent::getAction)
                .containsExactly(AuditAction.CREATE, AuditAction.UPDATE, AuditAction.ARCHIVE);
        assertThat(history.get(1).getChanges()).anySatisfy(change -> {
            assertThat(change.field()).isEqualTo("status");
            assertThat(change.newValue()).isEqualTo("DONE");
        });
    }
}
