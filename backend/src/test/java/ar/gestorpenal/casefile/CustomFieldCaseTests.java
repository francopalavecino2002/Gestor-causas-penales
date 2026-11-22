package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.tenancy.TenantContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** The values of the firm's custom fields on cases and defendants, through the real API. */
class CustomFieldCaseTests extends CaseApiTestSupport {

    private static final String CUSTOM_FIELDS = "/api/v1/custom-fields";

    @Autowired
    private AuditTrail auditTrail;

    @Test
    void aCaseShouldStoreAndReturnItsCustomFieldValues() throws Exception {
        defineCaseFields();
        String id = createCase(lawyer, caseJson("Caso con campos ficticio",
                ", \"customFields\": {\"honorarios-pactados\": true, \"monto\": 150000, \"prioridad\": \"alta\","
                        + " \"vencimiento\": \"2026-03-09\", \"notas\": \"  Cliente de confianza  \"}"));

        getCase(lawyer, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customFields['honorarios-pactados']").value(true))
                .andExpect(jsonPath("$.customFields.monto").value(150000))
                .andExpect(jsonPath("$.customFields.prioridad").value("alta"))
                .andExpect(jsonPath("$.customFields.vencimiento").value("2026-03-09"))
                .andExpect(jsonPath("$.customFields.notas").value("Cliente de confianza"));

        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso con campos ficticio",
                ", \"customFields\": {\"monto\": 99.5, \"prioridad\": \"media\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customFields.monto").value(99.5))
                .andExpect(jsonPath("$.customFields.prioridad").value("media"))
                .andExpect(jsonPath("$.customFields.notas").doesNotExist());
        getCase(lawyer, id).andExpect(jsonPath("$.customFields.monto").value(99.5));
    }

    @Test
    void aBadValueOrAnUnknownKeyShouldBeRejectedNamingTheField() throws Exception {
        defineCaseFields();

        postJson(lawyer, "/api/v1/cases", caseJson("Caso con monto malo", ", \"customFields\": {\"monto\": \"mucho\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-custom-field-value"))
                .andExpect(jsonPath("$.detail").value(containsString("'monto'")));
        postJson(lawyer, "/api/v1/cases", caseJson("Caso con campo ajeno", ", \"customFields\": {\"inexistente\": 1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("'inexistente'")));
        postJson(lawyer, "/api/v1/cases", caseJson("Caso con opción mala", ", \"customFields\": {\"prioridad\": \"urgente\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("'prioridad'")));
        mockMvc.perform(get("/api/v1/cases").param("q", "Caso con").with(lawyer))
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void omittingCustomFieldsShouldKeepTheStoredValues() throws Exception {
        defineCaseFields();
        String id = createCase(lawyer, caseJson("Caso que conserva", ", \"customFields\": {\"notas\": \"Importante\"}"));

        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso que conserva y cambia", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caption").value("Caso que conserva y cambia"))
                .andExpect(jsonPath("$.customFields.notas").value("Importante"));
        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso que conserva y cambia", ", \"customFields\": {}"))
                .andExpect(jsonPath("$.customFields").isEmpty());
    }

    @Test
    void aRequiredFieldShouldBeNeededOnNewRecordsButNotOnUnrelatedEdits() throws Exception {
        String before = createCase(lawyer, caseJson("Caso anterior al campo", ""));
        createDefinition("CASE_FILE", "Observaciones", "TEXT", true);

        postJson(lawyer, "/api/v1/cases", caseJson("Caso sin observaciones", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("'observaciones' is required")));
        postJson(lawyer, "/api/v1/cases", caseJson("Caso con observaciones", ", \"customFields\": {\"observaciones\": \"Ok\"}"))
                .andExpect(status().isCreated());

        putJson(lawyer, "/api/v1/cases/" + before, caseJson("Caso anterior al campo, editado", ""))
                .andExpect(status().isOk());
        putJson(lawyer, "/api/v1/cases/" + before, caseJson("Caso anterior al campo, editado", ", \"customFields\": {}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anArchivedDefinitionShouldHideTheValueAndRestoringItShouldBringItBack() throws Exception {
        String notes = createDefinition("CASE_FILE", "Notas", "TEXT", false);
        String id = createCase(lawyer, caseJson("Caso con campo archivable", ", \"customFields\": {\"notas\": \"Dato\"}"));

        postEmpty(owner, CUSTOM_FIELDS + "/" + notes + "/archive").andExpect(status().isNoContent());

        getCase(lawyer, id).andExpect(jsonPath("$.customFields").isEmpty());
        postJson(lawyer, "/api/v1/cases", caseJson("Caso con campo archivado", ", \"customFields\": {\"notas\": \"Otro\"}"))
                .andExpect(status().isBadRequest());
        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso con campo archivable", ", \"customFields\": {}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customFields").isEmpty());

        postEmpty(owner, CUSTOM_FIELDS + "/" + notes + "/restore").andExpect(status().isNoContent());

        getCase(lawyer, id).andExpect(jsonPath("$.customFields.notas").value("Dato"));
    }

    @Test
    void aDefendantShouldStoreAndKeepItsCustomFieldValues() throws Exception {
        createDefinition("DEFENDANT", "Unidad de detención", "TEXT", false);
        createDefinition("DEFENDANT", "Fecha de ingreso", "DATE", false);
        String caseId = createCase(lawyer, caseJson("Caso con imputado y campos", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));

        String defendant = idOf(postJson(lawyer, "/api/v1/cases/" + caseId + "/defendants",
                "{\"personId\": \"" + person + "\", \"customFields\": {\"unidad-de-detencion\": \"Unidad ficticia 7\","
                        + " \"fecha-de-ingreso\": \"2026-01-15\"}}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customFields['unidad-de-detencion']").value("Unidad ficticia 7")));

        String url = "/api/v1/cases/" + caseId + "/defendants/" + defendant;
        putJson(lawyer, url, "{\"stageCode\": \"juicio\", \"status\": \"ACTIVE\", \"defendedByFirm\": true}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stageCode").value("juicio"))
                .andExpect(jsonPath("$.customFields['unidad-de-detencion']").value("Unidad ficticia 7"));
        getCase(lawyer, caseId)
                .andExpect(jsonPath("$.defendants[0].customFields['fecha-de-ingreso']").value("2026-01-15"));
        putJson(lawyer, url, "{\"stageCode\": \"juicio\", \"status\": \"ACTIVE\", \"defendedByFirm\": true,"
                + " \"customFields\": {\"unidad-de-detencion\": null, \"fecha-de-ingreso\": \"15/01/2026\"}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-custom-field-value"));
        putJson(lawyer, url, "{\"stageCode\": \"juicio\", \"status\": \"ACTIVE\", \"defendedByFirm\": true,"
                + " \"customFields\": {\"unidad-de-detencion\": null}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customFields['unidad-de-detencion']").doesNotExist())
                .andExpect(jsonPath("$.customFields['fecha-de-ingreso']").doesNotExist());
    }

    @Test
    void aFirmCannotUseTheCustomFieldsOfAnotherFirm() throws Exception {
        createDefinition("CASE_FILE", "Notas", "TEXT", false);
        createDefinition("DEFENDANT", "Unidad de detención", "TEXT", false);
        String ownCase = createCase(otherFirmOwner, caseJson("Caso de la firma beta", ""));
        String person = createPerson(otherFirmOwner, humanJson("Beto", "Ejemplo Beta", null));

        postJson(otherFirmOwner, "/api/v1/cases", caseJson("Caso beta con campo ajeno", ", \"customFields\": {\"notas\": \"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("'notas'")));
        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/defendants",
                "{\"personId\": \"" + person + "\", \"customFields\": {\"unidad-de-detencion\": \"x\"}}")
                .andExpect(status().isBadRequest());

        // Once firm B defines its own field with the same label, it is B's field, not A's.
        postJson(otherFirmOwner, CUSTOM_FIELDS, "{\"entity\": \"CASE_FILE\", \"label\": \"Notas\", \"type\": \"TEXT\"}")
                .andExpect(status().isCreated());
        putJson(otherFirmOwner, "/api/v1/cases/" + ownCase, caseJson("Caso de la firma beta", ", \"customFields\": {\"notas\": \"propia\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customFields.notas").value("propia"));
    }

    @Test
    void aChangeOfCustomFieldsShouldAppearInTheHistoryOfTheCase() throws Exception {
        createDefinition("CASE_FILE", "Notas", "TEXT", false);
        createDefinition("CASE_FILE", "Monto", "NUMBER", false);
        String id = createCase(lawyer, caseJson("Caso auditado con campos", ", \"customFields\": {\"notas\": \"a\"}"));
        putJson(lawyer, "/api/v1/cases/" + id,
                caseJson("Caso auditado con campos", ", \"customFields\": {\"notas\": \"b\", \"monto\": 10}"))
                .andExpect(status().isOk());
        putJson(lawyer, "/api/v1/cases/" + id,
                caseJson("Caso auditado, solo carátula", ", \"customFields\": {\"monto\": 10, \"notas\": \"b\"}"))
                .andExpect(status().isOk());
        putJson(lawyer, "/api/v1/cases/" + id,
                caseJson("Caso auditado, solo carátula", ", \"customFields\": {\"monto\": 0.0000001, \"notas\": \"b\"}"))
                .andExpect(status().isOk());
        putJson(lawyer, "/api/v1/cases/" + id,
                caseJson("Caso auditado, otra carátula", ", \"customFields\": {\"monto\": 1E-7, \"notas\": \"b\"}"))
                .andExpect(status().isOk());

        List<AuditEvent> history = TenantContext.callAs(tenantA,
                () -> auditTrail.historyOf(CaseFile.class, UUID.fromString(id)));

        assertThat(history).extracting(AuditEvent::getAction).containsExactly(
                AuditAction.CREATE, AuditAction.UPDATE, AuditAction.UPDATE, AuditAction.UPDATE, AuditAction.UPDATE);
        assertThat(history.get(0).getChanges()).contains(new FieldChange("customFields", null, "{\"notas\":\"a\"}"));
        assertThat(history.get(1).getChanges())
                .contains(new FieldChange("customFields", "{\"notas\":\"a\"}", "{\"monto\":10,\"notas\":\"b\"}"));
        assertThat(history.get(2).getChanges()).extracting(FieldChange::field)
                .contains("caption")
                .doesNotContain("customFields");
        assertThat(history.get(3).getChanges()).extracting(FieldChange::field).containsExactly("customFields");
        // The same small decimal, read back from jsonb as a double, is not a change.
        assertThat(history.get(4).getChanges()).extracting(FieldChange::field)
                .contains("caption")
                .doesNotContain("customFields");
    }

    /** One field of each type for cases, defined by the owner of firm A. */
    private void defineCaseFields() throws Exception {
        createDefinition("CASE_FILE", "Honorarios pactados", "BOOLEAN", false);
        createDefinition("CASE_FILE", "Monto", "NUMBER", false);
        createDefinition("CASE_FILE", "Vencimiento", "DATE", false);
        createDefinition("CASE_FILE", "Notas", "TEXT", false);
        postJson(owner, CUSTOM_FIELDS,
                "{\"entity\": \"CASE_FILE\", \"label\": \"Prioridad\", \"type\": \"LIST\","
                        + " \"options\": [{\"label\": \"Alta\"}, {\"label\": \"Media\"}]}")
                .andExpect(status().isCreated());
    }

    /** Defines a field in firm A as its owner (firm B's owner defines its own fields inline). */
    private String createDefinition(String entity, String label, String type, boolean required) throws Exception {
        return idOf(postJson(owner, CUSTOM_FIELDS,
                "{\"entity\": \"%s\", \"label\": \"%s\", \"type\": \"%s\", \"required\": %s}"
                        .formatted(entity, label, type, required))
                .andExpect(status().isCreated()));
    }

    private ResultActions getCase(RequestPostProcessor user, String id) throws Exception {
        return mockMvc.perform(get("/api/v1/cases/" + id).with(user));
    }
}
