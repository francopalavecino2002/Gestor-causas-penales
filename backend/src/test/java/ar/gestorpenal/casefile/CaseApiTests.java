package ar.gestorpenal.casefile;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Cases, defendants, charges and parties through the real filter chain, against a real database. */
class CaseApiTests extends CaseApiTestSupport {

    @Test
    void shouldCreateAndReadACaseWithItsTeam() throws Exception {
        postJson(paralegal, "/api/v1/cases", caseJson("Fernández Ruiz, Tomás s/ robo (ficticio)",
                ", \"internalNumber\": \"INT-001\", \"mpfLegajo\": \"mpfnq 123989/2018\","
                        + " \"ofijuNumber\": \"OFIJU-1\", \"responsibleUserId\": \"" + lawyerId + "\""))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/cases/")))
                .andExpect(jsonPath("$.mpfLegajo").value("MPFNQ 123989/2018"))
                .andExpect(jsonPath("$.circumscriptionName").value("I Circunscripción (Confluencia)"))
                .andExpect(jsonPath("$.actionType").value("public"))
                .andExpect(jsonPath("$.actionArticle").value("99"))
                .andExpect(jsonPath("$.reserved").value(false))
                .andExpect(jsonPath("$.team", hasSize(1)))
                .andExpect(jsonPath("$.team[0].userId").value(lawyerId.toString()))
                .andExpect(jsonPath("$.team[0].role").value("RESPONSIBLE"))
                .andExpect(jsonPath("$.summary.defendantCount").value(0))
                .andExpect(jsonPath("$.summary.mostDelayedStage").doesNotExist());
    }

    @Test
    void theCreatorShouldBeTheResponsibleByDefault() throws Exception {
        String id = createCase(lawyer, caseJson("Caso ficticio uno", ""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.team[0].userId").value(lawyerId.toString()))
                .andExpect(jsonPath("$.team[0].displayName").value("Abogado Ficticio"));
    }

    @Test
    void shouldReplaceTheEditableFieldsOfACase() throws Exception {
        String id = createCase(lawyer, caseJson("Caso ficticio dos", ""));

        putJson(paralegal, "/api/v1/cases/" + id, caseJson("Caso ficticio renombrado", "ii-comarca",
                ", \"internalNumber\": \"INT-002\", \"pehuenNumber\": \"PEH-9\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caption").value("Caso ficticio renombrado"))
                .andExpect(jsonPath("$.circumscriptionCode").value("ii-comarca"))
                .andExpect(jsonPath("$.internalNumber").value("INT-002"))
                .andExpect(jsonPath("$.pehuenNumber").value("PEH-9"));
    }

    @Test
    void shouldListAndSearchByCaptionAndByLegajoTypedInAnyForm() throws Exception {
        createCase(lawyer, caseJson("Gómez Ficticio s/ lesiones", ", \"mpfLegajo\": \"MPFNQ 22478/2017\""));
        createCase(lawyer, caseJson("Otro caso ficticio", ", \"internalNumber\": \"INT-77\", \"ofijuNumber\": \"OF-55\""));

        mockMvc.perform(get("/api/v1/cases").with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)));
        mockMvc.perform(get("/api/v1/cases").param("q", "LESIONES").with(paralegal))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].caption").value("Gómez Ficticio s/ lesiones"));
        mockMvc.perform(get("/api/v1/cases").param("q", "mpfnq22478/2017").with(paralegal))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].caption").value("Gómez Ficticio s/ lesiones"));
        mockMvc.perform(get("/api/v1/cases").param("q", "mpfnq 22478/2017").with(paralegal))
                .andExpect(jsonPath("$.total").value(1));
        mockMvc.perform(get("/api/v1/cases").param("q", "int-77").with(paralegal))
                .andExpect(jsonPath("$.total").value(1));
        mockMvc.perform(get("/api/v1/cases").param("q", "OF-55").with(paralegal))
                .andExpect(jsonPath("$.total").value(1));
        mockMvc.perform(get("/api/v1/cases").param("size", "1").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.size").value(1));
    }

    @Test
    void shouldRejectInvalidCaseData() throws Exception {
        expectCaseInvalid(caseJson("   ", ""));
        expectCaseInvalid(caseJson("Caso", ", \"mpfLegajo\": \"ABC 12/2020\""));
        expectCaseInvalid(caseJson("Caso", "no-existe", ""));
        expectCaseInvalid(caseJson("Caso", ", \"responsibleUserId\": \"" + paralegalId + "\""));
    }

    @Test
    void aHiddenCircumscriptionShouldBeRefusedOnCreateButAcceptedUnchangedOnUpdate() throws Exception {
        String id = createCase(lawyer, caseJson("Caso en Comarca", "ii-comarca", ""));
        putJson(owner, "/api/v1/catalogs/circumscriptions/items/ii-comarca", "{\"name\": null, \"hidden\": true}")
                .andExpect(status().isOk());

        postJson(lawyer, "/api/v1/cases", caseJson("Caso nuevo en Comarca", "ii-comarca", ""))
                .andExpect(status().isBadRequest());
        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso en Comarca editado", "ii-comarca", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caption").value("Caso en Comarca editado"));
        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso en Comarca editado", "iii-pehuen", ""))
                .andExpect(status().isOk());
        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso en Comarca editado", "ii-comarca", ""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aDuplicateLegajoShouldAnswer409WithTheExistingCase() throws Exception {
        String first = createCase(lawyer, caseJson("Primero", ", \"mpfLegajo\": \"MPFNQ 100/2020\""));

        postJson(lawyer, "/api/v1/cases", caseJson("Segundo", ", \"mpfLegajo\": \"mpfnq100/2020\""))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/case-duplicate-legajo"))
                .andExpect(jsonPath("$.existingCaseId").value(first));
    }

    @Test
    void shouldAddUpdateAndArchiveADefendantWithCharges() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con imputado", ""));
        String person = createPerson(lawyer, humanJson("Tomás", "Fernández Ruiz", null));

        String defendant = idOf(postJson(paralegal, "/api/v1/cases/" + caseId + "/defendants",
                "{\"personId\": \"" + person + "\", \"indigenousPeople\": true}")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/cases/" + caseId + "/defendants/")))
                .andExpect(jsonPath("$.stageCode").value("averiguacion-preliminar"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.defendedByFirm").value(true))
                .andExpect(jsonPath("$.defenceCounselKind").value("PRIVATE"))
                .andExpect(jsonPath("$.indigenousPeople").value(true)));
        String charge = idOf(postJson(paralegal, "/api/v1/cases/" + caseId + "/defendants/" + defendant + "/charges",
                "{\"offence\": \"Robo agravado\", \"legalReference\": \"CP art. 166 inc. 2\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.offence").value("Robo agravado")));
        putJson(paralegal, "/api/v1/cases/" + caseId + "/defendants/" + defendant + "/charges/" + charge,
                "{\"offence\": \"Robo simple\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offence").value("Robo simple"))
                .andExpect(jsonPath("$.legalReference").doesNotExist());
        postJson(paralegal, "/api/v1/cases/" + caseId + "/defendants/" + defendant + "/charges",
                "{\"offence\": \" \"}")
                .andExpect(status().isBadRequest());

        putJson(paralegal, "/api/v1/cases/" + caseId + "/defendants/" + defendant,
                "{\"stageCode\": \"investigacion-preparatoria\", \"status\": \"ACTIVE\","
                        + " \"chargesFormulatedOn\": \"2026-02-03\","
                        + " \"defenceCounselKind\": \"PUBLIC\", \"defendedByFirm\": false,"
                        + " \"defenceCounselName\": \"Defensoría ficticia\","
                        + " \"rebellionDeclaredOn\": \"2026-03-01\", \"rebellionLiftedOn\": \"2026-04-01\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stageName").value("Investigación preparatoria"))
                .andExpect(jsonPath("$.chargesFormulatedOn").value("2026-02-03"))
                .andExpect(jsonPath("$.rebellionLiftedOn").value("2026-04-01"));

        mockMvc.perform(get("/api/v1/cases/" + caseId).with(paralegal))
                .andExpect(jsonPath("$.defendants", hasSize(1)))
                .andExpect(jsonPath("$.defendants[0].displayName").value("Fernández Ruiz, Tomás"))
                .andExpect(jsonPath("$.defendants[0].charges", hasSize(1)))
                .andExpect(jsonPath("$.defendants[0].charges[0].offence").value("Robo simple"));

        postEmpty(paralegal, "/api/v1/cases/" + caseId + "/defendants/" + defendant + "/charges/" + charge + "/archive")
                .andExpect(status().isNoContent());
        postEmpty(paralegal, "/api/v1/cases/" + caseId + "/defendants/" + defendant + "/archive")
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/cases/" + caseId).with(paralegal))
                .andExpect(jsonPath("$.defendants", hasSize(0)))
                .andExpect(jsonPath("$.summary.defendantCount").value(0));
    }

    @Test
    void shouldRejectInvalidDefendantData() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con imputados inválidos", ""));
        String human = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String legal = createPerson(lawyer, "{\"kind\": \"LEGAL\", \"legalName\": \"Sociedad Ficticia SA\"}");
        String url = "/api/v1/cases/" + caseId + "/defendants";

        expectDefendantInvalid(url, human, ", \"stageCode\": \"no-existe\"");
        expectDefendantInvalid(url, human, ", \"closingOutcomeCode\": \"no-existe\", \"status\": \"CLOSED\","
                + " \"stageCode\": \"cerrada\"");
        expectDefendantInvalid(url, human, ", \"status\": \"CLOSED\", \"stageCode\": \"cerrada\"");
        expectDefendantInvalid(url, human, ", \"stageCode\": \"cerrada\"");
        expectDefendantInvalid(url, human, ", \"chargesFormulatedOn\": \"2999-01-01\"");
        expectDefendantInvalid(url, human,
                ", \"rebellionDeclaredOn\": \"2026-03-01\", \"rebellionLiftedOn\": \"2026-02-01\"");
        expectDefendantInvalid(url, legal, ", \"indigenousPeople\": true");
    }

    @Test
    void updatingADefendantShouldNeedItsStageStatusAndDefenceSoNothingIsResetByOmission() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con imputado cerrado", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String defendant = addDefendant(lawyer, caseId,
                "{\"personId\": \"" + person + "\", \"status\": \"CLOSED\", \"stageCode\": \"cerrada\","
                        + " \"closingOutcomeCode\": \"sobreseimiento\"}");

        putJson(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + defendant, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-case-data"));
        mockMvc.perform(get("/api/v1/cases/" + caseId).with(lawyer))
                .andExpect(jsonPath("$.defendants[0].status").value("CLOSED"))
                .andExpect(jsonPath("$.defendants[0].closingOutcomeCode").value("sobreseimiento"));
    }

    @Test
    void anArchivedCaseOrDefendantShouldBeReadOnlyUntilRestored() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso archivado de solo lectura", ""));
        String ana = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String beto = createPerson(lawyer, humanJson("Beto", "Salazar Ejemplo", null));
        String defendant = addDefendant(lawyer, caseId, "{\"personId\": \"" + ana + "\"}");
        String defendantUrl = "/api/v1/cases/" + caseId + "/defendants/" + defendant;
        String fullDefendant = "{\"stageCode\": \"juicio\", \"status\": \"ACTIVE\", \"defendedByFirm\": true}";

        postEmpty(lawyer, defendantUrl + "/archive").andExpect(status().isNoContent());
        putJson(lawyer, defendantUrl, fullDefendant)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));
        postJson(lawyer, defendantUrl + "/charges", "{\"offence\": \"Robo simple\"}")
                .andExpect(status().isConflict());

        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());
        putJson(lawyer, "/api/v1/cases/" + caseId, caseJson("Caso archivado editado", ""))
                .andExpect(status().isConflict());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/defendants", "{\"personId\": \"" + beto + "\"}")
                .andExpect(status().isConflict());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/parties", "{\"personId\": \"" + beto + "\", \"roleCode\": \"testigo\"}")
                .andExpect(status().isConflict());

        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/restore").andExpect(status().isNoContent());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/defendants", "{\"personId\": \"" + beto + "\"}")
                .andExpect(status().isCreated());
    }

    @Test
    void anArchivedPersonShouldNotJoinACase() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con persona archivada", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        postEmpty(lawyer, "/api/v1/persons/" + person + "/archive").andExpect(status().isNoContent());

        postJson(lawyer, "/api/v1/cases/" + caseId + "/defendants", "{\"personId\": \"" + person + "\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/parties", "{\"personId\": \"" + person + "\", \"roleCode\": \"testigo\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldCloseADefendantWithAnOutcome() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso que se cierra", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));

        postJson(lawyer, "/api/v1/cases/" + caseId + "/defendants",
                "{\"personId\": \"" + person + "\", \"status\": \"CLOSED\", \"stageCode\": \"cerrada\","
                        + " \"closingOutcomeCode\": \"sobreseimiento\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.closingOutcomeCode").value("sobreseimiento"))
                .andExpect(jsonPath("$.status").value("CLOSED"));
        mockMvc.perform(get("/api/v1/cases/" + caseId).with(lawyer))
                .andExpect(jsonPath("$.summary.defendantCount").value(1))
                .andExpect(jsonPath("$.summary.openDefendantCount").value(0))
                .andExpect(jsonPath("$.summary.mostDelayedStage").value("cerrada"));
    }

    @Test
    void aDuplicateDefendantOrPartyShouldAnswer409() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con duplicados", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String defendantBody = "{\"personId\": \"" + person + "\"}";
        String partyBody = "{\"personId\": \"" + person + "\", \"roleCode\": \"testigo\"}";

        addDefendant(lawyer, caseId, defendantBody);
        postJson(lawyer, "/api/v1/cases/" + caseId + "/defendants", defendantBody)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/duplicate-record"));

        postJson(lawyer, "/api/v1/cases/" + caseId + "/parties", partyBody).andExpect(status().isCreated());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/parties", partyBody)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/duplicate-record"));
    }

    @Test
    void shouldAddAndArchivePartiesButNeverAnImputado() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con partes", ""));
        String person = createPerson(lawyer, humanJson("Laura", "Víctima Ejemplo", null));

        String party = idOf(postJson(paralegal, "/api/v1/cases/" + caseId + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"victima\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roleCode").value("victima"))
                .andExpect(jsonPath("$.roleName").value("Víctima"))
                .andExpect(jsonPath("$.displayName").value("Víctima Ejemplo, Laura")));
        postJson(paralegal, "/api/v1/cases/" + caseId + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"imputado\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-case-data"));
        postJson(paralegal, "/api/v1/cases/" + caseId + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"no-existe\"}")
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/cases/" + caseId).with(paralegal))
                .andExpect(jsonPath("$.parties", hasSize(1)));
        postEmpty(paralegal, "/api/v1/cases/" + caseId + "/parties/" + party + "/archive")
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/cases/" + caseId).with(paralegal))
                .andExpect(jsonPath("$.parties", hasSize(0)));
    }

    @Test
    void aChildOfAnotherCaseShouldBeNotFound() throws Exception {
        String caseA = createCase(lawyer, caseJson("Caso A", ""));
        String caseB = createCase(lawyer, caseJson("Caso B", ""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String defendant = addDefendant(lawyer, caseA, "{\"personId\": \"" + person + "\"}");
        String party = idOf(postJson(lawyer, "/api/v1/cases/" + caseA + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"testigo\"}").andExpect(status().isCreated()));

        putJson(lawyer, "/api/v1/cases/" + caseB + "/defendants/" + defendant, "{}")
                .andExpect(status().isNotFound());
        postEmpty(lawyer, "/api/v1/cases/" + caseB + "/defendants/" + defendant + "/archive")
                .andExpect(status().isNotFound());
        postJson(lawyer, "/api/v1/cases/" + caseB + "/defendants/" + defendant + "/charges", "{\"offence\": \"X\"}")
                .andExpect(status().isNotFound());
        postEmpty(lawyer, "/api/v1/cases/" + caseB + "/parties/" + party + "/archive")
                .andExpect(status().isNotFound());
    }

    @Test
    void theSummaryShouldShowTheMostDelayedStageInDetailAndList() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso con dos imputados", ""));
        String ana = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String beto = createPerson(lawyer, humanJson("Beto", "Salazar Ejemplo", null));
        addDefendant(lawyer, caseId, "{\"personId\": \"" + ana + "\", \"stageCode\": \"juicio\"}");
        addDefendant(lawyer, caseId, "{\"personId\": \"" + beto + "\", \"stageCode\": \"investigacion-preparatoria\"}");

        mockMvc.perform(get("/api/v1/cases/" + caseId).with(lawyer))
                .andExpect(jsonPath("$.summary.defendantCount").value(2))
                .andExpect(jsonPath("$.summary.openDefendantCount").value(2))
                .andExpect(jsonPath("$.summary.mostDelayedStage").value("investigacion-preparatoria"));
        mockMvc.perform(get("/api/v1/cases").with(lawyer))
                .andExpect(jsonPath("$.items[0].summary.defendantCount").value(2))
                .andExpect(jsonPath("$.items[0].summary.mostDelayedStage").value("investigacion-preparatoria"));
    }

    @Test
    void onlyOwnersAndLawyersShouldArchiveAndRestoreACase() throws Exception {
        String id = createCase(lawyer, caseJson("Caso a archivar", ""));

        postEmpty(paralegal, "/api/v1/cases/" + id + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/cases/" + id + "/archive").andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/cases").with(lawyer)).andExpect(jsonPath("$.total").value(0));
        mockMvc.perform(get("/api/v1/cases").param("includeArchived", "true").with(lawyer))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].archived").value(true));
        postEmpty(paralegal, "/api/v1/cases/" + id + "/restore").andExpect(status().isForbidden());
        postEmpty(owner, "/api/v1/cases/" + id + "/restore").andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/cases/" + id).with(paralegal)).andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void shouldRejectAnonymousRequestsAndRequestsWithoutCsrfToken() throws Exception {
        mockMvc.perform(get("/api/v1/cases"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mockMvc.perform(get("/api/v1/cases/" + UUID.randomUUID())).andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/cases").with(lawyer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(caseJson("Sin token", "")))
                .andExpect(status().isForbidden());
    }

    @Test
    void nothingShouldBeDeletable() throws Exception {
        String id = createCase(lawyer, caseJson("Caso indeleble", ""));

        mockMvc.perform(delete("/api/v1/cases/" + id).with(owner).with(CSRF)).andExpect(status().is4xxClientError());
        mockMvc.perform(get("/api/v1/cases/" + id).with(owner)).andExpect(status().isOk());
    }

    private void expectCaseInvalid(String json) throws Exception {
        postJson(lawyer, "/api/v1/cases", json)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    private void expectDefendantInvalid(String url, String personId, String extraFields) throws Exception {
        postJson(lawyer, url, "{\"personId\": \"" + personId + "\"" + extraFields + "}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }
}
