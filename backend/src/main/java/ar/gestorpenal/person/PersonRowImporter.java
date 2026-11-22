package ar.gestorpenal.person;

import ar.gestorpenal.dataimport.ImportColumn;
import ar.gestorpenal.dataimport.ImportContext;
import ar.gestorpenal.dataimport.ImportKind;
import ar.gestorpenal.dataimport.ImportRow;
import ar.gestorpenal.dataimport.ImportValidator;
import ar.gestorpenal.dataimport.RowException;
import ar.gestorpenal.dataimport.RowImporter;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Imports one person per row through {@link PersonService}, the code behind {@code POST /persons}
 * (ADR-0019). A document that already exists, in the firm or in an earlier row, is a row error.
 */
@Component
class PersonRowImporter implements RowImporter {

    private static final Map<String, PersonKind> KINDS = kinds();

    private static final Map<String, String> COLUMN_OF_PROPERTY = Map.ofEntries(
            Map.entry("kind", "tipo_persona"),
            Map.entry("firstNames", "nombres"),
            Map.entry("lastNames", "apellidos"),
            Map.entry("legalName", "razon_social"),
            Map.entry("aliases", "alias"),
            Map.entry("documentNumber", "numero_documento"),
            Map.entry("birthDate", "fecha_nacimiento"),
            Map.entry("nationality", "nacionalidad"),
            Map.entry("phone", "telefono"),
            Map.entry("email", "email"),
            Map.entry("address", "domicilio"));

    private final PersonService people;
    private final ImportValidator validator;

    PersonRowImporter(PersonService people, ImportValidator validator) {
        this.people = people;
        this.validator = validator;
    }

    @Override
    public ImportKind kind() {
        return ImportKind.PERSONS;
    }

    @Override
    public List<ImportColumn> columns() {
        return List.of(
                new ImportColumn("tipo_persona", true, "humana"),
                new ImportColumn("nombres", false, "Juan"),
                new ImportColumn("apellidos", false, "Ejemplo"),
                new ImportColumn("razon_social", false, null),
                new ImportColumn("alias", false, null),
                new ImportColumn("tipo_documento", false, "DNI"),
                new ImportColumn("numero_documento", false, "10000001"),
                new ImportColumn("fecha_nacimiento", false, "15/01/1990"),
                new ImportColumn("nacionalidad", false, "Argentina"),
                new ImportColumn("telefono", false, "2990000000"),
                new ImportColumn("email", false, "juan.ejemplo@ejemplo.test"),
                new ImportColumn("domicilio", false, "Calle Ficticia 123, Neuquén"));
    }

    @Override
    public String importRow(AuthenticatedUser user, ImportRow row, ImportContext context) {
        PersonKind kind = row.require("tipo_persona", row.choice("tipo_persona", KINDS));
        String firstNames = row.text("nombres");
        String lastNames = row.text("apellidos");
        String legalName = row.text("razon_social");
        LocalDate birthDate = row.date("fecha_nacimiento");
        String number = row.text("numero_documento");
        DocumentType type = row.choice("tipo_documento", DocumentType.words());
        if (number != null && type == null && row.text("tipo_documento") == null) {
            type = kind == PersonKind.LEGAL ? DocumentType.CUIT : DocumentType.DNI;
        } else if (number == null && type != null) {
            row.error("numero_documento", "Falta el número de documento.");
        }
        if (number != null && type != null && !type.accepts(DocumentLookup.normalize(number))) {
            row.error("numero_documento", "El número no tiene el formato del tipo de documento.");
        }
        requireNamesOfKind(row, kind, firstNames, lastNames, legalName, birthDate);
        row.throwIfErrors();

        PersonData data = new PersonData(
                kind, firstNames, lastNames, legalName, row.text("alias"), type, number, birthDate,
                row.text("nacionalidad"), row.text("telefono"), row.text("email"), row.text("domicilio"));
        validator.check(row, data, COLUMN_OF_PROPERTY);
        row.throwIfErrors();

        try {
            Person person = people.create(data);
            context.created(ImportContext.RecordType.PERSONS);
            return person.displayName();
        } catch (DuplicateDocumentException e) {
            throw RowException.of("numero_documento", "Ya existe una persona con ese documento.");
        } catch (InvalidPersonDataException e) {
            throw RowException.of(null, "Los datos de la persona no son válidos.", e.getMessage());
        }
    }

    private static void requireNamesOfKind(
            ImportRow row, PersonKind kind, String firstNames, String lastNames, String legalName, LocalDate birthDate) {
        if (kind == PersonKind.HUMAN) {
            if (lastNames == null) {
                row.error("apellidos", "Una persona humana necesita apellidos.");
            }
            if (legalName != null) {
                row.error("razon_social", "Una persona humana no tiene razón social.");
            }
        } else if (kind == PersonKind.LEGAL) {
            if (legalName == null) {
                row.error("razon_social", "Una persona jurídica necesita razón social.");
            }
            if (firstNames != null || lastNames != null || birthDate != null) {
                row.error("tipo_persona", "Una persona jurídica no tiene nombres, apellidos ni fecha de nacimiento.");
            }
        }
    }

    private static Map<String, PersonKind> kinds() {
        Map<String, PersonKind> kinds = new LinkedHashMap<>();
        kinds.put("humana", PersonKind.HUMAN);
        kinds.put("juridica", PersonKind.LEGAL);
        return kinds;
    }
}
