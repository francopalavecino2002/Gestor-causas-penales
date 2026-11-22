package ar.gestorpenal.dataimport;

import java.io.IOException;
import java.io.InputStream;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.xml.parsers.ParserConfigurationException;
import org.apache.poi.openxml4j.exceptions.OpenXML4JException;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.util.XMLHelper;
import org.apache.poi.xssf.eventusermodel.ReadOnlySharedStringsTable;
import org.apache.poi.xssf.eventusermodel.XSSFReader;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler.SheetContentsHandler;
import org.apache.poi.xssf.usermodel.XSSFComment;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.XMLReader;

/**
 * The first sheet of an {@code .xlsx} workbook, read as a stream of XML events so a small zip cannot
 * inflate into a huge object tree. Cells are read as the user sees them (formatted text); a date
 * cell becomes an ISO day ({@code aaaa-mm-dd}) and a time-only cell {@code hh:mm}. POI's zip-bomb
 * ratio check stays at its default and the size of one entry is capped lower than POI's default.
 */
final class XlsxTableReader implements TableReader {

    private static final long MAX_ENTRY_BYTES = 50L * 1024 * 1024;

    static {
        ZipSecureFile.setMaxEntrySize(MAX_ENTRY_BYTES);
    }

    @Override
    public ParsedTable read(InputStream content) throws IOException {
        OPCPackage pack = null;
        try {
            pack = OPCPackage.open(content);
            XSSFReader reader = new XSSFReader(pack);
            Iterator<InputStream> sheets = reader.getSheetsData();
            if (!sheets.hasNext()) {
                throw new InvalidImportFileException("El archivo está vacío.");
            }
            Collector collector = new Collector();
            XMLReader xml = XMLHelper.newXMLReader();
            xml.setContentHandler(new XSSFSheetXMLHandler(
                    reader.getStylesTable(), new ReadOnlySharedStringsTable(pack), collector, new IsoDataFormatter(), false));
            try (InputStream sheet = sheets.next()) {
                xml.parse(new InputSource(sheet));
            }
            return collector.table();
        } catch (InvalidImportFileException e) {
            throw e;
        } catch (SAXException | RuntimeException | OpenXML4JException | ParserConfigurationException | IOException e) {
            throw invalidFile(e);
        } finally {
            if (pack != null) {
                pack.revert();
            }
        }
    }

    /** The import error hidden inside a parser exception, or the generic "not a valid .xlsx". */
    private static InvalidImportFileException invalidFile(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof InvalidImportFileException known) {
                return known;
            }
        }
        return new InvalidImportFileException("No se pudo leer el archivo: tiene que ser un .xlsx válido.");
    }

    /** Dates as ISO days and times of the day as {@code hh:mm}; everything else as Excel shows it. */
    private static final class IsoDataFormatter extends DataFormatter {

        private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm");

        @Override
        public String formatRawCellContents(double value, int formatIndex, String formatString, boolean use1904Windowing) {
            if (!DateUtil.isADateFormat(formatIndex, formatString)) {
                return super.formatRawCellContents(value, formatIndex, formatString, use1904Windowing);
            }
            var moment = DateUtil.getLocalDateTime(value, use1904Windowing);
            return value < 1 ? moment.format(HOUR_MINUTE) : moment.toLocalDate().toString();
        }
    }

    /** Builds the table from the rows of the sheet, failing as soon as a limit is passed. */
    private static final class Collector implements SheetContentsHandler {

        private final Map<Integer, String> current = new TreeMap<>();
        private final List<ParsedTable.Row> rows = new ArrayList<>();
        private List<String> headers;
        private int currentRow;

        @Override
        public void startRow(int rowNum) {
            currentRow = rowNum;
            current.clear();
        }

        @Override
        public void cell(String cellReference, String formattedValue, XSSFComment comment) {
            if (cellReference != null && formattedValue != null) {
                current.put((int) new CellReference(cellReference).getCol(), formattedValue);
            }
        }

        @Override
        public void endRow(int rowNum) {
            if (headers == null) {
                if (!current.isEmpty()) {
                    int width = current.keySet().stream().reduce(0, Integer::max) + 1;
                    TableReader.requireColumnLimit(width);
                    headers = cells(width);
                }
                return;
            }
            List<String> cells = cells(headers.size());
            if (cells.stream().anyMatch(cell -> !cell.isBlank())) {
                if (rows.size() == MAX_DATA_ROWS) {
                    throw TableReader.tooManyRows();
                }
                rows.add(new ParsedTable.Row(currentRow + 1, cells));
            }
        }

        private List<String> cells(int count) {
            List<String> cells = new ArrayList<>();
            for (int column = 0; column < count; column++) {
                cells.add(current.getOrDefault(column, ""));
            }
            return cells;
        }

        ParsedTable table() {
            if (headers == null) {
                throw new InvalidImportFileException("El archivo está vacío.");
            }
            return new ParsedTable(headers, rows);
        }
    }
}
