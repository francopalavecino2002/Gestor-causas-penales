package ar.gestorpenal.casefile;

import ar.gestorpenal.customfield.InvalidCustomFieldValueException;
import ar.gestorpenal.dataimport.CatalogMatcher;
import ar.gestorpenal.dataimport.FirmLawyers;
import ar.gestorpenal.dataimport.ImportColumn;
import ar.gestorpenal.dataimport.ImportContext;
import ar.gestorpenal.dataimport.ImportKind;
import ar.gestorpenal.dataimport.ImportRow;
import ar.gestorpenal.dataimport.ImportValidator;
import ar.gestorpenal.dataimport.RowException;
import ar.gestorpenal.dataimport.RowImporter;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.PracticeAreas;
import ar.gestorpenal.jurisdiction.PracticeModule;
import ar.gestorpenal.person.DocumentType;
import ar.gestorpenal.person.InvalidPersonDataException;
import ar.gestorpenal.person.PersonSummary;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.Tenant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Imports cases through {@link CaseService} and {@link DefendantService}, the code behind the case
 * endpoints (ADR-0019). One row is one case and at most one defendant: rows that share the MPF legajo
 * or the internal number are one case with several defendants, and the case columns of a later row
 * must be blank or equal to those of the first. A defendant is found by document; if no person has
 * it and the row gives names, a human is registered.
 *
 * <p>The optional {@code fuero} column names the practice area of the case (default: criminal). The
 * action type, represented side and circumscription are matched against that area's catalogs, and the
 * defendant columns only apply to an area with the {@code defendants} module (ADR-0032).
 */
@Component
class CaseRowImporter implements RowImporter {

    private static final String AREA = "fuero";
    private static final String LEGAJO = "legajo_mpf";
    private static final String INTERNAL_NUMBER = "numero_interno";
    private static final String DEFENDANT_NUMBER = "imputado_numero_documento";
    private static final String DEFENDANT_LAST_NAMES = "imputado_apellidos";
    private static final int MAX_NAME_LENGTH = 120;
    private static final String SAME_AS_FIRST_ROW = "Tiene que estar vacío o ser igual al de la primera fila de este caso.";

    /** The words the templates always used for the criminal catalogs, besides the catalogs' own codes and names. */
    private static final Map<String, String> ACTION_ALIASES = Map.of(
            "publica", "public",
            "instancia_privada", "public-on-complaint",
            "privada", "private");
    private static final Map<String, String> REPRESENTATION_ALIASES = Map.of(
            "defensa", "defence",
            "querella", "private-prosecution");

    private static final Map<String, String> COLUMN_OF_PROPERTY = Map.ofEntries(
            Map.entry("practiceArea", AREA),
            Map.entry("caption", "caratula"),
            Map.entry("internalNumber", INTERNAL_NUMBER),
            Map.entry("mpfLegajo", LEGAJO),
            Map.entry("ofijuNumber", "numero_ofiju"),
            Map.entry("pehuenNumber", "numero_pehuen"),
            Map.entry("circumscriptionCode", "circunscripcion"),
            Map.entry("actionType", "tipo_accion"),
            Map.entry("represents", "representa"),
            Map.entry("chargesFormulatedOn", "imputado_fecha_formalizacion"),
            Map.entry("stageCode", "imputado_etapa"));

    private final CaseService cases;
    private final DefendantService defendants;
    private final Persons persons;
    private final ImportValidator validator;
    private final CatalogMatcher catalogs;
    private final FirmLawyers lawyers;
    private final PracticeAreas areas;

    CaseRowImporter(
            CaseService cases,
            DefendantService defendants,
            Persons persons,
            ImportValidator validator,
            CatalogMatcher catalogs,
            FirmLawyers lawyers,
            PracticeAreas areas) {
        this.cases = cases;
        this.defendants = defendants;
        this.persons = persons;
        this.validator = validator;
        this.catalogs = catalogs;
        this.lawyers = lawyers;
        this.areas = areas;
    }

    @Override
    public ImportKind kind() {
        return ImportKind.CASES;
    }

    @Override
    public List<ImportColumn> columns() {
        return List.of(
                new ImportColumn("caratula", true, "Ficticio, Pedro s/ hurto"),
                new ImportColumn(AREA, false, "penal"),
                new ImportColumn(INTERNAL_NUMBER, false, "INT-0001"),
                new ImportColumn(LEGAJO, false, "MPFNQ 1234/2025"),
                new ImportColumn("numero_ofiju", false, null),
                new ImportColumn("numero_pehuen", false, null),
                new ImportColumn("circunscripcion", true, "i-confluencia"),
                new ImportColumn("tipo_accion", true, "publica"),
                new ImportColumn("representa", true, "defensa"),
                new ImportColumn("abogado_responsable", false, null),
                new ImportColumn("imputado_tipo_documento", false, "DNI"),
                new ImportColumn(DEFENDANT_NUMBER, false, "10000002"),
                new ImportColumn("imputado_nombres", false, "Pedro"),
                new ImportColumn(DEFENDANT_LAST_NAMES, false, "Ficticio"),
                new ImportColumn("imputado_etapa", false, "investigacion-preparatoria"),
                new ImportColumn("imputado_fecha_formalizacion", false, null));
    }

    @Override
    public String importRow(AuthenticatedUser user, ImportRow row, ImportContext context) {
        String internalNumber = row.text(INTERNAL_NUMBER);
        String legajo = legajoOf(row);
        if (legajo == null && internalNumber == null && row.text(LEGAJO) == null) {
            row.error(LEGAJO, "Cada fila necesita legajo_mpf o numero_interno.");
        }
        FileCase known = context.state(FileCases.class, FileCases::new).find(legajo, internalNumber);
        String namedArea = catalogs.practiceArea(row, AREA, context);
        String area = namedArea != null ? namedArea : known != null ? known.data().practiceArea() : Tenant.DEFAULT_PRACTICE_AREA;
        CaseData data = readCase(user, row, context, legajo, internalNumber, area);
        DefendantInput defendant = readDefendant(row, context, area);
        if (known != null) {
            requireSameCase(row, namedArea, known.data(), data);
        } else {
            requireNewCase(row, data);
        }
        row.throwIfErrors();

        UUID caseId = known != null ? known.id() : createCase(user, context, data);
        if (defendant != null) {
            addDefendant(user, caseId, defendant, context);
        }
        if (known == null) {
            // Only a row that fully succeeded lets later rows attach to its case.
            context.state(FileCases.class, FileCases::new).register(caseId, data);
        }
        return legajo != null ? legajo : internalNumber;
    }

    private String legajoOf(ImportRow row) {
        try {
            return MpfLegajo.normalize(row.text(LEGAJO));
        } catch (InvalidCaseDataException e) {
            row.error(LEGAJO, "El legajo MPF tiene que verse como 'MPFNQ 123989/2018'.");
            return null;
        }
    }

    /** The case columns of the row. A continuation row may leave them blank, so required ones are checked later. */
    private CaseData readCase(
            AuthenticatedUser user, ImportRow row, ImportContext context, String legajo, String internalNumber, String area) {
        UUID responsible = lawyers.idOf(row, "abogado_responsable", context);
        return new CaseData(
                row.text("caratula"),
                internalNumber,
                legajo,
                row.text("numero_ofiju"),
                row.text("numero_pehuen"),
                catalogs.code(row, "circunscripcion", area, Catalog.CIRCUMSCRIPTIONS, context),
                catalogs.code(row, "tipo_accion", area, Catalog.ACTION_TYPES, ACTION_ALIASES, context),
                catalogs.code(row, "representa", area, Catalog.REPRESENTED_SIDES, REPRESENTATION_ALIASES, context),
                Boolean.FALSE,
                responsible != null ? responsible : user.userId(),
                null,
                area,
                null,
                null,
                null);
    }

    private void requireNewCase(ImportRow row, CaseData data) {
        row.require("caratula", data.caption());
        row.require("circunscripcion", data.circumscriptionCode());
        row.require("tipo_accion", data.actionType());
        row.require("representa", data.represents());
        boolean complete = data.caption() != null && data.circumscriptionCode() != null
                && data.actionType() != null && data.represents() != null;
        if (complete) {
            validator.check(row, data, COLUMN_OF_PROPERTY);
        }
    }

    private static void requireSameCase(ImportRow row, String namedArea, CaseData first, CaseData later) {
        requireBlankOrEqual(row, AREA, namedArea, first.practiceArea());
        requireBlankOrEqual(row, "caratula", later.caption(), first.caption());
        requireBlankOrEqual(row, INTERNAL_NUMBER, later.internalNumber(), first.internalNumber());
        requireBlankOrEqual(row, LEGAJO, later.mpfLegajo(), first.mpfLegajo());
        requireBlankOrEqual(row, "numero_ofiju", later.ofijuNumber(), first.ofijuNumber());
        requireBlankOrEqual(row, "numero_pehuen", later.pehuenNumber(), first.pehuenNumber());
        requireBlankOrEqual(row, "circunscripcion", later.circumscriptionCode(), first.circumscriptionCode());
        requireBlankOrEqual(row, "tipo_accion", later.actionType(), first.actionType());
        requireBlankOrEqual(row, "representa", later.represents(), first.represents());
        if (row.text("abogado_responsable") != null) {
            requireBlankOrEqual(row, "abogado_responsable", later.responsibleUserId(), first.responsibleUserId());
        }
    }

    private static void requireBlankOrEqual(ImportRow row, String column, Object later, Object first) {
        if (later != null && !Objects.equals(later, first)) {
            row.error(column, SAME_AS_FIRST_ROW);
        }
    }

    private UUID createCase(AuthenticatedUser user, ImportContext context, CaseData data) {
        try {
            UUID id = cases.create(user, data).id();
            context.created(ImportContext.RecordType.CASES);
            return id;
        } catch (DuplicateCaseNumberException e) {
            boolean legajo = e.kind() == DuplicateCaseNumberException.Kind.MPF_LEGAJO;
            throw RowException.of(
                    legajo ? LEGAJO : INTERNAL_NUMBER,
                    legajo ? "Ya existe un caso con ese legajo MPF." : "Ya existe un caso con ese número interno.");
        } catch (InvalidCustomFieldValueException e) {
            throw RowException.of(null, "El estudio tiene campos personalizados obligatorios en los casos, que la importación todavía no completa.",
                    e.getMessage());
        } catch (InvalidCaseDataException | CaseRecordNotFoundException e) {
            throw RowException.of(null, "Los datos del caso no son válidos.", e.getMessage());
        }
    }

    /** The defendant columns of the row, or {@code null} when the row has none. */
    private DefendantInput readDefendant(ImportRow row, ImportContext context, String area) {
        String number = row.text(DEFENDANT_NUMBER);
        String firstNames = row.text("imputado_nombres");
        String lastNames = row.text(DEFENDANT_LAST_NAMES);
        DocumentType type = row.choice("imputado_tipo_documento", DocumentType.words());
        String stage = catalogs.code(row, "imputado_etapa", area, Catalog.STAGES, context);
        LocalDate chargesOn = row.date("imputado_fecha_formalizacion");
        boolean given = number != null || firstNames != null || lastNames != null || stage != null || chargesOn != null
                || row.text("imputado_tipo_documento") != null;
        if (!given) {
            return null;
        }
        if (!areas.hasModule(area, PracticeModule.DEFENDANTS)) {
            row.error(DEFENDANT_NUMBER, "Este fuero no tiene imputados: dejá vacías las columnas imputado_*.");
            return null;
        }
        if (number == null) {
            row.error(DEFENDANT_NUMBER, "Falta el documento del imputado.");
            return null;
        }
        DefendantData data = new DefendantData(
                null, stage, null, null, chargesOn, null, null, null, null, null, null, null);
        validator.check(row, data, COLUMN_OF_PROPERTY);
        Optional<PersonSummary> person = persons.findByDocument(number);
        DocumentType documentType = type == null ? DocumentType.DNI : type;
        if (person.isPresent() && person.get().archived()) {
            row.error(DEFENDANT_NUMBER, "La persona con ese documento está archivada: restauralá antes de agregarla.");
        } else if (person.isEmpty()) {
            checkNewPerson(row, documentType, number, firstNames, lastNames);
        }
        return new DefendantInput(person.orElse(null), documentType, number, firstNames, lastNames, data);
    }

    /** What registering the defendant's person would reject, found before the case is created. */
    private static void checkNewPerson(
            ImportRow row, DocumentType type, String number, String firstNames, String lastNames) {
        if (lastNames == null) {
            row.error(DEFENDANT_LAST_NAMES,
                    "No hay una persona con ese documento: indicá apellidos (y nombres) para registrarla.");
        } else if (lastNames.length() > MAX_NAME_LENGTH) {
            row.error(DEFENDANT_LAST_NAMES, "Tiene que tener como máximo " + MAX_NAME_LENGTH + " caracteres.");
        }
        if (firstNames != null && firstNames.length() > MAX_NAME_LENGTH) {
            row.error("imputado_nombres", "Tiene que tener como máximo " + MAX_NAME_LENGTH + " caracteres.");
        }
        if (!type.acceptsNumber(number)) {
            row.error(DEFENDANT_NUMBER, "El número no tiene el formato del tipo de documento.");
        }
    }

    private void addDefendant(AuthenticatedUser user, UUID caseId, DefendantInput input, ImportContext context) {
        UUID personId = input.person() != null ? input.person().id() : registerPerson(input, context);
        DefendantData data = input.data();
        try {
            defendants.add(user, caseId, new DefendantData(
                    personId, data.stageCode(), null, null, data.chargesFormulatedOn(), null, null, null, null, null, null, null));
            context.created(ImportContext.RecordType.DEFENDANTS);
        } catch (DuplicateRecordException e) {
            throw RowException.of(DEFENDANT_NUMBER, "La persona ya es imputada en este caso.");
        } catch (InvalidCaseDataException | CaseRecordNotFoundException | ArchivedRecordException e) {
            throw RowException.of(DEFENDANT_NUMBER, "No se pudo agregar al imputado al caso.", e.getMessage());
        }
    }

    private UUID registerPerson(DefendantInput input, ImportContext context) {
        try {
            UUID id = persons.registerHuman(input.firstNames(), input.lastNames(), input.type(), input.number()).id();
            context.created(ImportContext.RecordType.PERSONS);
            return id;
        } catch (InvalidPersonDataException e) {
            throw RowException.of(DEFENDANT_NUMBER, "No se pudo registrar a la persona imputada: revisá el documento y los nombres.",
                    e.getMessage());
        }
    }

    /** The defendant of a row: the person if the firm already has it, else the data to register one. */
    private record DefendantInput(
            PersonSummary person, DocumentType type, String number, String firstNames, String lastNames, DefendantData data) {}

    /** The case that an earlier row of this file created, with the data it was created with. */
    private record FileCase(UUID id, CaseData data) {}

    /** The cases of this file by legajo and by internal number, so a later row attaches to its case. */
    private static final class FileCases {

        private final Map<String, FileCase> byLegajo = new HashMap<>();
        private final Map<String, FileCase> byInternalNumber = new HashMap<>();

        FileCase find(String legajo, String internalNumber) {
            FileCase found = legajo == null ? null : byLegajo.get(legajo);
            return found == null && internalNumber != null ? byInternalNumber.get(internalNumber) : found;
        }

        void register(UUID id, CaseData data) {
            FileCase created = new FileCase(id, data);
            if (data.mpfLegajo() != null) {
                byLegajo.put(data.mpfLegajo(), created);
            }
            if (data.internalNumber() != null) {
                byInternalNumber.put(data.internalNumber(), created);
            }
        }
    }
}
