package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.tenancy.TenantContext;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CaseImportTests extends ImportApiTestSupport {

    private static final String HEADER = "caratula;numero_interno;legajo_mpf;circunscripcion;tipo_accion;representa;"
            + "abogado_responsable;imputado_tipo_documento;imputado_numero_documento;imputado_nombres;"
            + "imputado_apellidos;imputado_etapa;imputado_fecha_formalizacion";

    @Autowired
    private AuditTrail auditTrail;

    private String caseIdOf(String caption) throws Exception {
        String body = getAs(lawyer, "/api/v1/cases?q=" + caption).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.items[0].id");
    }

    @Test
    void shouldReportWhatWouldBeCreatedInAPreviewAndCreateNothing() throws Exception {
        String file = csv(HEADER,
                "Caso Previa Ficticio;;MPFNQ 2001/2035;i-confluencia;publica;defensa;;DNI;10000201;Ana;Previa;;");

        preview(lawyer, "cases", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.created.cases").value(1))
                .andExpect(jsonPath("$.created.defendants").value(1))
                .andExpect(jsonPath("$.created.persons").value(1))
                .andExpect(jsonPath("$.rows[0].label").value("MPFNQ 2001/2035"));

        assertThat(caseTotal(lawyer, "Previa")).isZero();
        assertThat(personTotal(lawyer, "Previa")).isZero();
    }

    @Test
    void shouldCreateTheCaseItsDefendantAndTheirPersonOnCommitAndAuditThem() throws Exception {
        String file = csv(HEADER,
                "Caso Commit Ficticio;INT-C1;mpfnq 2002/2035;I Circunscripción (Confluencia);Instancia privada;Defensa;"
                        + ";DNI;10.000.202;Ana;Commit;Investigación preparatoria;15/03/2025");

        commit(lawyer, "cases", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.committed").value(true))
                .andExpect(jsonPath("$.created.cases").value(1));

        String caseId = caseIdOf("Commit");
        getAs(lawyer, "/api/v1/cases/" + caseId)
                .andExpect(jsonPath("$.mpfLegajo").value("MPFNQ 2002/2035"))
                .andExpect(jsonPath("$.internalNumber").value("INT-C1"))
                .andExpect(jsonPath("$.circumscriptionCode").value("i-confluencia"))
                .andExpect(jsonPath("$.actionType").value("PUBLIC_ON_COMPLAINT"))
                .andExpect(jsonPath("$.represents").value("DEFENCE"))
                .andExpect(jsonPath("$.reserved").value(false))
                .andExpect(jsonPath("$.team[0].userId").value(lawyerId.toString()))
                .andExpect(jsonPath("$.team[0].role").value("RESPONSIBLE"))
                .andExpect(jsonPath("$.defendants", hasSize(1)))
                .andExpect(jsonPath("$.defendants[0].displayName").value("Commit, Ana"))
                .andExpect(jsonPath("$.defendants[0].stageCode").value("investigacion-preparatoria"))
                .andExpect(jsonPath("$.defendants[0].chargesFormulatedOn").value("2025-03-15"));
        List<AuditEvent> changes = TenantContext.callAs(tenantA, () -> auditTrail.changesMadeBy(lawyerId));
        assertThat(changes).extracting(AuditEvent::getAction).contains(AuditAction.CREATE);
        assertThat(changes).hasSizeGreaterThanOrEqualTo(3);
    }

    @Test
    void shouldMakeRowsThatShareTheLegajoOneCaseWithSeveralDefendants() throws Exception {
        String file = csv(HEADER,
                "Caso Unico Ficticio;;MPFNQ 2003/2035;i-confluencia;publica;defensa;;DNI;10000211;Ana;Uno;;",
                ";;MPFNQ 2003/2035;;;;;DNI;10000212;Luis;Dos;;",
                ";;mpfnq 2003/2035;i-confluencia;;;;;10000213;Eva;Tres;;");

        commit(lawyer, "cases", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRows").value(3))
                .andExpect(jsonPath("$.created.cases").value(1))
                .andExpect(jsonPath("$.created.defendants").value(3))
                .andExpect(jsonPath("$.created.persons").value(3));

        assertThat(caseTotal(lawyer, "Unico")).isEqualTo(1);
        getAs(lawyer, "/api/v1/cases/" + caseIdOf("Unico")).andExpect(jsonPath("$.defendants", hasSize(3)));
    }

    @Test
    void shouldGroupRowsByInternalNumberWhenThereIsNoLegajo() throws Exception {
        String file = csv(HEADER,
                "Caso Interno Ficticio;INT-G1;;i-confluencia;publica;defensa;;DNI;10000221;Ana;Uno;;",
                ";INT-G1;;;;;;DNI;10000222;Luis;Dos;;");

        commit(lawyer, "cases", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.cases").value(1))
                .andExpect(jsonPath("$.created.defendants").value(2));
    }

    @Test
    void shouldRejectALaterRowWhoseCaseColumnsContradictTheFirstOne() throws Exception {
        String file = csv(HEADER,
                "Caso Primero Ficticio;;MPFNQ 2004/2035;i-confluencia;publica;defensa;;DNI;10000231;Ana;Uno;;",
                "Otra caratula;;MPFNQ 2004/2035;;;;;DNI;10000232;Luis;Dos;;");

        preview(lawyer, "cases", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("caratula"))
                .andExpect(jsonPath("$.rows[1].errors[0].message").value(
                        "Tiene que estar vacío o ser igual al de la primera fila de este caso."));
    }

    @Test
    void shouldReuseThePersonThatTheFirmAlreadyHasInsteadOfCreatingOne() throws Exception {
        createPerson(owner, humanJson("Eva", "Existente Ficticia", "10000241"));

        commit(lawyer, "cases", csv(HEADER,
                "Caso Reuso Ficticio;;MPFNQ 2005/2035;i-confluencia;publica;defensa;;DNI;10000241;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.persons").value(0))
                .andExpect(jsonPath("$.created.defendants").value(1));

        getAs(lawyer, "/api/v1/cases/" + caseIdOf("Reuso"))
                .andExpect(jsonPath("$.defendants[0].displayName").value("Existente Ficticia, Eva"));
    }

    @Test
    void shouldRequireNamesToCreateTheDefendantPersonWhenTheDocumentIsUnknown() throws Exception {
        preview(lawyer, "cases", csv(HEADER,
                        "Caso Sin Nombres Ficticio;;MPFNQ 2006/2035;i-confluencia;publica;defensa;;DNI;10000251;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(1))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("imputado_apellidos"))
                .andExpect(jsonPath("$.created.cases").value(0));
    }

    @Test
    void shouldAcceptACaseWithoutDefendant() throws Exception {
        commit(lawyer, "cases", csv(HEADER,
                "Caso Solo Ficticio;INT-S1;;i-confluencia;privada;querella;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.cases").value(1))
                .andExpect(jsonPath("$.created.defendants").value(0))
                .andExpect(jsonPath("$.rows[0].label").value("INT-S1"));
    }

    @Test
    void shouldRejectACaseNumberThatTheFirmAlreadyHas() throws Exception {
        createCase(owner, caseJson("Caso Previo Ficticio", ", \"mpfLegajo\": \"MPFNQ 2007/2035\", \"internalNumber\": \"INT-D1\""));

        preview(lawyer, "cases", csv(HEADER,
                        "Caso Dup Legajo;;MPFNQ 2007/2035;i-confluencia;publica;defensa;;;;;;;",
                        "Caso Dup Interno;INT-D1;;i-confluencia;publica;defensa;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(2))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("legajo_mpf"))
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("numero_interno"));
    }

    @Test
    void shouldNotTreatACaseNumberOfAnotherFirmAsDuplicate() throws Exception {
        createCase(otherFirmOwner, caseJson("Caso Ajeno Ficticio", ", \"mpfLegajo\": \"MPFNQ 2008/2035\""));

        preview(lawyer, "cases", csv(HEADER, "Caso Propio Ficticio;;MPFNQ 2008/2035;i-confluencia;publica;defensa;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(0));
    }

    @Test
    void shouldNotLetLaterRowsAttachToACaseWhoseRowFailed() throws Exception {
        String archived = createPerson(owner, humanJson("Eva", "Archivada Ficticia", "10000271"));
        mockMvc.perform(post("/api/v1/persons/" + archived + "/archive").with(owner).with(CSRF))
                .andExpect(status().isNoContent());

        preview(lawyer, "cases", csv(HEADER,
                        "Caso Reintento Ficticio;;MPFNQ 2020/2035;i-confluencia;publica;defensa;;DNI;10000271;;;;",
                        "Caso Reintento Ficticio;;MPFNQ 2020/2035;i-confluencia;publica;defensa;;DNI;10000272;Ana;Buena;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.errorRows").value(1))
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("imputado_numero_documento"))
                .andExpect(jsonPath("$.rows[1].status").value("VALID"))
                .andExpect(jsonPath("$.created.cases").value(1))
                .andExpect(jsonPath("$.created.defendants").value(1))
                .andExpect(jsonPath("$.created.persons").value(1));
    }

    @Test
    void shouldCheckTheShapeOfTheDefendantsDocumentBeforeCreatingTheCase() throws Exception {
        preview(lawyer, "cases", csv(HEADER,
                        "Caso Forma Ficticio;;MPFNQ 2022/2035;i-confluencia;publica;defensa;;DNI;abc;Ana;Forma;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("imputado_numero_documento"))
                .andExpect(jsonPath("$.created.cases").value(0));
    }

    @Test
    void shouldAnswerTheDuplicateErrorForAReservedCaseTheImporterCannotSeeWithoutRevealingIt() throws Exception {
        String reservedId = createCase(lawyer,
                caseJson("Caso Reservado Ficticio", ", \"mpfLegajo\": \"MPFNQ 2021/2035\", \"reserved\": true"));

        preview(otherLawyer, "cases",
                        csv(HEADER, "Caso Otro Ficticio;;MPFNQ 2021/2035;i-confluencia;publica;defensa;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("legajo_mpf"))
                .andExpect(jsonPath("$.rows[0].errors[0].message").value("Ya existe un caso con ese legajo MPF."))
                .andExpect(content().string(not(containsString(reservedId))));
    }

    @Test
    void shouldAssignTheResponsibleLawyerByEmail() throws Exception {
        commit(lawyer, "cases", csv(HEADER,
                "Caso Responsable Ficticio;;MPFNQ 2009/2035;i-confluencia;publica;defensa;Abogada@Ejemplo.test;;;;;;"))
                .andExpect(status().isOk());

        getAs(lawyer, "/api/v1/cases/" + caseIdOf("Responsable"))
                .andExpect(jsonPath("$.team[0].userId").value(otherLawyerId.toString()))
                .andExpect(jsonPath("$.team[0].role").value("RESPONSIBLE"));
    }

    @Test
    void shouldRejectAResponsibleWhoIsNotALawyerOfTheFirm() throws Exception {
        preview(lawyer, "cases", csv(HEADER,
                        "Caso Uno;;MPFNQ 2010/2035;i-confluencia;publica;defensa;procurador@ejemplo.test;;;;;;",
                        "Caso Dos;;MPFNQ 2011/2035;i-confluencia;publica;defensa;titular@beta.test;;;;;;",
                        "Caso Tres;;MPFNQ 2012/2035;i-confluencia;publica;defensa;nadie@ejemplo.test;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(3))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("abogado_responsable"))
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("abogado_responsable"))
                .andExpect(jsonPath("$.rows[2].errors[0].column").value("abogado_responsable"));
    }

    @Test
    void shouldNeedALegajoOrAnInternalNumberInEveryRow() throws Exception {
        preview(lawyer, "cases", csv(HEADER, "Caso Sin Numero;;;i-confluencia;publica;defensa;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("legajo_mpf"));
    }

    @Test
    void shouldReportEveryInvalidColumnOfARow() throws Exception {
        preview(lawyer, "cases", csv(HEADER, ";;MPF-mal;inexistente;rara;nadie;;;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'caratula')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'legajo_mpf')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'circunscripcion')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'tipo_accion')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'representa')]").isNotEmpty());
    }

    @Test
    void shouldSaveNothingWhenOneRowFailsOnCommit() throws Exception {
        String file = csv(HEADER,
                "Caso Bueno Ficticio;;MPFNQ 2013/2035;i-confluencia;publica;defensa;;DNI;10000261;Ana;Buena;;",
                "Caso Malo Ficticio;;MPFNQ 2014/2035;i-confluencia;publica;defensa;;DNI;10000262;;;;");

        commit(lawyer, "cases", file)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.type").value("/problems/import-has-errors"))
                .andExpect(jsonPath("$.report.errorRows").value(1));

        assertThat(caseTotal(lawyer, "Ficticio")).isZero();
        assertThat(personTotal(lawyer, "Buena")).isZero();
    }
}
