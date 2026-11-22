package ar.gestorpenal.hearing;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CoerciveMeasureApiTests extends HearingApiTestSupport {

    private static final LocalDate TODAY = LocalDate.now(HearingCalendar.ZONE);

    private String caseId;
    private String defendantId;

    @BeforeEach
    void openCaseWithADefendant() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio de medidas", ""));
        defendantId = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
    }

    private String measuresUrl() {
        return "/api/v1/defendants/" + defendantId + "/coercive-measures";
    }

    private static String measureJson(String code, String extraFields) {
        return "{\"measureCode\": \"%s\", \"startsOn\": \"%s\"%s}".formatted(code, TODAY.minusDays(10), extraFields);
    }

    @Test
    void shouldCreateAPreventivePrisonWithItsRisksPlaceAndDates() throws Exception {
        String body = """
                {"measureCode": "prision-preventiva", "conditions": "Fijada por cuatro meses",
                 "detentionPlace": "Alcaidía ficticia", "proceduralRiskCodes": ["peligro-de-fuga", "reiterancia"],
                 "startsOn": "%s", "endsOn": "%s", "nextReviewOn": "%s"}"""
                .formatted(TODAY.minusDays(10), TODAY.plusDays(100), TODAY.plusDays(20));

        postJson(paralegal, measuresUrl(), body)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.defendantId").value(defendantId))
                .andExpect(jsonPath("$.measureCode").value("prision-preventiva"))
                .andExpect(jsonPath("$.measureName").value("Prisión preventiva"))
                .andExpect(jsonPath("$.measureArticle").value("113, 116, 118 y 119"))
                .andExpect(jsonPath("$.conditions").value("Fijada por cuatro meses"))
                .andExpect(jsonPath("$.detentionPlace").value("Alcaidía ficticia"))
                .andExpect(jsonPath("$.proceduralRisks", hasSize(2)))
                .andExpect(jsonPath("$.proceduralRisks[0].code").value("peligro-de-fuga"))
                .andExpect(jsonPath("$.proceduralRisks[0].name").isNotEmpty())
                .andExpect(jsonPath("$.startsOn").value(TODAY.minusDays(10).toString()))
                .andExpect(jsonPath("$.endsOn").value(TODAY.plusDays(100).toString()))
                .andExpect(jsonPath("$.nextReviewOn").value(TODAY.plusDays(20).toString()))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.liftedOn").doesNotExist());

        getAs(otherLawyer, measuresUrl())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].measureCode").value("prision-preventiva"));
    }

    @Test
    void shouldRejectAPreventivePrisonInACaseOfPrivateAction() throws Exception {
        String privateCase = createCase(lawyer, privateActionCaseJson("Querella ficticia"));
        String privateDefendant = createDefendant(lawyer, privateCase, "Beto", "Paz Ejemplo");
        String url = "/api/v1/defendants/" + privateDefendant + "/coercive-measures";

        postJson(lawyer, url, measureJson("prision-preventiva", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-data"))
                .andExpect(jsonPath("$.detail").value(containsString("art. 115")));
        postJson(lawyer, url, measureJson("detencion-domiciliaria", "")).andExpect(status().isCreated());
    }

    @Test
    void theDetentionPlaceAndTheRisksOnlyApplyToCustodialMeasures() throws Exception {
        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ", \"detentionPlace\": \"Casa\""))
                .andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(),
                        measureJson("detencion-domiciliaria", ", \"proceduralRiskCodes\": [\"peligro-de-fuga\"]"))
                .andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(),
                        measureJson("presentacion-periodica", ", \"proceduralRiskCodes\": [\"peligro-de-fuga\"]"))
                .andExpect(status().isBadRequest());

        postJson(lawyer, measuresUrl(), measureJson("detencion-domiciliaria", ", \"detentionPlace\": \"Domicilio ficticio\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.detentionPlace").value("Domicilio ficticio"));
        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica",
                        ", \"conditions\": \"Los lunes en la comisaría\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.conditions").value("Los lunes en la comisaría"));
    }

    @Test
    void shouldRejectUnknownCodesAndDatesBeforeTheStart() throws Exception {
        postJson(lawyer, measuresUrl(), measureJson("no-existe", "")).andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(), measureJson("prision-preventiva", ", \"proceduralRiskCodes\": [\"no-existe\"]"))
                .andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ", \"endsOn\": \"" + TODAY.minusDays(11) + "\""))
                .andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(),
                        measureJson("presentacion-periodica", ", \"nextReviewOn\": \"" + TODAY.minusDays(11) + "\""))
                .andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(), "{\"measureCode\": \"presentacion-periodica\"}").andExpect(status().isBadRequest());
    }

    @Test
    void aMeasureCanBeOrderedAheadOfTime() throws Exception {
        postJson(lawyer, measuresUrl(), "{\"measureCode\": \"presentacion-periodica\", \"startsOn\": \""
                        + TODAY.plusDays(30) + "\"}")
                .andExpect(status().isCreated());
    }

    @Test
    void shouldUpdateAMeasureReplacingItsRisks() throws Exception {
        String id = idOf(postJson(lawyer, measuresUrl(),
                        measureJson("prision-preventiva", ", \"proceduralRiskCodes\": [\"peligro-de-fuga\"]"))
                .andExpect(status().isCreated()));

        putJson(otherLawyer, "/api/v1/coercive-measures/" + id,
                        measureJson("prision-preventiva",
                                ", \"proceduralRiskCodes\": [\"entorpecimiento-de-la-investigacion\"], \"conditions\": \"Nuevas\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conditions").value("Nuevas"))
                .andExpect(jsonPath("$.proceduralRisks", hasSize(1)))
                .andExpect(jsonPath("$.proceduralRisks[0].code").value("entorpecimiento-de-la-investigacion"));

        putJson(lawyer, "/api/v1/coercive-measures/" + id, measureJson("presentacion-periodica", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.proceduralRisks", hasSize(0)));
        putJson(lawyer, "/api/v1/coercive-measures/" + id, measureJson("presentacion-periodica", ", \"detentionPlace\": \"X\""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theOrderingHearingMustBelongToTheDefendantsCase() throws Exception {
        String own = createHearing(lawyer, caseId, hearingJson("2035-06-10", "13:00", ""));
        String otherCase = createCase(lawyer, caseJson("Otro caso ficticio", ""));
        String foreign = createHearing(lawyer, otherCase, hearingJson("2035-06-10", "15:00", ""));

        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ", \"orderedByHearingId\": \"" + own + "\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderedByHearingId").value(own));
        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ", \"orderedByHearingId\": \"" + foreign + "\""))
                .andExpect(status().isBadRequest());
        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica",
                        ", \"orderedByHearingId\": \"00000000-0000-0000-0000-000000000001\""))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldLiftAMeasureOnceOnADayThatIsNeitherBeforeTheStartNorInTheFuture() throws Exception {
        String id = idOf(postJson(lawyer, measuresUrl(), measureJson("detencion-domiciliaria", ""))
                .andExpect(status().isCreated()));
        String url = "/api/v1/coercive-measures/" + id + "/lift";

        postJson(lawyer, url, "{\"liftedOn\": \"" + TODAY.plusDays(1) + "\"}").andExpect(status().isBadRequest());
        postJson(lawyer, url, "{\"liftedOn\": \"" + TODAY.minusDays(11) + "\"}").andExpect(status().isBadRequest());
        postJson(lawyer, url, "{}").andExpect(status().isBadRequest());

        postJson(paralegal, url, "{\"liftedOn\": \"" + TODAY.minusDays(1) + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.liftedOn").value(TODAY.minusDays(1).toString()))
                .andExpect(jsonPath("$.active").value(false));
        postJson(lawyer, url, "{\"liftedOn\": \"" + TODAY + "\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/invalid-hearing-state"));
    }

    @Test
    void anArchivedMeasureShouldBeReadOnlyAndOnlyLawyersArchiveIt() throws Exception {
        String id = idOf(postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ""))
                .andExpect(status().isCreated()));
        String url = "/api/v1/coercive-measures/" + id;

        postEmpty(paralegal, url + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, url + "/archive").andExpect(status().isNoContent());

        putJson(lawyer, url, measureJson("presentacion-periodica", ""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));
        postJson(lawyer, url + "/lift", "{\"liftedOn\": \"" + TODAY + "\"}").andExpect(status().isConflict());
        getAs(lawyer, measuresUrl()).andExpect(jsonPath("$", hasSize(0)));
        getAs(lawyer, measuresUrl() + "?includeArchived=true")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].archived").value(true));

        postEmpty(paralegal, url + "/restore").andExpect(status().isForbidden());
        postEmpty(lawyer, url + "/restore").andExpect(status().isNoContent());
        putJson(lawyer, url, measureJson("presentacion-periodica", "")).andExpect(status().isOk());
    }

    @Test
    void aMeasureCannotBeRestoredWhileItsDefendantOrCaseIsArchived() throws Exception {
        String first = idOf(postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ""))
                .andExpect(status().isCreated()));
        postEmpty(lawyer, "/api/v1/coercive-measures/" + first + "/archive").andExpect(status().isNoContent());
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + defendantId + "/archive")
                .andExpect(status().isNoContent());

        postEmpty(lawyer, "/api/v1/coercive-measures/" + first + "/restore")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));

        String otherDefendant = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        String second = idOf(postJson(lawyer, "/api/v1/defendants/" + otherDefendant + "/coercive-measures",
                        measureJson("presentacion-periodica", ""))
                .andExpect(status().isCreated()));
        postEmpty(lawyer, "/api/v1/coercive-measures/" + second + "/archive").andExpect(status().isNoContent());
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());

        postEmpty(lawyer, "/api/v1/coercive-measures/" + second + "/restore")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));
    }

    @Test
    void anArchivedDefendantOrCaseShouldNotGetNewMeasures() throws Exception {
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + defendantId + "/archive")
                .andExpect(status().isNoContent());
        postJson(lawyer, measuresUrl(), measureJson("presentacion-periodica", ""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));

        String otherDefendant = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());
        postJson(lawyer, "/api/v1/defendants/" + otherDefendant + "/coercive-measures",
                        measureJson("presentacion-periodica", ""))
                .andExpect(status().isConflict());
    }

    @Test
    void theMeasuresOfAReservedCaseShouldNotExistForThoseOutsideItsTeam() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String reservedDefendant = createDefendant(lawyer, reservedCase, "Carla", "Soto Ejemplo");
        String url = "/api/v1/defendants/" + reservedDefendant + "/coercive-measures";
        String id = idOf(postJson(lawyer, url, measureJson("presentacion-periodica", "")).andExpect(status().isCreated()));

        getAs(otherLawyer, url).andExpect(status().isNotFound());
        postJson(otherLawyer, url, measureJson("presentacion-periodica", "")).andExpect(status().isNotFound());
        putJson(otherLawyer, "/api/v1/coercive-measures/" + id, measureJson("presentacion-periodica", ""))
                .andExpect(status().isNotFound());
        postJson(otherLawyer, "/api/v1/coercive-measures/" + id + "/lift", "{\"liftedOn\": \"" + TODAY + "\"}")
                .andExpect(status().isNotFound());
        postEmpty(otherLawyer, "/api/v1/coercive-measures/" + id + "/archive").andExpect(status().isNotFound());
        getAs(owner, url).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
    }
}
