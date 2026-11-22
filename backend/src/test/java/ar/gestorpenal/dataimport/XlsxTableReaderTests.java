package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class XlsxTableReaderTests {

    /**
     * An {@code .xlsx} in memory. A cell is a {@code String}, a {@code Number}, a {@link LocalDate}
     * or {@link LocalTime} (stored as a real date or time cell), or {@code null} (no cell).
     */
    static byte[] workbook(Object[]... rows) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Datos");
            CreationHelper helper = workbook.getCreationHelper();
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(helper.createDataFormat().getFormat("dd/mm/yyyy"));
            CellStyle timeStyle = workbook.createCellStyle();
            timeStyle.setDataFormat(helper.createDataFormat().getFormat("hh:mm"));
            for (int rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                Row row = sheet.createRow(rowIndex);
                for (int column = 0; column < rows[rowIndex].length; column++) {
                    Object value = rows[rowIndex][column];
                    if (value == null) {
                        continue;
                    }
                    Cell cell = row.createCell(column);
                    switch (value) {
                        case LocalDate date -> {
                            cell.setCellValue(date);
                            cell.setCellStyle(dateStyle);
                        }
                        case LocalTime time -> {
                            cell.setCellValue(time.toSecondOfDay() / 86400.0);
                            cell.setCellStyle(timeStyle);
                        }
                        case Number number -> cell.setCellValue(number.doubleValue());
                        default -> cell.setCellValue(value.toString());
                    }
                }
            }
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private final XlsxTableReader reader = new XlsxTableReader();

    private ParsedTable read(byte[] content) throws IOException {
        return reader.read(new ByteArrayInputStream(content));
    }

    @Test
    void shouldReadTextAndNumericCellsAsTheyAreShown() throws IOException {
        ParsedTable table = read(workbook(
                new Object[] {"nombres", "numero_documento", "duracion_minutos"},
                new Object[] {"Ana", 10000001, 60}));

        assertThat(table.headers()).containsExactly("nombres", "numero_documento", "duracion_minutos");
        assertThat(table.rows().get(0).cells()).containsExactly("Ana", "10000001", "60");
    }

    @Test
    void shouldConvertDateCellsToIsoDaysAndTimeCellsToHoursAndMinutes() throws IOException {
        ParsedTable table = read(workbook(
                new Object[] {"fecha", "hora"},
                new Object[] {LocalDate.of(2035, 3, 15), LocalTime.of(9, 30)}));

        assertThat(table.rows().get(0).cells()).containsExactly("2035-03-15", "09:30");
    }

    @Test
    void shouldSkipBlankRowsAndKeepTheNumberOfTheRowsInTheSheet() throws IOException {
        ParsedTable table = read(workbook(
                new Object[] {"nombres", "apellidos"},
                new Object[] {"Ana", "Ejemplo"},
                new Object[] {null, null},
                new Object[] {"Luis", null}));

        assertThat(table.rows()).extracting(ParsedTable.Row::number).containsExactly(2, 4);
        assertThat(table.rows().get(1).cells()).containsExactly("Luis", "");
    }

    @Test
    void shouldRejectMoreDataRowsThanTheLimit() {
        Object[][] rows = new Object[TableReader.MAX_DATA_ROWS + 2][];
        rows[0] = new Object[] {"nombres"};
        for (int index = 1; index < rows.length; index++) {
            rows[index] = new Object[] {"Persona " + index};
        }

        assertThatThrownBy(() -> read(workbook(rows)))
                .isInstanceOf(InvalidImportFileException.class)
                .hasMessageContaining("filas");
    }

    @Test
    void shouldAcceptExactlyTheMaximumNumberOfDataRows() throws IOException {
        Object[][] rows = new Object[TableReader.MAX_DATA_ROWS + 1][];
        rows[0] = new Object[] {"nombres"};
        for (int index = 1; index < rows.length; index++) {
            rows[index] = new Object[] {"Persona " + index};
        }

        assertThat(read(workbook(rows)).rows()).hasSize(TableReader.MAX_DATA_ROWS);
    }

    @Test
    void shouldRejectMoreColumnsThanTheLimit() {
        Object[] header = new Object[TableReader.MAX_COLUMNS + 1];
        for (int index = 0; index < header.length; index++) {
            header[index] = "columna" + index;
        }

        assertThatThrownBy(() -> read(workbook(header)))
                .isInstanceOf(InvalidImportFileException.class)
                .hasMessageContaining("columnas");
    }

    @Test
    void shouldRejectAFileThatIsNotAWorkbook() {
        byte[] notExcel = "nombres;apellidos\n".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> read(notExcel)).isInstanceOf(InvalidImportFileException.class);
    }
}
