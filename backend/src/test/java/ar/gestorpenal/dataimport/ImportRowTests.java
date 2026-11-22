package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ImportRowTests {

    private static ImportRow row(String column, String value) {
        return ImportRow.of(2, Map.of(column, value));
    }

    @Test
    void shouldNormalizeHeadersByTrimmingFoldingAccentsAndUsingUnderscores() {
        assertThat(ImportText.header("  Número Interno ")).isEqualTo("numero_interno");
        assertThat(ImportText.header("LEGAJO MPF")).isEqualTo("legajo_mpf");
        assertThat(ImportText.header("tipo_audiencia")).isEqualTo("tipo_audiencia");
        assertThat(ImportText.header("")).isEmpty();
    }

    @Test
    void shouldTreatBlankAndMissingCellsAsNull() {
        ImportRow row = row("nombres", "   ");

        assertThat(row.text("nombres")).isNull();
        assertThat(row.text("apellidos")).isNull();
        assertThatCode(row::throwIfErrors).doesNotThrowAnyException();
    }

    @Test
    void shouldParseDatesInTheThreeFormats() {
        assertThat(row("fecha", "15/03/2035").date("fecha")).isEqualTo(LocalDate.of(2035, 3, 15));
        assertThat(row("fecha", "5/3/2035").date("fecha")).isEqualTo(LocalDate.of(2035, 3, 5));
        assertThat(row("fecha", "2035-03-15").date("fecha")).isEqualTo(LocalDate.of(2035, 3, 15));
    }

    @Test
    void shouldReportAnInvalidDateInSpanishWithoutEchoingTheValue() {
        ImportRow row = row("fecha", "31/02/2035");

        assertThat(row.date("fecha")).isNull();
        assertThatThrownBy(row::throwIfErrors).isInstanceOfSatisfying(RowException.class, e -> {
            assertThat(e.errors()).hasSize(1);
            assertThat(e.errors().get(0).column()).isEqualTo("fecha");
            assertThat(e.errors().get(0).message()).contains("dd/mm/aaaa").doesNotContain("31/02/2035");
        });
    }

    @Test
    void shouldParseTimesWithOneOrTwoDigitHours() {
        assertThat(row("hora", "09:30").time("hora")).isEqualTo(LocalTime.of(9, 30));
        assertThat(row("hora", "9:30").time("hora")).isEqualTo(LocalTime.of(9, 30));
        assertThat(row("hora", "25:00").time("hora")).isNull();
    }

    @Test
    void shouldParseIntegers() {
        assertThat(row("minutos", "45").integer("minutos")).isEqualTo(45);
        ImportRow bad = row("minutos", "45,5");
        assertThat(bad.integer("minutos")).isNull();
        assertThatThrownBy(bad::throwIfErrors).isInstanceOf(RowException.class);
    }

    @Test
    void shouldReadAChoiceByItsSpanishWordIgnoringCaseAccentsAndSpaces() {
        Map<String, Integer> options = new LinkedHashMap<>();
        options.put("instancia_privada", 1);
        options.put("publica", 2);

        assertThat(row("tipo", "Instancia Privada").choice("tipo", options)).isEqualTo(1);
        assertThat(row("tipo", "PÚBLICA").choice("tipo", options)).isEqualTo(2);
        ImportRow unknown = row("tipo", "otra");
        assertThat(unknown.choice("tipo", options)).isNull();
        assertThatThrownBy(unknown::throwIfErrors).isInstanceOf(RowException.class);
    }

    @Test
    void shouldSplitMultiValueCellsOnThePipe() {
        assertThat(row("abogados", " a@ejemplo.test | b@ejemplo.test ||").list("abogados"))
                .containsExactly("a@ejemplo.test", "b@ejemplo.test");
        assertThat(row("abogados", "").list("abogados")).isEmpty();
    }

    @Test
    void shouldCollectEveryColumnErrorBeforeThrowing() {
        Map<String, String> cells = new LinkedHashMap<>();
        cells.put("fecha", "ayer");
        cells.put("hora", "tarde");
        ImportRow row = ImportRow.of(7, cells);
        row.date("fecha");
        row.time("hora");
        row.require("sala", row.text("sala"));

        assertThat(row.number()).isEqualTo(7);
        assertThatThrownBy(row::throwIfErrors).isInstanceOfSatisfying(RowException.class, e ->
                assertThat(e.errors()).extracting(RowError::column).containsExactly("fecha", "hora", "sala"));
    }
}
