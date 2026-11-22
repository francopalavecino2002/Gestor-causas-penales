package ar.gestorpenal.dataimport;

import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

/**
 * CSV in UTF-8. A leading BOM is ignored, and the delimiter is {@code ;} or {@code ,}, whichever
 * is more frequent in the header line (Excel in Spanish saves with {@code ;}).
 */
final class CsvTableReader implements TableReader {

    private static final char BOM = '﻿';

    @Override
    public ParsedTable read(InputStream content) throws IOException {
        String text = decode(content.readAllBytes());
        CSVFormat format = CSVFormat.DEFAULT.builder().setDelimiter(delimiterOf(text))
                .setIgnoreEmptyLines(false).get();
        List<String> headers = null;
        List<ParsedTable.Row> rows = new ArrayList<>();
        try (CSVParser parser = format.parse(new StringReader(text))) {
            for (CSVRecord record : parser) {
                List<String> cells = record.toList();
                if (headers == null) {
                    TableReader.requireColumnLimit(cells.size());
                    headers = cells;
                } else if (cells.stream().anyMatch(cell -> !cell.isBlank())) {
                    if (rows.size() == MAX_DATA_ROWS) {
                        throw TableReader.tooManyRows();
                    }
                    rows.add(new ParsedTable.Row((int) record.getRecordNumber(), cells));
                }
            }
        } catch (UncheckedIOException | IllegalStateException e) {
            throw new InvalidImportFileException("El CSV está mal formado (revisá las comillas).");
        }
        if (headers == null) {
            throw new InvalidImportFileException("El archivo está vacío.");
        }
        return new ParsedTable(headers, rows);
    }

    private static String decode(byte[] bytes) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
            return text.startsWith(String.valueOf(BOM)) ? text.substring(1) : text;
        } catch (CharacterCodingException e) {
            throw new InvalidImportFileException("El CSV tiene que estar codificado en UTF-8.");
        }
    }

    private static char delimiterOf(String text) {
        int end = text.indexOf('\n');
        String headerLine = end < 0 ? text : text.substring(0, end);
        long semicolons = headerLine.chars().filter(c -> c == ';').count();
        long commas = headerLine.chars().filter(c -> c == ',').count();
        return semicolons > commas ? ';' : ',';
    }
}
