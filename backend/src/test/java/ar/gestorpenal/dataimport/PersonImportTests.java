package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.tenancy.TenantContext;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PersonImportTests extends ImportApiTestSupport {

    private static final String HEADER =
            "tipo_persona;nombres;apellidos;razon_social;tipo_documento;numero_documento;fecha_nacimiento;email";

    @Autowired
    private AuditTrail auditTrail;

    @Test
    void shouldReportWhatWouldBeCreatedInAPreviewAndCreateNothing() throws Exception {
        String file = csv(HEADER,
                "humana;Ana;Preview Uno;;DNI;10000101;15/03/1990;ana.preview@ejemplo.test",
                "juridica;;;Preview Sociedad Ficticia SA;CUIT;20-10000102-5;;");

        preview(lawyer, "persons", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("persons"))
                .andExpect(jsonPath("$.dryRun").value(true))
                .andExpect(jsonPath("$.committed").value(false))
                .andExpect(jsonPath("$.totalRows").value(2))
                .andExpect(jsonPath("$.validRows").value(2))
                .andExpect(jsonPath("$.errorRows").value(0))
                .andExpect(jsonPath("$.created.persons").value(2))
                .andExpect(jsonPath("$.created.cases").value(0))
                .andExpect(jsonPath("$.rows[0].status").value("VALID"))
                .andExpect(jsonPath("$.rows[0].label").value("Preview Uno, Ana"))
                .andExpect(jsonPath("$.rows[1].label").value("Preview Sociedad Ficticia SA"));

        assertThat(personTotal(lawyer, "Preview")).isZero();
        assertThat(TenantContext.callAs(tenantA, () -> auditTrail.changesMadeBy(lawyerId))).isEmpty();
    }

    @Test
    void shouldCreateAndAuditThePersonsOnCommit() throws Exception {
        String file = csv(HEADER,
                "humana;Ana;Commit Uno;;DNI;10000111;15/03/1990;",
                "juridica;;;Commit Sociedad Ficticia SA;;20-10000112-5;;");

        commit(lawyer, "persons", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(false))
                .andExpect(jsonPath("$.committed").value(true))
                .andExpect(jsonPath("$.created.persons").value(2));

        assertThat(personTotal(lawyer, "Commit")).isEqualTo(2);
        assertThat(personTotal(lawyer, "10000111")).isEqualTo(1);
        List<AuditEvent> changes = TenantContext.callAs(tenantA, () -> auditTrail.changesMadeBy(lawyerId));
        assertThat(changes).hasSize(2).extracting(AuditEvent::getAction).containsOnly(AuditAction.CREATE);
    }

    @Test
    void shouldFailTheWholeCommitWith422AndSaveNothingWhenOneRowIsBad() throws Exception {
        String file = csv(HEADER,
                "humana;Ana;Atomica Uno;;DNI;10000121;;",
                "humana;Luis;;;DNI;10000122;;",
                "humana;Eva;Atomica Tres;;DNI;10000123;;");

        commit(lawyer, "persons", file)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.type").value("/problems/import-has-errors"))
                .andExpect(jsonPath("$.report.committed").value(false))
                .andExpect(jsonPath("$.report.totalRows").value(3))
                .andExpect(jsonPath("$.report.validRows").value(2))
                .andExpect(jsonPath("$.report.errorRows").value(1))
                .andExpect(jsonPath("$.report.rows[1].row").value(3))
                .andExpect(jsonPath("$.report.rows[1].status").value("ERROR"))
                .andExpect(jsonPath("$.report.rows[1].errors[0].column").value("apellidos"));

        assertThat(personTotal(lawyer, "Atomica")).isZero();
    }

    @Test
    void shouldDetectADocumentRepeatedInsideTheFileInThePreview() throws Exception {
        String file = csv(HEADER,
                "humana;Ana;Repetida Uno;;DNI;10000131;;",
                "humana;Luis;Repetida Dos;;DNI;10.000.131;;");

        preview(lawyer, "persons", file)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1))
                .andExpect(jsonPath("$.errorRows").value(1))
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("numero_documento"))
                .andExpect(jsonPath("$.rows[1].errors[0].message").value("Ya existe una persona con ese documento."))
                .andExpect(jsonPath("$.created.persons").value(1));
    }

    @Test
    void shouldDetectADocumentThatTheFirmAlreadyHas() throws Exception {
        createPerson(owner, humanJson("Eva", "Existente Ficticia", "10000141"));

        preview(lawyer, "persons", csv(HEADER, "humana;Ana;Nueva;;DNI;10000141;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(1))
                .andExpect(jsonPath("$.rows[0].errors[0].column").value("numero_documento"));
    }

    @Test
    void shouldNotSeeThePeopleOfAnotherFirmAsDuplicates() throws Exception {
        createPerson(otherFirmOwner, humanJson("Eva", "Otra Firma Ficticia", "10000151"));

        preview(lawyer, "persons", csv(HEADER, "humana;Ana;Nuestra;;DNI;10000151;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(0));
    }

    @Test
    void shouldReportEveryColumnErrorOfARowWithoutEchoingTheValues() throws Exception {
        preview(lawyer, "persons", csv(HEADER,
                        "humana;Ana;Malos Datos;;DNI;abc;31/02/1990;",
                        "humana;Luis;Mal Email;;;;;no-es-un-email"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].status").value("ERROR"))
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'fecha_nacimiento')].message",
                        hasItem(containsString("dd/mm/aaaa"))))
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'numero_documento')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[1].errors[0].column").value("email"))
                .andExpect(jsonPath("$.rows[1].errors[0].message").value("No parece un email válido."));
    }

    @Test
    void shouldRequireTheNamesOfTheKindOfPerson() throws Exception {
        preview(lawyer, "persons", csv(HEADER,
                        "juridica;Ana;;;;;;",
                        "humana;;;Una Sociedad;;;;",
                        "alienigena;X;Y;;;;;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.errorRows").value(3))
                .andExpect(jsonPath("$.rows[0].errors[?(@.column == 'razon_social')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[1].errors[?(@.column == 'apellidos')]").isNotEmpty())
                .andExpect(jsonPath("$.rows[2].errors[0].column").value("tipo_persona"));
    }

    @Test
    void shouldReadAnXlsxWithDateAndNumericCells() throws Exception {
        byte[] workbook = XlsxTableReaderTests.workbook(
                new Object[] {"tipo_persona", "nombres", "apellidos", "tipo_documento", "numero_documento", "fecha_nacimiento"},
                new Object[] {"humana", "Ana", "Excel Uno", "DNI", 10000161, LocalDate.of(1990, 3, 15)});

        upload(lawyer, "persons", "personas.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", workbook, false)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.committed").value(true))
                .andExpect(jsonPath("$.created.persons").value(1));

        assertThat(personTotal(lawyer, "10000161")).isEqualTo(1);
    }
}
