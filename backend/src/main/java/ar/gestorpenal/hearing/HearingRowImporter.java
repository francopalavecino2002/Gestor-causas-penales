package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
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
import ar.gestorpenal.person.PersonSummary;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Imports hearings through {@link HearingService}, the code behind {@code POST /cases/{id}/hearings}
 * (ADR-0019). Each row names its case by MPF legajo or internal number; the case must exist, be
 * visible to the importing user and not be archived. The date and time are in the firm's zone.
 * Clashes with other hearings are not errors: the agenda shows them.
 */
@Component
class HearingRowImporter implements RowImporter {

    private static final String LEGAJO = "legajo_mpf";
    private static final String INTERNAL_NUMBER = "numero_interno";
    private static final String DEFENDANTS = "imputados";
    private static final String LAWYERS = "abogados";
    private static final DateTimeFormatter LABEL_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final Map<String, String> COLUMN_OF_PROPERTY = Map.of(
            "typeCode", "tipo_audiencia",
            "startsAt", "fecha",
            "durationMinutes", "duracion_minutos",
            "room", "sala",
            "judge", "juez",
            "ofijuReference", "referencia_ofiju",
            "statusCode", "estado");

    private final HearingService hearings;
    private final Cases cases;
    private final Persons persons;
    private final ImportValidator validator;
    private final CatalogMatcher catalogs;
    private final FirmLawyers lawyers;

    HearingRowImporter(
            HearingService hearings,
            Cases cases,
            Persons persons,
            ImportValidator validator,
            CatalogMatcher catalogs,
            FirmLawyers lawyers) {
        this.hearings = hearings;
        this.cases = cases;
        this.persons = persons;
        this.validator = validator;
        this.catalogs = catalogs;
        this.lawyers = lawyers;
    }

    @Override
    public ImportKind kind() {
        return ImportKind.HEARINGS;
    }

    @Override
    public List<ImportColumn> columns() {
        return List.of(
                new ImportColumn(LEGAJO, false, "MPFNQ 1234/2025"),
                new ImportColumn(INTERNAL_NUMBER, false, null),
                new ImportColumn("tipo_audiencia", true, "formulacion-de-cargos"),
                new ImportColumn("fecha", true, "15/03/2035"),
                new ImportColumn("hora", true, "09:30"),
                new ImportColumn("duracion_minutos", false, "60"),
                new ImportColumn("sala", false, "Sala 3"),
                new ImportColumn("juez", false, "Juez Ficticio"),
                new ImportColumn("referencia_ofiju", false, null),
                new ImportColumn("estado", false, "programada"),
                new ImportColumn(LAWYERS, false, null),
                new ImportColumn(DEFENDANTS, false, "10000002"));
    }

    @Override
    public String importRow(AuthenticatedUser user, ImportRow row, ImportContext context) {
        String legajo = row.text(LEGAJO);
        String internalNumber = row.text(INTERNAL_NUMBER);
        if (legajo == null && internalNumber == null) {
            row.error(LEGAJO, "Cada fila necesita legajo_mpf o numero_interno.");
        }
        String type = row.require("tipo_audiencia", catalogs.code(row, "tipo_audiencia", Catalog.HEARING_TYPES, context));
        LocalDate day = row.require("fecha", row.date("fecha"));
        LocalTime time = row.require("hora", row.time("hora"));
        String status = catalogs.code(row, "estado", Catalog.HEARING_STATUSES, context);
        Integer minutes = row.integer("duracion_minutos");
        List<UUID> lawyerIds = lawyerIds(row, context);
        row.throwIfErrors();

        CaseRef caseRef = visibleCase(user, legajo, internalNumber);
        List<UUID> defendantIds = defendantIds(row, caseRef.id());
        row.throwIfErrors();

        LocalDateTime start = LocalDateTime.of(day, time);
        HearingData data = new HearingData(
                type, start.atZone(HearingCalendar.ZONE).toInstant(), minutes, row.text("sala"), row.text("juez"),
                row.text("referencia_ofiju"), null, status, null, null, null, null,
                defendantIds.isEmpty() ? null : defendantIds, lawyerIds.isEmpty() ? null : lawyerIds);
        validator.check(row, data, COLUMN_OF_PROPERTY);
        row.throwIfErrors();

        try {
            hearings.create(user, caseRef.id(), data);
            context.created(ImportContext.RecordType.HEARINGS);
            return (legajo != null ? legajo : internalNumber) + " " + LABEL_FORMAT.format(start);
        } catch (InvalidHearingDataException | HearingStateException e) {
            throw RowException.of(null, "Los datos de la audiencia no son válidos.", e.getMessage());
        } catch (HearingNotFoundException | ArchivedHearingRecordException e) {
            throw RowException.of(null, "No se pudo crear la audiencia en ese caso.", e.getMessage());
        }
    }

    private List<UUID> lawyerIds(ImportRow row, ImportContext context) {
        List<UUID> ids = new ArrayList<>();
        for (String email : row.list(LAWYERS)) {
            UUID id = lawyers.idOf(row, LAWYERS, email, context);
            if (id != null && !ids.contains(id)) {
                ids.add(id);
            }
        }
        return ids;
    }

    /** The case the row names; it must be visible to the user, so a case of another firm "does not exist". */
    private CaseRef visibleCase(AuthenticatedUser user, String legajo, String internalNumber) {
        String column = legajo != null ? LEGAJO : INTERNAL_NUMBER;
        CaseRef caseRef = cases.findVisibleByNumber(user, legajo, internalNumber)
                .orElseThrow(() -> RowException.of(column, "No existe un caso con ese número."));
        if (legajo != null && internalNumber != null) {
            boolean sameCase = cases.findVisibleByNumber(user, null, internalNumber)
                    .filter(other -> other.id().equals(caseRef.id()))
                    .isPresent();
            if (!sameCase) {
                throw RowException.of(INTERNAL_NUMBER, "No coincide con el caso del legajo MPF.");
            }
        }
        if (caseRef.archived()) {
            throw RowException.of(column, "El caso está archivado: restauralo antes de cargarle audiencias.");
        }
        return caseRef;
    }

    /** The defendants of the case named by the document numbers of the cell. */
    private List<UUID> defendantIds(ImportRow row, UUID caseId) {
        List<String> numbers = row.list(DEFENDANTS);
        if (numbers.isEmpty()) {
            return List.of();
        }
        Map<UUID, UUID> defendantByPerson = cases.activeDefendantsOf(caseId).stream()
                .collect(Collectors.toMap(DefendantRef::personId, DefendantRef::id));
        List<UUID> ids = new ArrayList<>();
        for (String number : numbers) {
            Optional<UUID> id = persons.findByDocument(number)
                    .map(PersonSummary::id)
                    .map(defendantByPerson::get);
            if (id.isEmpty()) {
                row.error(DEFENDANTS, "Hay un documento que no es de un imputado de este caso.");
            } else if (!ids.contains(id.get())) {
                ids.add(id.get());
            }
        }
        return ids;
    }
}
