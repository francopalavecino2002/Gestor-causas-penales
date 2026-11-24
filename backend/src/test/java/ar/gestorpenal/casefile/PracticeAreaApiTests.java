package ar.gestorpenal.casefile;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Practice areas through the real filter chain (ADR-0032): the areas of a firm, the area of a case,
 * the catalogs of one area never serving another, and the module guard. {@code testarea} is a
 * module-less area that only exists on the test classpath.
 */
class PracticeAreaApiTests extends CaseApiTestSupport {

    @Autowired
    private JdbcTemplate jdbc;

    private static final String TEST_AREA_CASE = """
            {"caption": "%s", "circumscriptionCode": "i-confluencia", "actionType": "PROCESO_DE_PRUEBA",
             "represents": "PARTE_DE_PRUEBA", "practiceArea": "testarea"%s}
            """;

    private void enableTestArea() {
        jdbc.update("update tenant set enabled_practice_areas = '{penal,testarea}' where id = ?", tenantA);
    }

    private String createTestAreaCase(String caption) throws Exception {
        enableTestArea();
        return createCase(owner, TEST_AREA_CASE.formatted(caption, ""));
    }

    @Test
    void shouldListOnlyThePracticeAreasOfTheCallersFirm() throws Exception {
        mockMvc.perform(get("/api/v1/practice-areas").with(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("penal"))
                .andExpect(jsonPath("$[0].name").value("Penal"))
                .andExpect(jsonPath("$[0].law").value("CPP de Neuquén (Ley 2784)"))
                .andExpect(jsonPath("$[0].modules").value(hasItem("defendants")))
                .andExpect(jsonPath("$[0].modules", hasSize(5)));

        enableTestArea();

        mockMvc.perform(get("/api/v1/practice-areas").with(lawyer))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[1].code").value("testarea"))
                .andExpect(jsonPath("$[1].modules", hasSize(0)))
                .andExpect(jsonPath("$[1].flags[0]").value("validar"));
        mockMvc.perform(get("/api/v1/practice-areas").with(otherFirmOwner))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("penal"));
    }

    @Test
    void shouldRequireALoginToListPracticeAreas() throws Exception {
        mockMvc.perform(get("/api/v1/practice-areas")).andExpect(status().isUnauthorized());
    }

    @Test
    void aCaseShouldBePenalByDefaultAndShowItsModules() throws Exception {
        String id = createCase(owner, caseJson("Causa penal ficticia", ""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.practiceArea").value("penal"))
                .andExpect(jsonPath("$.modules").value(hasItem("mpf-legajo")));
        mockMvc.perform(get("/api/v1/cases").with(owner))
                .andExpect(jsonPath("$.items[0].practiceArea").value("penal"))
                .andExpect(jsonPath("$.items[0].modules", hasSize(5)));
    }

    @Test
    void aCaseOfAnotherAreaShouldShowItsAreaAndNoCriminalModules() throws Exception {
        String id = createTestAreaCase("Causa de prueba ficticia");

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.practiceArea").value("testarea"))
                .andExpect(jsonPath("$.modules", hasSize(0)))
                .andExpect(jsonPath("$.circumscriptionName").value("I Circunscripción (Confluencia)"));
    }

    @Test
    void aCaseCannotUseTheActionTypeOrTheSideOfAnotherArea() throws Exception {
        enableTestArea();
        String penalCodesInTestArea = TEST_AREA_CASE.formatted("Causa ficticia", "")
                .replace("PROCESO_DE_PRUEBA", "PUBLIC");
        String penalSideInTestArea = TEST_AREA_CASE.formatted("Causa ficticia", "")
                .replace("PARTE_DE_PRUEBA", "DEFENCE");

        postJson(owner, "/api/v1/cases", penalCodesInTestArea)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The catalog action-types has no item 'public'"));
        postJson(owner, "/api/v1/cases", penalSideInTestArea)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The catalog represented-sides has no item 'defence'"));
        postJson(owner, "/api/v1/cases", caseJson("Causa penal ficticia", "").replace("PUBLIC", "PROCESO_DE_PRUEBA"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The catalog action-types has no item 'proceso-de-prueba'"));
        postJson(owner, "/api/v1/cases", caseJson("Causa penal ficticia", "").replace("DEFENCE", "PARTE_DE_PRUEBA"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aCaseOfAnAreaWithoutDefendantsShouldHaveItsOwnStageAndStatus() throws Exception {
        String id = createTestAreaCase("Causa de prueba ficticia");

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner))
                .andExpect(jsonPath("$.actionType").value("PROCESO_DE_PRUEBA"))
                .andExpect(jsonPath("$.stageCode").value("inicio-de-prueba"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.closingOutcomeCode").doesNotExist())
                .andExpect(jsonPath("$.summary.mostDelayedStage").value("inicio-de-prueba"));
    }

    @Test
    void shouldRejectAnAreaTheFirmHasNotEnabled() throws Exception {
        postJson(owner, "/api/v1/cases", TEST_AREA_CASE.formatted("Causa ficticia", ""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/practice-area-not-enabled"));
    }

    @Test
    void shouldRejectAnAreaThatDoesNotExist() throws Exception {
        postJson(owner, "/api/v1/cases", caseJson("Causa ficticia", ", \"practiceArea\": \"inexistente\""))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("/problems/practice-area-not-found"));
    }

    @Test
    void thePracticeAreaOfACaseCannotChange() throws Exception {
        String id = createCase(owner, caseJson("Causa penal ficticia", ""));
        enableTestArea();

        putJson(owner, "/api/v1/cases/" + id, caseJson("Causa penal ficticia", ", \"practiceArea\": \"testarea\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The practice area of a case cannot change"));
        putJson(owner, "/api/v1/cases/" + id, caseJson("Causa penal ficticia", ", \"practiceArea\": \"penal\""))
                .andExpect(status().isOk());
        putJson(owner, "/api/v1/cases/" + id, caseJson("Causa penal ficticia", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.practiceArea").value("penal"));
    }

    @Test
    void aPartyCannotHaveARoleOfAnotherArea() throws Exception {
        String testCase = createTestAreaCase("Causa de prueba ficticia");
        String penalCase = createCase(owner, caseJson("Causa penal ficticia", ""));
        String person = createPerson(owner, humanJson("Persona", "Ficticia", null));
        String partyBody = "{\"personId\": \"%s\", \"roleCode\": \"%s\"}";

        postJson(owner, "/api/v1/cases/" + testCase + "/parties", partyBody.formatted(person, "victima"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases/" + testCase + "/parties", partyBody.formatted(person, "actor-de-prueba"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roleName").value("Actor"));
        postJson(owner, "/api/v1/cases/" + penalCase + "/parties", partyBody.formatted(person, "actor-de-prueba"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases/" + penalCase + "/parties", partyBody.formatted(person, "victima"))
                .andExpect(status().isCreated());
    }

    @Test
    void aHearingCannotUseATypeOfAnotherArea() throws Exception {
        String testCase = createTestAreaCase("Causa de prueba ficticia");
        String penalCase = createCase(owner, caseJson("Causa penal ficticia", ""));
        String hearing = "{\"typeCode\": \"%s\", \"startsAt\": \"2035-03-04T12:00:00Z\"}";

        postJson(owner, "/api/v1/cases/" + testCase + "/hearings", hearing.formatted("formulacion-de-cargos"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The catalog hearing-types has no item 'formulacion-de-cargos'"));
        postJson(owner, "/api/v1/cases/" + testCase + "/hearings", hearing.formatted("conciliacion-de-prueba"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.typeName").value("Conciliación de prueba"))
                .andExpect(jsonPath("$.statusName").value("Programada"));
        postJson(owner, "/api/v1/cases/" + penalCase + "/hearings", hearing.formatted("conciliacion-de-prueba"))
                .andExpect(status().isBadRequest());
        postJson(owner, "/api/v1/cases/" + penalCase + "/hearings", hearing.formatted("formulacion-de-cargos"))
                .andExpect(status().isCreated());
    }

    @Test
    void defendantsShouldAnswerModuleNotEnabledForACaseOfAnAreaWithoutThem() throws Exception {
        String testCase = createTestAreaCase("Causa de prueba ficticia");
        String person = createPerson(owner, humanJson("Persona", "Ficticia", null));

        postJson(owner, "/api/v1/cases/" + testCase + "/defendants", "{\"personId\": \"" + person + "\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/module-not-enabled"))
                .andExpect(jsonPath("$.detail").value(
                        "The module 'defendants' is not enabled for this practice area ('testarea')"));
    }

    @Test
    void coerciveMeasuresShouldAnswerModuleNotEnabledForADefendantOfAnAreaWithoutThem() throws Exception {
        String testCase = createTestAreaCase("Causa de prueba ficticia");
        String person = createPerson(owner, humanJson("Persona", "Ficticia", null));
        // The API refuses defendants in this area, so the row is written as a legacy import would.
        UUID defendantId = UUID.randomUUID();
        jdbc.update("""
                insert into defendant (id, tenant_id, case_id, person_id, stage_code, status)
                values (?, ?, ?::uuid, ?::uuid, 'inicio-de-prueba', 'ACTIVE')
                """, defendantId, tenantA, testCase, person);

        postJson(owner, "/api/v1/defendants/" + defendantId + "/coercive-measures",
                "{\"measureCode\": \"prision-preventiva\", \"startsOn\": \"2035-03-04\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/module-not-enabled"));
        mockMvc.perform(get("/api/v1/defendants/" + defendantId + "/coercive-measures").with(owner))
                .andExpect(status().isConflict());
    }

    @Test
    void aDeadlineRuleOfAnotherAreaShouldNotApplyToACase() throws Exception {
        String testCase = createTestAreaCase("Causa de prueba ficticia");

        postJson(owner, "/api/v1/cases/" + testCase + "/deadlines",
                "{\"ruleCode\": \"plazo-judicial\", \"triggeredOn\": \"2026-03-02\", \"setDueOn\": \"2026-03-20\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("There is no deadline rule 'plazo-judicial'"));
    }

    @Test
    void deadlinesShouldUseTheRulesOfTheirCasesArea() throws Exception {
        String testCase = createTestAreaCase("Causa de prueba ficticia");
        String penalCase = createCase(owner, caseJson("Causa penal ficticia", ""));
        String body = "{\"ruleCode\": \"%s\", \"triggeredOn\": \"2026-03-02\", \"setDueOn\": \"2026-03-20\"}";

        String id = idOf(postJson(owner, "/api/v1/cases/" + testCase + "/deadlines", body.formatted("regla-de-prueba"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rule.source").value("Ley ficticia de prueba")));
        postJson(owner, "/api/v1/cases/" + penalCase + "/deadlines", body.formatted("regla-de-prueba"))
                .andExpect(status().isBadRequest());
        String penalDeadline = idOf(postJson(owner, "/api/v1/cases/" + penalCase + "/deadlines", body.formatted("plazo-judicial"))
                .andExpect(status().isCreated()));

        putJson(owner, "/api/v1/deadlines/" + id, body.formatted("regla-de-prueba").replace("03-20", "03-25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueOn").value("2026-03-25"));
        mockMvc.perform(get("/api/v1/deadlines/" + id).with(owner))
                .andExpect(jsonPath("$.rule.code").value("regla-de-prueba"));
        mockMvc.perform(get("/api/v1/deadlines/" + penalDeadline).with(owner))
                .andExpect(jsonPath("$.rule.code").value("plazo-judicial"));
        mockMvc.perform(get("/api/v1/deadlines?withinDays=365").with(owner))
                .andExpect(status().isOk());
    }

    @Test
    void theMpfLegajoShouldAnswerModuleNotEnabledForACaseOfAnAreaWithoutIt() throws Exception {
        enableTestArea();

        postJson(owner, "/api/v1/cases", TEST_AREA_CASE.formatted("Causa ficticia", ", \"mpfLegajo\": \"MPFNQ 123/2026\""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/module-not-enabled"));
        postJson(owner, "/api/v1/cases", caseJson("Causa penal ficticia", ", \"mpfLegajo\": \"MPFNQ 123/2026\""))
                .andExpect(status().isCreated());
    }

    @Test
    void catalogsShouldBeServedPerAreaAndDefaultToPenal() throws Exception {
        enableTestArea();

        mockMvc.perform(get("/api/v1/catalogs/hearing-types").with(owner))
                .andExpect(jsonPath("$.items[*].code").value(hasItem("formulacion-de-cargos")))
                .andExpect(jsonPath("$.items[*].code").value(not(hasItem("conciliacion-de-prueba"))));
        mockMvc.perform(get("/api/v1/catalogs/hearing-types?area=testarea").with(owner))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[*].code").value(not(hasItem("formulacion-de-cargos"))));
        mockMvc.perform(get("/api/v1/catalogs?area=testarea").with(owner))
                .andExpect(jsonPath("$[*].catalog").value(not(hasItem("coercive-measures"))))
                .andExpect(jsonPath("$[*].catalog").value(hasItem("circumscriptions")));
        mockMvc.perform(get("/api/v1/catalogs/coercive-measures?area=testarea").with(owner))
                .andExpect(status().isNotFound());
    }

    @Test
    void catalogsOfAnAreaTheFirmHasNotEnabledOrThatDoesNotExistShouldBeRefused() throws Exception {
        mockMvc.perform(get("/api/v1/catalogs?area=testarea").with(owner))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/practice-area-not-enabled"));
        mockMvc.perform(get("/api/v1/catalogs?area=inexistente").with(owner))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("/problems/practice-area-not-found"));
    }

    @Test
    void theOwnerShouldCustomizeTheCatalogsOfEachAreaApart() throws Exception {
        enableTestArea();

        postJson(owner, "/api/v1/catalogs/hearing-types/items?area=testarea", "{\"name\": \"Audiencia propia de prueba\"}")
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/catalogs/hearing-types?area=testarea").with(owner))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[*].name").value(hasItem("Audiencia propia de prueba")));
        mockMvc.perform(get("/api/v1/catalogs/hearing-types").with(owner))
                .andExpect(jsonPath("$.items[*].name").value(not(hasItem("Audiencia propia de prueba"))));
    }

    @Test
    void anotherFirmShouldNotReachAnAreaItHasNotEnabled() throws Exception {
        enableTestArea();

        mockMvc.perform(get("/api/v1/catalogs?area=testarea").with(otherFirmOwner))
                .andExpect(status().isConflict());
    }
}
