package ar.gestorpenal.hearing;

import ar.gestorpenal.jurisdiction.Catalog;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point to hearings for other features (deadlines, tasks), like {@code Cases}
 * for cases. It only sees the current firm's rows (ADR-0007).
 */
@Service
public class Hearings {

    private final HearingRepository hearings;
    private final HearingCatalogs catalogs;

    Hearings(HearingRepository hearings, HearingCatalogs catalogs) {
        this.hearings = hearings;
        this.catalogs = catalogs;
    }

    /** The case of the hearing, archived or not, or empty when the firm has no such hearing. */
    @Transactional(readOnly = true)
    public Optional<UUID> caseOf(UUID hearingId) {
        return hearings.findById(hearingId).map(Hearing::getCaseId);
    }

    /** The hearings (archived ones too) that exist in the firm, by id. */
    @Transactional(readOnly = true)
    public Map<UUID, HearingRef> findAll(Collection<UUID> hearingIds) {
        if (hearingIds.isEmpty()) {
            return Map.of();
        }
        return hearings.findAllById(hearingIds).stream()
                .map(hearing -> new HearingRef(
                        hearing.getId(),
                        hearing.getCaseId(),
                        hearing.getTypeCode(),
                        hearing.getStartsAt(),
                        hearing.isArchived()))
                .collect(Collectors.toMap(HearingRef::id, Function.identity()));
    }

    /** The name of every hearing type of the practice area by code (hidden ones too). */
    @Transactional(readOnly = true)
    public Map<String, String> typeNames(String practiceArea) {
        return catalogs.names(practiceArea, Catalog.HEARING_TYPES);
    }

    /** The name of every hearing status of the practice area by code (hidden ones too). */
    @Transactional(readOnly = true)
    public Map<String, String> statusNames(String practiceArea) {
        return catalogs.names(practiceArea, Catalog.HEARING_STATUSES);
    }

    /** The status codes that record how a held hearing ended (held, reconverted, recess). */
    public Set<String> resultStatuses() {
        return HearingRules.WITH_RESULT;
    }
}
