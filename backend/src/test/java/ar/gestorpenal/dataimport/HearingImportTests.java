package ar.gestorpenal.dataimport;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class HearingImportTests extends ImportApiTestSupport {

    private static final String HEADER = "legajo_mpf;numero_interno;tipo_audiencia;fecha;hora;duracion_minutos;sala;"
            + "juez;referencia_ofiju;estado;abogados;imputados";

    @Autowired
    private JdbcTemplate jdbc;

    private String caseWithLegajo(String legajo) throws Exception {
        return createCase(lawyer, caseJson("Caso de audiencias ficticio", ", \"mpfLegajo\": \"" + legajo + "\""));
    }

    private String hearingsOf(String caseId) throws Exception {
        return "/api/v1/cases/" + caseId + "/hearings";
    }

    @Test
    void shouldReportTheHearingsInAPreviewAndCreateNothing() throws Exception {
        String caseId = caseWithLegajo("MPFNQ 3001/2035");

        preview(lawyer, "hearings", csv(HEADER,
                        "MPFNQ 3001/2035;;Formulación de cargos;15/03/2035;09:30;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.created.hearings").value(1))
                .andExpect(jsonPath("$.rows[0].label").value("MPFNQ 3001/2035 15/03/2035 09:30"));

        getAs(lawyer, hearingsOf(caseId)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldCreateTheHearingInTheFirmsTimeZoneWithItsLawyersAndDefendants() throws Exception {
        String caseId = caseWithLegajo("MPFNQ 3002/2035");
        addDefendant(lawyer, caseId, createPerson(lawyer, humanJson("Ana", "Audiencia", "10000301")));

        commit(lawyer, "hearings", csv(HEADER,
                        "mpfnq 3002/2035;;Formulación de cargos;15/03/2035;09:30;45;Sala 3;Juez Ficticio;OFIJU-FICT-1;"
                                + "Programada;abogada@ejemplo.test;10.000.301"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.committed").value(true))
                .andExpect(jsonPath("$.created.hearings").value(1));

        getAs(lawyer, hearingsOf(caseId))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].typeCode").value("formulacion-de-cargos"))
                .andExpect(jsonPath("$[0].startsAt").value("2035-03-15T12:30:00Z"))
                .andExpect(jsonPath("$[0].durationMinutes").value(45))
                .andExpect(jsonPath("$[0].room").value("Sala 3"))
                .andExpect(jsonPath("$[0].judge").value("Juez Ficticio"))
                .andExpect(jsonPath("$[0].ofijuReference").value("OFIJU-FICT-1"))
                .andExpect(jsonPath("$[0].statusCode").value("programada"))
                .andExpect(jsonPath("$[0].lawyers[0].id").value(otherLawyerId.toString()))
                .andExpect(jsonPath("$[0].defendants[0].name").value("Audiencia, Ana"));
    }

    @Test
    void shouldGiveTheHearingToTheCasesResponsibleWhenNoLawyerIsNamed() throws Exception {
        String caseId = caseWithLegajo("MPFNQ 3003/2035");

        commit(lawyer, "hearings", csv(HEADER, "MPFNQ 3003/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk());

        getAs(lawyer, hearingsOf(caseId))
                .andExpect(jsonPath("$[0].durationMinutes").value(60))
                .andExpect(jsonPath("$[0].lawyers[0].id").value(lawyerId.toString()))
                .andExpect(jsonPath("$[0].defendants", hasSize(0)));
    }

    @Test
    void shouldFindTheCaseByInternalNumber() throws Exception {
        String caseId = createCase(lawyer, caseJson("Caso interno ficticio", ", \"internalNumber\": \"INT-H1\""));

        commit(lawyer, "hearings", csv(HEADER, ";INT-H1;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk());

        getAs(lawyer, hearingsOf(caseId)).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void shouldSaveNothingWhenOneRowFailsOnCommit() throws Exception {
        String caseId = caseWithLegajo("MPFNQ 3004/2035");

        commit(lawyer, "hearings", csv(HEADER,
                        "MPFNQ 3004/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;",
                        "MPFNQ 3004/2035;;formulacion-de-cargos;17/03/2035;hora;;;;;;;"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.type").value("/problems/import-has-errors"))
                .andExpect(jsonPath("$.report.rows[1].errors[0].column").value("hora"));

        getAs(lawyer, hearingsOf(caseId)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldAnswerThatACaseOfAnotherFirmDoesNotExist() throws Exception {
        String foreignCase = createCase(otherFirmOwner,
                caseJson("Caso ajeno ficticio", ", \"mpfLegajo\": \"MPFNQ 3005/2035\""));

        commit(lawyer, "hearings", csv(HEADER, "MPFNQ 3005/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.report.rows[0].errors[0].column").value("legajo_mpf"))
                .andExpect(jsonPath("$.report.rows[0].errors[0].message").value("No existe un caso con ese número."));

        getAs(otherFirmOwner, hearingsOf(foreignCase)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldAnswerThatAReservedCaseTheUserCannotSeeDoesNotExist() throws Exception {
        createCase(lawyer, caseJson("Caso reservado ficticio", ", \"mpfLegajo\": \"MPFNQ 3006/2035\", \"reserved\": true"));

        preview(otherLawyer, "hearings", csv(HEADER, "MPFNQ 3006/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(1))
                .andExpect(jsonPath("$.rows[0].errors[0].message").value("No existe un caso con ese número."));
    }

    @Test
    void shouldRejectAnArchivedCase() throws Exception {
        String caseId = caseWithLegajo("MPFNQ 3007/2035");
        mockMvc.perform(post("/api/v1/cases/" + caseId + "/archive").with(lawyer).with(CSRF))
                .andExpect(status().isNoContent());

        preview(lawyer, "hearings", csv(HEADER, "MPFNQ 3007/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(1))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("legajo_mpf"));
    }

    @Test
    void shouldRejectADocumentThatIsNotADefendantOfTheCaseWithoutEchoingIt() throws Exception {
        caseWithLegajo("MPFNQ 3008/2035");
        createPerson(lawyer, humanJson("Luis", "Sin Caso", "10000308"));

        preview(lawyer, "hearings", csv(HEADER,
                        "MPFNQ 3008/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;10000308",
                        "MPFNQ 3008/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;;;10000999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(2))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("imputados"))
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("imputados"))
                .andExpect(jsonPath("$.rows[0].errors[0].message").value(not(containsString("10000308"))));
    }

    @Test
    void shouldReportEveryInvalidColumnOfARow() throws Exception {
        caseWithLegajo("MPFNQ 3009/2035");

        preview(lawyer, "hearings", csv(HEADER, "MPFNQ 3009/2035;;audiencia inventada;ayer;tarde;x;;;;;nadie@ejemplo.test;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'tipo_audiencia')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'fecha')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'hora')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'duracion_minutos')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'abogados')]").isNotEmpty());
    }

    @Test
    void shouldApplyTheRulesOfTheHearingEndpoint() throws Exception {
        caseWithLegajo("MPFNQ 3010/2035");

        preview(lawyer, "hearings", csv(HEADER,
                        "MPFNQ 3010/2035;;formulacion-de-cargos;16/03/2035;10:00;2;;;;;;",
                        "MPFNQ 3010/2035;;formulacion-de-cargos;16/03/2035;10:00;;;;;reprogramada;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(2))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("duracion_minutos"));
    }

    @Test
    void shouldRejectALegajoAndAnInternalNumberThatPointToDifferentCases() throws Exception {
        caseWithLegajo("MPFNQ 3011/2035");
        createCase(lawyer, caseJson("Otro caso ficticio", ", \"internalNumber\": \"INT-H2\""));
        createCase(lawyer, caseJson("Caso con ambos ficticio", ", \"mpfLegajo\": \"MPFNQ 3012/2035\", \"internalNumber\": \"INT-H3\""));

        preview(lawyer, "hearings", csv(HEADER,
                        "MPFNQ 3011/2035;INT-H2;formulacion-de-cargos;16/03/2035;10:00;;;;;;;",
                        "MPFNQ 3011/2035;INT-NO-EXISTE;formulacion-de-cargos;16/03/2035;10:00;;;;;;;",
                        "MPFNQ 3012/2035;INT-H3;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("numero_interno"))
                .andExpect(jsonPath("$.rows[0].errors[0].message").value("No coincide con el caso del legajo MPF."))
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("numero_interno"))
                .andExpect(jsonPath("$.rows[2].status").value("VALID"));
    }

    @Test
    void shouldNeedALegajoOrAnInternalNumber() throws Exception {
        preview(lawyer, "hearings", csv(HEADER, ";;formulacion-de-cargos;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("legajo_mpf"));
    }

    @Test
    void shouldMatchTheTypeAndStatusAgainstTheCatalogsOfTheCasesArea() throws Exception {
        jdbc.update("update tenant set enabled_practice_areas = '{penal,civil}' where id = ?", tenantA);
        String civilCase = createCase(lawyer, """
                {"caption": "Causa civil ficticia", "circumscriptionCode": "i-confluencia", "actionType": "ordinario",
                 "represents": "actor", "practiceArea": "civil", "internalNumber": "INT-H9"}
                """);

        commit(lawyer, "hearings", csv(HEADER,
                        ";INT-H9;Audiencia preliminar;20/03/2035;09:30;;;;;Programada;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.hearings").value(1));
        preview(lawyer, "hearings", csv(HEADER,
                        ";INT-H9;formulacion-de-cargos;21/03/2035;09:30;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("tipo_audiencia"));

        getAs(lawyer, hearingsOf(civilCase))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].typeCode").value("preliminar"))
                .andExpect(jsonPath("$[0].defendants", hasSize(0)));
    }

    @Test
    void shouldReportOnlyTheCaseErrorWhenTheCaseDoesNotExist() throws Exception {
        preview(lawyer, "hearings", csv(HEADER, "MPFNQ 3999/2035;;tipo-inexistente;16/03/2035;10:00;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors", hasSize(1)))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("legajo_mpf"));
    }
}
