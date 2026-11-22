package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class CsvTableReaderTests {

    private final CsvTableReader reader = new CsvTableReader();

    private ParsedTable read(String content) throws IOException {
        return reader.read(new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void shouldReadSemicolonDelimitedFiles() throws IOException {
        ParsedTable table = read("nombres;apellidos\nAna;Ejemplo\nLuis;Prueba\n");

        assertThat(table.headers()).containsExactly("nombres", "apellidos");
        assertThat(table.rows()).extracting(ParsedTable.Row::cells)
                .containsExactly(List.of("Ana", "Ejemplo"), List.of("Luis", "Prueba"));
    }

    @Test
    void shouldReadCommaDelimitedFiles() throws IOException {
        ParsedTable table = read("nombres,apellidos\nAna,Ejemplo\n");

        assertThat(table.headers()).containsExactly("nombres", "apellidos");
        assertThat(table.rows().get(0).cells()).containsExactly("Ana", "Ejemplo");
    }

    @Test
    void shouldIgnoreTheByteOrderMark() throws IOException {
        ParsedTable table = read("﻿nombres;apellidos\nAna;Ejemplo\n");

        assertThat(table.headers()).containsExactly("nombres", "apellidos");
    }

    @Test
    void shouldKeepDelimitersAndLineBreaksInsideQuotedFields() throws IOException {
        ParsedTable table = read("caratula;sala\n\"Uno; dos, \"\"tres\"\"\nlinea\";Sala 1\n");

        assertThat(table.rows().get(0).cells()).containsExactly("Uno; dos, \"tres\"\nlinea", "Sala 1");
    }

    @Test
    void shouldSkipBlankRowsButKeepTheNumberOfTheRowsInTheSheet() throws IOException {
        ParsedTable table = read("nombres;apellidos\nAna;Ejemplo\n;\n   ;  \nLuis;Prueba\n");

        assertThat(table.rows()).extracting(ParsedTable.Row::number).containsExactly(2, 5);
    }

    @Test
    void shouldCountTrulyEmptyLinesInTheRowNumbers() throws IOException {
        ParsedTable table = read("nombres\nAna\n\nLuis\n\n\nEva\n");

        assertThat(table.rows()).extracting(ParsedTable.Row::number).containsExactly(2, 4, 7);
    }

    @Test
    void shouldRejectMoreColumnsThanTheLimit() {
        String header = String.join(";", IntStream.rangeClosed(0, TableReader.MAX_COLUMNS)
                .mapToObj(index -> "columna" + index)
                .toList());

        assertThatThrownBy(() -> read(header + "\n"))
                .isInstanceOf(InvalidImportFileException.class)
                .hasMessageContaining("columnas");
    }

    @Test
    void shouldRejectAFileThatIsNotUtf8() {
        byte[] latin1 = "nombres\nJosé\n".getBytes(StandardCharsets.ISO_8859_1);

        assertThatThrownBy(() -> reader.read(new ByteArrayInputStream(latin1)))
                .isInstanceOf(InvalidImportFileException.class)
                .hasMessageContaining("UTF-8");
    }

    @Test
    void shouldRejectAFileWithMoreRowsThanTheLimit() {
        String rows = String.join("\n", IntStream.rangeClosed(1, TableReader.MAX_DATA_ROWS + 1)
                .mapToObj(index -> "Persona " + index)
                .toList());

        assertThatThrownBy(() -> read("nombres\n" + rows + "\n"))
                .isInstanceOf(InvalidImportFileException.class)
                .hasMessageContaining("filas");
    }

    @Test
    void shouldRejectAnEmptyFile() {
        assertThatThrownBy(() -> read("")).isInstanceOf(InvalidImportFileException.class);
    }
}
