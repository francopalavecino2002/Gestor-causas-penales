package ar.gestorpenal.dataimport;

import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;

/**
 * The downloadable template of a kind: UTF-8 with a BOM and {@code ;} as delimiter, so Excel in
 * Spanish opens it with the accents and columns right, with the headers and one fictitious row.
 */
final class ImportTemplate {

    private static final String BOM = "﻿";
    private static final CSVFormat FORMAT =
            CSVFormat.DEFAULT.builder().setDelimiter(';').setRecordSeparator("\r\n").get();

    private ImportTemplate() {}

    static byte[] of(List<ImportColumn> columns) {
        StringWriter out = new StringWriter();
        out.write(BOM);
        try (CSVPrinter printer = new CSVPrinter(out, FORMAT)) {
            printer.printRecord(columns.stream().map(ImportColumn::name).toList());
            printer.printRecord(columns.stream().map(ImportColumn::example).toList());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }
}
