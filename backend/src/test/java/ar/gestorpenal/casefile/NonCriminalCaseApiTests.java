package ar.gestorpenal.casefile;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Cases of the shipped civil, labour and family areas (ADR-0032, T42) through the real filter chain:
 * the case's own stage, status and outcome, parties with the area's roles, hearings without
 * defendants, manual deadlines, and the isolation from the criminal catalogs and modules.
 */
class NonCriminalCaseApiTests extends CaseApiTestSupport {

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void enableTheNonCriminalAreas() {
        jdbc.update("update tenant set enabled_practice_areas = '{penal,civil,laboral,familia}' where id = ?", tenantA);
    }

    private static String civilCase(String caption, String extraFields) {
        return """
                {"caption": "%s", "circumscriptionCode": "i-confluencia", "actionType": "ordinario",
                 "represents": "actor", "practiceArea": "civil"%s}
                """.formatted(caption, extraFields);
    }

    private String hearingBody(String typeCode, String startsAt) {
        return "{\"typeCode\": \"%s\", \"startsAt\": \"%s\", \"durationMinutes\": 60}".formatted(typeCode, startsAt);
    }

    @Test
    void aCivilCaseShouldStartInTheFirstStageAndShowItsOwnCourse() throws Exception {
        String id = createCase(owner, civilCase("Actor Ficticio c/ Demandado Ficticio s/ cobro", ""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.practiceArea").value("civil"))
                .andExpect(jsonPath("$.modules", hasSize(0)))
<<<<<<< HEAD
                .andExpect(jsonPath("$.actionType").value("ordinario"))
                .andExpect(jsonPath("$.actionArticle").doesNotExist())
                .andExpect(jsonPath("$.represents").value("actor"))
=======
                .andExpect(jsonPath("$.actionType").value("ORDINARIO"))
                .andExpect(jsonPath("$.actionArticle").doesNotExist())
                .andExpect(jsonPath("$.represents").value("ACTOR"))
>>>>>>> origin/main
                .andExpect(jsonPath("$.stageCode").value("inicio"))
                .andExpect(jsonPath("$.stageName").value("Inicio"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.closingOutcomeCode").doesNotExist())
                .andExpect(jsonPath("$.defendants", hasSize(0)))
                .andExpect(jsonPath("$.summary.mostDelayedStage").value("inicio"));
        mockMvc.perform(get("/api/v1/cases?q=cobro").with(owner))
                .andExpect(jsonPath("$.items[0].practiceArea").value("civil"))
                .andExpect(jsonPath("$.items[0].stageName").value("Inicio"))
                .andExpect(jsonPath("$.items[0].summary.mostDelayedStage").value("inicio"));
    }

    @Test
    void aCivilCaseShouldMoveThroughItsStagesAndCloseWithAnOutcome() throws Exception {
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));

        putJson(owner, "/api/v1/cases/" + id, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"prueba\", \"status\": \"SUSPENDED\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stageCode").value("prueba"))
                .andExpect(jsonPath("$.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.summary.mostDelayedStage").value("prueba"));
        putJson(owner, "/api/v1/cases/" + id, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"cerrada\", \"status\": \"CLOSED\", \"closingOutcomeCode\": \"acuerdo\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stageCode").value("cerrada"))
                .andExpect(jsonPath("$.closingOutcomeName").value("Acuerdo"))
                .andExpect(jsonPath("$.summary.mostDelayedStage").value("cerrada"));
        putJson(owner, "/api/v1/cases/" + id, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"sentencia\", \"status\": \"ACTIVE\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.closingOutcomeCode").doesNotExist());
    }

    @Test
    void theCourseOfACaseShouldFollowTheRulesOfADefendant() throws Exception {
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));
        String update = "/api/v1/cases/" + id;

        putJson(owner, update, civilCase("Causa civil ficticia", ", \"stageCode\": \"prueba\", \"status\": \"CLOSED\""))
                .andExpect(status().isBadRequest());
        putJson(owner, update, civilCase("Causa civil ficticia", ", \"stageCode\": \"cerrada\", \"status\": \"ACTIVE\""))
                .andExpect(status().isBadRequest());
        putJson(owner, update, civilCase("Causa civil ficticia", ", \"stageCode\": \"cerrada\", \"status\": \"CLOSED\""))
                .andExpect(status().isBadRequest());
        putJson(owner, update, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"prueba\", \"status\": \"ACTIVE\", \"closingOutcomeCode\": \"acuerdo\""))
                .andExpect(status().isBadRequest());
        putJson(owner, update, civilCase("Causa civil ficticia", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Updating a case of this practice area needs its stage and status"));
    }

    @Test
    void aFirmCannotHideTheStagesSoANewCaseAlwaysHasAnOfferedFirstStageAndCanClose() throws Exception {
        // Stages drive behavior, so the catalog only allows renames: hiding the first stage or "cerrada" is refused.
        putJson(owner, "/api/v1/catalogs/stages/items/inicio?area=civil", "{\"hidden\": true}")
                .andExpect(status().isConflict());
        putJson(owner, "/api/v1/catalogs/stages/items/cerrada?area=civil", "{\"hidden\": true}")
                .andExpect(status().isConflict());
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));

        putJson(owner, "/api/v1/cases/" + id, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"cerrada\", \"status\": \"CLOSED\", \"closingOutcomeCode\": \"acuerdo\""))
                .andExpect(status().isOk());
    }

    @Test
    void aCivilCaseShouldRejectTheStagesAndOutcomesOfOtherAreas() throws Exception {
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));

        putJson(owner, "/api/v1/cases/" + id, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"investigacion-preparatoria\", \"status\": \"ACTIVE\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The catalog stages has no item 'investigacion-preparatoria'"));
        putJson(owner, "/api/v1/cases/" + id, civilCase("Causa civil ficticia",
                ", \"stageCode\": \"cerrada\", \"status\": \"CLOSED\", \"closingOutcomeCode\": \"sobreseimiento\""))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases", civilCase("Otra causa", ", \"stageCode\": \"conciliacion\""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aCriminalCaseShouldKeepItsCourseOnEachDefendantAndRefuseOneOnTheCase() throws Exception {
        postJson(owner, "/api/v1/cases", caseJson("Causa penal ficticia", ", \"stageCode\": \"juicio\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(
                        "In this practice area the stage, status and closing outcome belong to each defendant"));
        String id = createCase(owner, caseJson("Causa penal ficticia", ""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(jsonPath("$.stageCode").doesNotExist())
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.closingOutcomeCode").doesNotExist());
        putJson(owner, "/api/v1/cases/" + id, caseJson("Causa penal ficticia", ", \"status\": \"ACTIVE\""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aCivilCaseShouldHavePartiesWithTheRolesOfItsArea() throws Exception {
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));
        String actor = createPerson(owner, humanJson("Actora", "Ficticia", null));
        String demandado = createPerson(owner, humanJson("Demandado", "Ficticio", null));
        String body = "{\"personId\": \"%s\", \"roleCode\": \"%s\"}";

        postJson(owner, "/api/v1/cases/" + id + "/parties", body.formatted(actor, "actor"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roleName").value("Actor"));
        postJson(owner, "/api/v1/cases/" + id + "/parties", body.formatted(demandado, "demandado"))
                .andExpect(status().isCreated());
        postJson(owner, "/api/v1/cases/" + id + "/parties", body.formatted(demandado, "imputado"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases/" + id + "/parties", body.formatted(demandado, "victima"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(jsonPath("$.parties", hasSize(2)))
                .andExpect(jsonPath("$.parties[*].roleCode").value(hasItem("demandado")));
    }

    @Test
    void aCivilCaseShouldRefuseTheCriminalModulesAndCodes() throws Exception {
        postJson(owner, "/api/v1/cases", civilCase("Causa civil ficticia", ", \"mpfLegajo\": \"MPFNQ 123/2026\""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/module-not-enabled"));
<<<<<<< HEAD
        postJson(owner, "/api/v1/cases", civilCase("Causa civil ficticia", "").replace("ordinario", "public"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases", civilCase("Causa civil ficticia", "").replace("\"actor\"", "\"defence\""))
=======
        postJson(owner, "/api/v1/cases", civilCase("Causa civil ficticia", "").replace("ordinario", "PUBLIC"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases", civilCase("Causa civil ficticia", "").replace("\"actor\"", "\"DEFENCE\""))
>>>>>>> origin/main
                .andExpect(status().isBadRequest());
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));
        String person = createPerson(owner, humanJson("Persona", "Ficticia", null));

        postJson(owner, "/api/v1/cases/" + id + "/defendants", "{\"personId\": \"" + person + "\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/module-not-enabled"));
    }

    @Test
    void everyNonCriminalAreaShouldOpenCasesWithItsOwnActionTypesAndSides() throws Exception {
        String labour = """
                {"caption": "Trabajador Ficticio c/ Empleador Ficticio", "circumscriptionCode": "i-confluencia",
                 "actionType": "sumarisimo", "represents": "actor", "practiceArea": "laboral"}
                """;
        String family = """
                {"caption": "Requirente Ficticio s/ medida", "circumscriptionCode": "i-confluencia",
<<<<<<< HEAD
                 "actionType": "cautelar", "represents": "requerido", "practiceArea": "familia"}
=======
                 "actionType": "CAUTELAR", "represents": "requerido", "practiceArea": "familia"}
>>>>>>> origin/main
                """;

        postJson(owner, "/api/v1/cases", labour).andExpect(status().isCreated())
                .andExpect(jsonPath("$.stageCode").value("inicio"));
        postJson(owner, "/api/v1/cases", family).andExpect(status().isCreated())
                .andExpect(jsonPath("$.stageCode").value("mediacion-previa"))
<<<<<<< HEAD
                .andExpect(jsonPath("$.actionType").value("cautelar"));
        postJson(owner, "/api/v1/cases", family.replace("cautelar", "ordinario"))
=======
                .andExpect(jsonPath("$.actionType").value("CAUTELAR"));
        postJson(owner, "/api/v1/cases", family.replace("cautelar", "ordinario").replace("CAUTELAR", "ORDINARIO"))
>>>>>>> origin/main
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases", labour.replace("\"actor\"", "\"requerido\""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aCivilHearingShouldNeedNoDefendantsAndShowInTheAgendaWithClashes() throws Exception {
        String civil = createCase(owner, civilCase("Causa civil ficticia", ""));
        String penal = createCase(owner, caseJson("Causa penal ficticia", ""));
        String hearing = idOf(postJson(owner, "/api/v1/cases/" + civil + "/hearings",
                hearingBody("de-prueba", "2035-06-12T13:00:00Z"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.typeName").value("Audiencia de prueba o vista de causa"))
                .andExpect(jsonPath("$.statusCode").value("programada"))
                .andExpect(jsonPath("$.defendants", hasSize(0))));
        postJson(owner, "/api/v1/cases/" + penal + "/hearings", hearingBody("formulacion-de-cargos", "2035-06-12T13:30:00Z"))
                .andExpect(status().isCreated());
        postJson(owner, "/api/v1/cases/" + civil + "/hearings", hearingBody("formulacion-de-cargos", "2035-06-13T13:00:00Z"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/agenda?from=2035-06-12&to=2035-06-12").with(owner))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].hearingId").value(hearing))
                .andExpect(jsonPath("$.items[0].caseCaption").value("Causa civil ficticia"))
<<<<<<< HEAD
                .andExpect(jsonPath("$.items[0].practiceArea").value("civil"))
                .andExpect(jsonPath("$.items[1].practiceArea").value("penal"))
=======
>>>>>>> origin/main
                .andExpect(jsonPath("$.items[0].hasClash").value(true))
                .andExpect(jsonPath("$.items[1].hasClash").value(true));
    }

    @Test
<<<<<<< HEAD
    void theCaseListShouldKeepOnlyTheCasesOfTheChosenArea() throws Exception {
        createCase(owner, civilCase("Causa civil ficticia", ""));
        createCase(owner, caseJson("Causa penal ficticia", ""));

        mockMvc.perform(get("/api/v1/cases?area=civil").with(owner))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].practiceArea").value("civil"));
        mockMvc.perform(get("/api/v1/cases?area=penal").with(owner))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].caption").value("Causa penal ficticia"));
        mockMvc.perform(get("/api/v1/cases").with(owner)).andExpect(jsonPath("$.total").value(2));
    }

    @Test
=======
>>>>>>> origin/main
    void aCivilCaseShouldTakeManualDeadlinesAndNoComputedRule() throws Exception {
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));

        postJson(owner, "/api/v1/cases/" + id + "/deadlines",
                "{\"ruleCode\": \"plazo-judicial\", \"triggeredOn\": \"2026-03-02\", \"setDueOn\": \"2026-03-20\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dueOn").value("2026-03-20"))
                .andExpect(jsonPath("$.rule.source").value("Resolución judicial"));
        postJson(owner, "/api/v1/cases/" + id + "/deadlines",
                "{\"ruleCode\": \"control-judicial-detencion\", \"triggeredOn\": \"2026-03-02\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("There is no deadline rule 'control-judicial-detencion'"));
    }

    @Test
    void aCaseOfAnAreaTheFirmDidNotEnableShouldBeRefused() throws Exception {
        postJson(otherFirmOwner, "/api/v1/cases", civilCase("Causa civil ficticia", ""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/practice-area-not-enabled"));
    }

    @Test
    void aCivilCaseShouldNotBeVisibleToAnotherFirm() throws Exception {
        String id = createCase(owner, civilCase("Causa civil ficticia", ""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(otherFirmOwner)).andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/cases/" + id + "/hearings", hearingBody("de-prueba", "2035-06-12T13:00:00Z"))
                .andExpect(status().isNotFound());
    }

    @Test
<<<<<<< HEAD
    void aCaseShouldTakeAndAnswerPlainCatalogCodes() throws Exception {
        String id = createCase(owner, caseJson("Causa penal ficticia", "")
                .replace("\"public\"", "\"public-on-complaint\"").replace("\"defence\"", "\"private-prosecution\""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(jsonPath("$.actionType").value("public-on-complaint"))
                .andExpect(jsonPath("$.actionArticle").value("100"))
                .andExpect(jsonPath("$.represents").value("private-prosecution"));
        putJson(owner, "/api/v1/cases/" + id, caseJson("Causa penal ficticia", "")
                .replace("\"public\"", "\"PUBLIC_ON_COMPLAINT\""))
                .andExpect(status().isBadRequest());
=======
    void aCriminalCaseShouldKeepTheWireFormatTheFrontendUses() throws Exception {
        String id = createCase(owner, caseJson("Causa penal ficticia", "")
                .replace("PUBLIC", "PUBLIC_ON_COMPLAINT").replace("DEFENCE", "PRIVATE_PROSECUTION"));

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(jsonPath("$.actionType").value("PUBLIC_ON_COMPLAINT"))
                .andExpect(jsonPath("$.actionArticle").value("100"))
                .andExpect(jsonPath("$.represents").value("PRIVATE_PROSECUTION"));
        putJson(owner, "/api/v1/cases/" + id, caseJson("Causa penal ficticia", "")
                .replace("PUBLIC", "public-on-complaint").replace("DEFENCE", "defence"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("PUBLIC_ON_COMPLAINT"))
                .andExpect(jsonPath("$.represents").value("DEFENCE"));
>>>>>>> origin/main
    }
}
