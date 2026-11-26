package ar.gestorpenal.fee;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** The fees scale and the stateless calculator, through the real filter chain and database. */
class FeeApiTests extends FeeApiTestSupport {

    @Test
    void shouldShowTheScaleWithItsSourceAndDisclaimer() throws Exception {
        getAs(paralegal, FEES + "/scale")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.law").value("Ley 1594"))
                .andExpect(jsonPath("$.jusSource").value("https://www.jusneuquen.gov.ar/valor-jus/"))
                .andExpect(jsonPath("$.disclaimer").value("Cálculo asistido: verificá con la norma"))
                .andExpect(jsonPath("$.scale.article").value("art. 7"))
                .andExpect(jsonPath("$.scale.minPercent").value(11))
                .andExpect(jsonPath("$.scale.maxPercent").value(20))
                .andExpect(jsonPath("$.scale.losingPartyFloorFactor").value(0.7))
                .andExpect(jsonPath("$.scale.flags[0]").value("validar"))
                .andExpect(jsonPath("$.procurador.factor").value(0.4))
                .andExpect(jsonPath("$.sponsorAndAttorney.factor").value(1.4))
                .andExpect(jsonPath("$.appeal.minPercent").value(25))
                .andExpect(jsonPath("$.appeal.fullyRevokedPercent").value(35))
                .andExpect(jsonPath("$.minimums", hasSize(24)))
                .andExpect(jsonPath("$.minimums[?(@.code == 'defensa-criminal-plenario')].article")
                        .value("art. 9, I, 16"))
                .andExpect(jsonPath("$.minimums[?(@.code == 'defensa-criminal-plenario')].jus").value(40));
    }

    @Test
    void shouldFilterTheMinimumsByPracticeArea() throws Exception {
        getAs(lawyer, FEES + "/scale?practiceArea=penal")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minimums[*].code")
                        .value(hasItems("conocimiento", "ejecucion", "penal-general", "defensa-criminal-plenario")))
                .andExpect(jsonPath("$.minimums[*].code").value(not(hasItem("divorcio"))));
        getAs(lawyer, FEES + "/scale?practiceArea=familia")
                .andExpect(jsonPath("$.minimums[*].code")
                        .value(hasItems("conocimiento", "divorcio", "tenencia-visitas", "informacion-sumaria")))
                .andExpect(jsonPath("$.minimums[*].code").value(not(hasItem("defensa-criminal-plenario"))));
        getAs(lawyer, FEES + "/scale?practiceArea=laboral")
                .andExpect(jsonPath("$.minimums[*].code").value(hasItems("conocimiento", "informacion-sumaria")))
                .andExpect(jsonPath("$.minimums[*].code").value(not(hasItem("divorcio"))));
    }

    @Test
    void shouldCalculateTheRangeWithItsStepsAndTheValueOfThatDay() throws Exception {
        createJusValue(owner, "100.00", "2026-01-01");
        createJusValue(owner, "200.00", "2026-07-01");

        postJson(paralegal, CALCULATIONS, """
                {"amount": 100000, "minimumCode": "conocimiento", "date": "2026-03-01"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minPesos").value(11000.0))
                .andExpect(jsonPath("$.maxPesos").value(20000.0))
                .andExpect(jsonPath("$.minJus").value(110.0))
                .andExpect(jsonPath("$.maxJus").value(200.0))
                .andExpect(jsonPath("$.jusValue.value").value(100.0))
                .andExpect(jsonPath("$.jusValue.validFrom").value("2026-01-01"))
                .andExpect(jsonPath("$.minimum.code").value("conocimiento"))
                .andExpect(jsonPath("$.minimum.jus").value(10))
                .andExpect(jsonPath("$.minimum.article").value("art. 9"))
                .andExpect(jsonPath("$.minimum.flags[0]").value("validar"))
                .andExpect(jsonPath("$.steps[0].article").value("art. 7"))
                .andExpect(jsonPath("$.steps[0].amount").value(11000.0))
                .andExpect(jsonPath("$.steps[0].amountTo").value(20000.0))
                .andExpect(jsonPath("$.flags[0]").value("validar"))
                .andExpect(jsonPath("$.disclaimer").value("Cálculo asistido: verificá con la norma"))
                .andExpect(jsonPath("$.legalSource").value("Ley 1594"));

        postJson(owner, CALCULATIONS, """
                {"minimumCode": "conocimiento", "date": "2026-08-01"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minPesos").value(2000.0))
                .andExpect(jsonPath("$.maxPesos").value(2000.0))
                .andExpect(jsonPath("$.jusValue.value").value(200.0));
    }

    @Test
    void shouldApplyTheOptionsOfTheRequest() throws Exception {
        createJusValue(owner, "100.00", "2026-01-01");

        postJson(lawyer, CALCULATIONS, """
                {"amount": 100000, "minimumCode": "conocimiento", "date": "2026-03-01",
                 "clientLostEntirely": true, "role": "SPONSOR_AND_ATTORNEY", "instance": "APPEAL_FULLY_REVOKED"}
                """)
                .andExpect(status().isOk())
                // 7.700 and 20.000, times 1,4, then 35% of each.
                .andExpect(jsonPath("$.minPesos").value(3773.0))
                .andExpect(jsonPath("$.maxPesos").value(9800.0));
    }

    @Test
    void shouldUseTheValueOfTodayWhenTheRequestHasNoDate() throws Exception {
        createJusValue(owner, "100.00", "2020-01-01");

        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"ejecucion\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minPesos").value(700.0))
                .andExpect(jsonPath("$.minJus").value(7.0));
    }

    @Test
    void shouldIgnoreArchivedValues() throws Exception {
        createJusValue(owner, "100.00", "2026-01-01");
        String wrong = createJusValue(owner, "999.00", "2026-07-01");
        postEmpty(owner, JUS_VALUES + "/" + wrong + "/archive");

        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"date\": \"2026-08-01\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jusValue.validFrom").value("2026-01-01"))
                .andExpect(jsonPath("$.minPesos").value(1000.0));
    }

    @Test
    void shouldAskForTheJusValueWhenThereIsNoneForTheDay() throws Exception {
        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"date\": \"2026-03-01\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Cargá el valor del JUS"))
                .andExpect(jsonPath("$.detail").value("Cargá el valor del JUS"));

        createJusValue(owner, "100.00", "2026-07-01");
        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"date\": \"2026-03-01\"}")
                .andExpect(status().isConflict());
    }

    @Test
    void shouldRejectAnUnknownMinimumCodeNamingTheField() throws Exception {
        createJusValue(owner, "100.00", "2026-01-01");

        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"no-existe\", \"date\": \"2026-03-01\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("minimumCode"));
    }

    @Test
    void shouldRejectInvalidCalculationData() throws Exception {
        createJusValue(owner, "100.00", "2026-01-01");

        postJson(owner, CALCULATIONS, "{\"amount\": 1000}").andExpect(status().isBadRequest());
        postJson(owner, CALCULATIONS, "{\"minimumCode\": \" \"}").andExpect(status().isBadRequest());
        postJson(owner, CALCULATIONS, "{\"amount\": -1, \"minimumCode\": \"conocimiento\"}")
                .andExpect(status().isBadRequest());
        postJson(owner, CALCULATIONS, "{\"amount\": 10.123, \"minimumCode\": \"conocimiento\"}")
                .andExpect(status().isBadRequest());
        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"role\": \"JUDGE\"}")
                .andExpect(status().isBadRequest());
        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"instance\": \"THIRD\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldKeepTheJusValuesOfEachFirmApart() throws Exception {
        createJusValue(owner, "100.00", "2026-01-01");

        postJson(otherFirmOwner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"date\": \"2026-03-01\"}")
                .andExpect(status().isConflict());
        postJson(owner, CALCULATIONS, "{\"minimumCode\": \"conocimiento\", \"date\": \"2026-03-01\"}")
                .andExpect(status().isOk());
    }

    @Test
    void shouldRequireALoggedInUser() throws Exception {
        mockMvc.perform(get(FEES + "/scale")).andExpect(status().isUnauthorized());
        mockMvc.perform(post(CALCULATIONS).with(CSRF).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
