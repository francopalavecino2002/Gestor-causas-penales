package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** What every kind of import shares: access, the file and its headers, the limits and the templates. */
class ImportApiTests extends ImportApiTestSupport {

    private static final String PERSON_HEADER = "tipo_persona;nombres;apellidos";
    private static final String PERSON_ROW = "humana;Ana;Ejemplo";

    @Test
    void shouldAllowTheOwnerAndLawyersToImport() throws Exception {
        preview(owner, "persons", csv(PERSON_HEADER, PERSON_ROW)).andExpect(status().isOk());
        preview(lawyer, "persons", csv(PERSON_HEADER, PERSON_ROW)).andExpect(status().isOk());
    }

    @Test
    void shouldAnswer403ToAParalegal() throws Exception {
        preview(paralegal, "persons", csv(PERSON_HEADER, PERSON_ROW)).andExpect(status().isForbidden());
        commit(paralegal, "cases", csv("caratula", "Caso")).andExpect(status().isForbidden());
        commit(paralegal, "hearings", csv("tipo_audiencia", "x")).andExpect(status().isForbidden());
    }

    @Test
    void shouldAnswer404ForAnUnknownKind() throws Exception {
        preview(lawyer, "deadlines", csv(PERSON_HEADER, PERSON_ROW)).andExpect(status().isNotFound());
    }

    @Test
    void shouldRejectAHeaderThatIsNotInTheTemplateNamingIt() throws Exception {
        preview(lawyer, "persons", csv("tipo_persona;nombres;apellidos;colegio", "humana;Ana;Ejemplo;Norte"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/import-invalid-file"))
                .andExpect(jsonPath("$.headers[0]").value("colegio"));
    }

    @Test
    void shouldRejectAMissingRequiredHeaderNamingIt() throws Exception {
        preview(lawyer, "persons", csv("nombres;apellidos", "Ana;Ejemplo"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/import-invalid-file"))
                .andExpect(jsonPath("$.headers[0]").value("tipo_persona"));
    }

    @Test
    void shouldRejectARepeatedHeader() throws Exception {
        preview(lawyer, "persons", csv("tipo_persona;nombres;Nombres", "humana;Ana;Ana"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.headers[0]").value("nombres"));
    }

    @Test
    void shouldAcceptHeadersWithAccentsCapitalsAndSpaces() throws Exception {
        preview(lawyer, "cases", csv("Carátula;Número Interno;Circunscripción;Tipo Acción;Representa",
                        "Caso ficticio;INT-9;i-confluencia;publica;defensa"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.validRows").value(1));
    }

    @Test
    void shouldRejectAFileThatIsNotCsvOrXlsx() throws Exception {
        upload(lawyer, "persons", "datos.txt", "text/plain", csv(PERSON_HEADER, PERSON_ROW).getBytes(StandardCharsets.UTF_8), true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/import-invalid-file"));
    }

    @Test
    void shouldRejectMoreThanTheMaximumNumberOfRows() throws Exception {
        String[] rows = IntStream.rangeClosed(1, TableReader.MAX_DATA_ROWS + 1)
                .mapToObj(index -> "humana;Persona;Numero " + index)
                .toArray(String[]::new);

        preview(lawyer, "persons", csv(PERSON_HEADER, rows))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/import-invalid-file"));
    }

    @Test
    void shouldCapTheOffendingHeadersItEchoes() throws Exception {
        String longName = "x".repeat(100);
        String header = "tipo_persona;" + String.join(";", IntStream.rangeClosed(1, 30)
                .mapToObj(index -> longName + index)
                .toList());

        preview(lawyer, "persons", header + "\n")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.headers.length()").value(20))
                .andExpect(jsonPath("$.headers[0]").value("x".repeat(60)));
    }

    @Test
    void shouldRejectAFileOverTheSizeLimit() throws Exception {
        byte[] big = new byte[ImportService.MAX_FILE_BYTES + 1];

        upload(lawyer, "persons", "datos.csv", "text/csv", big, true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/import-invalid-file"));
    }

    @Test
    void shouldRejectACsvThatIsNotUtf8() throws Exception {
        byte[] latin1 = csv(PERSON_HEADER, "humana;José;Ejemplo").getBytes(StandardCharsets.ISO_8859_1);

        upload(lawyer, "persons", "datos.csv", "text/csv", latin1, true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("UTF-8")));
    }

    @Test
    void shouldPreviewByDefaultWhenDryRunIsNotSent() throws Exception {
        upload(lawyer, "persons", csv(PERSON_HEADER, PERSON_ROW), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(true))
                .andExpect(jsonPath("$.committed").value(false));

        assertThat(personTotal(lawyer, "Ejemplo")).isZero();
    }

    @Test
    void shouldServeATemplateWithTheHeadersAndOneExampleRow() throws Exception {
        MvcResult result = getAs(lawyer, "/api/v1/imports/persons/template")
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition", containsString("plantilla-persons.csv")))
                .andReturn();

        String body = new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        assertThat(body).startsWith("﻿tipo_persona;nombres;apellidos;razon_social;alias;tipo_documento;");
        assertThat(body.strip().lines()).hasSize(2);
    }

    @Test
    void shouldServeATemplateForEveryKind() throws Exception {
        for (ImportKind kind : ImportKind.values()) {
            getAs(lawyer, "/api/v1/imports/" + kind.path() + "/template")
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", containsString("plantilla-" + kind.path() + ".csv")));
        }
    }

    @Test
    void shouldAcceptTheTemplateOfPersonsAndCasesAsItIs() throws Exception {
        for (String kind : new String[] {"persons", "cases"}) {
            byte[] template = getAs(lawyer, "/api/v1/imports/" + kind + "/template")
                    .andReturn().getResponse().getContentAsByteArray();

            upload(lawyer, kind, "plantilla.csv", "text/csv", template, true)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalRows").value(1))
                    .andExpect(jsonPath("$.validRows").value(1))
                    .andExpect(jsonPath("$.errorRows").value(0));
        }
    }

    @Test
    void shouldReportTheRowsWithTheirNumberInTheSheet() throws Exception {
        preview(lawyer, "persons", csv(PERSON_HEADER, PERSON_ROW, "humana;Luis;", ";;"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRows").value(2))
                .andExpect(jsonPath("$.rows[*].row", containsInAnyOrder(2, 3)));
    }
}
