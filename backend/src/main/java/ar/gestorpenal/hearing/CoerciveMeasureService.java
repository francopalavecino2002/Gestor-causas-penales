package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogItem;
import ar.gestorpenal.security.AuthenticatedUser;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coercive measures of the defendants of the current firm (ADR-0016). A measure is reached through
 * its defendant and case, so another firm's record, or a reserved case the user cannot see, is "not
 * found". Catalog codes are checked before the entity is changed.
 */
@Service
class CoerciveMeasureService {

    private final CoerciveMeasureRepository measures;
    private final CoerciveMeasureRiskRepository risks;
    private final HearingRepository hearings;
    private final HearingCatalogs catalogs;
    private final HearingCalendar calendar;
    private final Cases cases;

    CoerciveMeasureService(
            CoerciveMeasureRepository measures,
            CoerciveMeasureRiskRepository risks,
            HearingRepository hearings,
            HearingCatalogs catalogs,
            HearingCalendar calendar,
            Cases cases) {
        this.measures = measures;
        this.risks = risks;
        this.hearings = hearings;
        this.catalogs = catalogs;
        this.calendar = calendar;
        this.cases = cases;
    }

    @Transactional
    CoerciveMeasureView create(AuthenticatedUser user, UUID defendantId, CoerciveMeasureData data) {
        DefendantRef defendant = findEditableDefendant(user, defendantId);
        CaseRef caseRef = visibleCase(user, defendant.caseId());
        requireCatalogCodes(data, null);
        requirePreventivePrisonAllowed(caseRef, data.measureCode(), null);
        requireHearingOfCase(data.orderedByHearingId(), defendant.caseId());
        CoerciveMeasure measure = measures.saveAndFlush(CoerciveMeasure.create(defendantId, data));
        addRisks(measure.getId(), data.risks());
        measures.flush();
        return view(measure);
    }

    @Transactional(readOnly = true)
    List<CoerciveMeasureView> listByDefendant(AuthenticatedUser user, UUID defendantId, boolean includeArchived) {
        findDefendant(user, defendantId);
        List<CoerciveMeasure> found = includeArchived
                ? measures.findByDefendantIdOrderByStartsOnDescIdAsc(defendantId)
                : measures.findByDefendantIdAndArchivedAtIsNullOrderByStartsOnDescIdAsc(defendantId);
        return views(found);
    }

    /** Replaces the editable fields. Preventive prison is only checked against the case when it is new. */
    @Transactional
    CoerciveMeasureView update(AuthenticatedUser user, UUID id, CoerciveMeasureData data) {
        CoerciveMeasure measure = findEditable(user, id);
        DefendantRef defendant = findDefendant(user, measure.getDefendantId());
        requireCatalogCodes(data, measure);
        requirePreventivePrisonAllowed(visibleCase(user, defendant.caseId()), data.measureCode(), measure.getMeasureCode());
        requireHearingOfCase(data.orderedByHearingId(), defendant.caseId());
        measure.apply(data);
        replaceRisks(id, data.risks());
        measures.flush();
        return view(measure);
    }

    /** Ends the measure (cese) on a day that is neither before it started nor in the future. */
    @Transactional
    CoerciveMeasureView lift(AuthenticatedUser user, UUID id, LiftData data) {
        CoerciveMeasure measure = findEditable(user, id);
        measure.lift(data.liftedOn(), calendar.today());
        measures.flush();
        return view(measure);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        CoerciveMeasure measure = find(user, id);
        cases.requireCanArchive(user);
        measure.archive();
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        CoerciveMeasure measure = find(user, id);
        cases.requireCanArchive(user);
        findEditableDefendant(user, measure.getDefendantId());
        measure.restore();
    }

    private void requireCatalogCodes(CoerciveMeasureData data, CoerciveMeasure current) {
        String code = Text.clean(data.measureCode());
        catalogs.requireOffered(Catalog.COERCIVE_MEASURES, code, current == null ? null : current.getMeasureCode());
        Set<String> currentRisks = current == null ? Set.of() : riskCodesOf(current.getId());
        for (String risk : data.risks()) {
            catalogs.requireOffered(Catalog.PROCEDURAL_RISKS, risk, currentRisks.contains(risk) ? risk : null);
        }
    }

    /** Preventive prison does not proceed in a private-action case (art. 115). */
    private static void requirePreventivePrisonAllowed(CaseRef caseRef, String measureCode, String currentCode) {
        String code = Text.clean(measureCode);
        if (CustodialMeasures.PREVENTIVE_PRISON.equals(code)
                && !code.equals(currentCode)
                && caseRef.privateAction()) {
            throw new InvalidHearingDataException(
                    "Preventive prison does not proceed in a case of private action (art. 115)");
        }
    }

    /** The ordering hearing must exist in the firm (else not found) and belong to the defendant's case. */
    private void requireHearingOfCase(UUID hearingId, UUID caseId) {
        if (hearingId == null) {
            return;
        }
        Hearing hearing = hearings.findById(hearingId)
                .orElseThrow(() -> new HearingNotFoundException("There is no hearing " + hearingId));
        if (!hearing.getCaseId().equals(caseId)) {
            throw new InvalidHearingDataException("The ordering hearing is not in the defendant's case");
        }
    }

    private void addRisks(UUID measureId, List<String> codes) {
        codes.forEach(code -> risks.save(CoerciveMeasureRisk.create(measureId, code)));
    }

    /** Removed risks are archived and new ones added, so the history stays in the table. */
    private void replaceRisks(UUID measureId, List<String> wanted) {
        List<CoerciveMeasureRisk> current = risks.findByMeasureIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(measureId);
        current.stream().filter(row -> !wanted.contains(row.getRiskCode())).forEach(CoerciveMeasureRisk::archive);
        Set<String> kept = current.stream().map(CoerciveMeasureRisk::getRiskCode).collect(Collectors.toSet());
        addRisks(measureId, wanted.stream().filter(code -> !kept.contains(code)).toList());
    }

    private Set<String> riskCodesOf(UUID measureId) {
        return risks.findByMeasureIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(measureId).stream()
                .map(CoerciveMeasureRisk::getRiskCode)
                .collect(Collectors.toSet());
    }

    private DefendantRef findDefendant(AuthenticatedUser user, UUID defendantId) {
        DefendantRef defendant = cases.findDefendants(Set.of(defendantId)).get(defendantId);
        if (defendant == null) {
            throw new HearingNotFoundException("There is no defendant " + defendantId);
        }
        visibleCase(user, defendant.caseId());
        return defendant;
    }

    /** A visible defendant, not archived, of a case that is not archived. */
    private DefendantRef findEditableDefendant(AuthenticatedUser user, UUID defendantId) {
        DefendantRef defendant = findDefendant(user, defendantId);
        if (visibleCase(user, defendant.caseId()).archived()) {
            throw new ArchivedHearingRecordException("The case is archived: restore it before changing its measures");
        }
        if (defendant.archived()) {
            throw new ArchivedHearingRecordException("The defendant is archived: restore it first");
        }
        return defendant;
    }

    private CaseRef visibleCase(AuthenticatedUser user, UUID caseId) {
        return cases.findVisible(user, caseId)
                .orElseThrow(() -> new HearingNotFoundException("There is no case " + caseId));
    }

    private CoerciveMeasure find(AuthenticatedUser user, UUID id) {
        CoerciveMeasure measure = measures.findById(id)
                .orElseThrow(() -> new HearingNotFoundException("There is no coercive measure " + id));
        findDefendant(user, measure.getDefendantId());
        return measure;
    }

    private CoerciveMeasure findEditable(AuthenticatedUser user, UUID id) {
        CoerciveMeasure measure = find(user, id);
        findEditableDefendant(user, measure.getDefendantId());
        if (measure.isArchived()) {
            throw new ArchivedHearingRecordException("The measure is archived: restore it before changing it");
        }
        return measure;
    }

    private CoerciveMeasureView view(CoerciveMeasure measure) {
        return views(List.of(measure)).get(0);
    }

    private List<CoerciveMeasureView> views(List<CoerciveMeasure> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<CoerciveMeasureRisk>> risksByMeasure = risks
                .findByMeasureIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(
                        rows.stream().map(CoerciveMeasure::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(CoerciveMeasureRisk::getMeasureId));
        Map<String, CatalogItem> measureItems = catalogs.items(Catalog.COERCIVE_MEASURES);
        Map<String, String> riskNames = catalogs.names(Catalog.PROCEDURAL_RISKS);
        // Risks are shown in catalog order (art. 114): rows saved in the same instant have no stable order.
        List<String> riskOrder = List.copyOf(riskNames.keySet());
        Comparator<CoerciveMeasureRisk> byCatalogOrder = Comparator.comparingInt(
                risk -> riskOrder.contains(risk.getRiskCode()) ? riskOrder.indexOf(risk.getRiskCode()) : Integer.MAX_VALUE);
        return rows.stream()
                .map(measure -> {
                    CatalogItem item = measureItems.get(measure.getMeasureCode());
                    return new CoerciveMeasureView(
                            measure.getId(),
                            measure.getDefendantId(),
                            measure.getMeasureCode(),
                            item == null ? measure.getMeasureCode() : item.name(),
                            item == null ? null : item.article(),
                            measure.getConditions(),
                            measure.getDetentionPlace(),
                            risksByMeasure.getOrDefault(measure.getId(), List.of()).stream()
                                    .sorted(byCatalogOrder.thenComparing(CoerciveMeasureRisk::getRiskCode))
                                    .map(risk -> new CodeName(
                                            risk.getRiskCode(), riskNames.getOrDefault(risk.getRiskCode(), risk.getRiskCode())))
                                    .toList(),
                            measure.getStartsOn(),
                            measure.getEndsOn(),
                            measure.getNextReviewOn(),
                            measure.getOrderedByHearingId(),
                            measure.getLiftedOn(),
                            measure.isActive(),
                            measure.isArchived(),
                            measure.getCreatedAt());
                })
                .toList();
    }
}
