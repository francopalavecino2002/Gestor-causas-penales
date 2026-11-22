package ar.gestorpenal.deadline;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.security.AuthenticatedUser;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Suspensions loaded on a case: penal mediation and the federal extraordinary appeal (ADR-0017). Same
 * access rules as deadlines: whoever sees the case loads and edits them; only the owner and lawyers
 * archive or restore them.
 */
@Service
class DeadlineSuspensionService {

    private final DeadlineSuspensionRepository suspensions;
    private final Cases cases;

    DeadlineSuspensionService(DeadlineSuspensionRepository suspensions, Cases cases) {
        this.suspensions = suspensions;
        this.cases = cases;
    }

    @Transactional
    SuspensionView create(AuthenticatedUser user, UUID caseId, SuspensionData data) {
        editableCase(user, caseId);
        requireDefendantOfCase(data.defendantId(), caseId, null);
        return view(suspensions.saveAndFlush(DeadlineSuspension.create(caseId, data)));
    }

    @Transactional(readOnly = true)
    List<SuspensionView> listByCase(AuthenticatedUser user, UUID caseId, boolean includeArchived) {
        visibleCase(user, caseId);
        List<DeadlineSuspension> found = includeArchived
                ? suspensions.findByCaseIdOrderByStartsOnAscIdAsc(caseId)
                : suspensions.findByCaseIdAndArchivedAtIsNullOrderByStartsOnAscIdAsc(caseId);
        return views(found);
    }

    /** Replaces the kind, defendant, dates and notes; closing an open suspension is setting {@code endsOn}. */
    @Transactional
    SuspensionView update(AuthenticatedUser user, UUID id, SuspensionData data) {
        DeadlineSuspension suspension = find(user, id);
        editableCase(user, suspension.getCaseId());
        if (suspension.isArchived()) {
            throw new ArchivedDeadlineRecordException("The suspension is archived: restore it before changing it");
        }
        requireDefendantOfCase(data.defendantId(), suspension.getCaseId(), suspension.getDefendantId());
        suspension.apply(data);
        suspensions.flush();
        return view(suspension);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        DeadlineSuspension suspension = find(user, id);
        cases.requireCanArchive(user);
        suspension.archive();
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        DeadlineSuspension suspension = find(user, id);
        cases.requireCanArchive(user);
        editableCase(user, suspension.getCaseId());
        suspension.restore();
    }

    /**
     * The defendant must be of the case (another firm's id is not found). A new defendant must not be
     * archived; the one the suspension already has is kept even if archived since.
     */
    private void requireDefendantOfCase(UUID defendantId, UUID caseId, UUID currentDefendantId) {
        if (defendantId == null) {
            return;
        }
        DefendantRef defendant = cases.findDefendants(Set.of(defendantId)).get(defendantId);
        if (defendant == null) {
            throw new DeadlineNotFoundException("There is no defendant " + defendantId);
        }
        if (!defendant.caseId().equals(caseId)) {
            throw new InvalidDeadlineDataException("The defendant is not in this case");
        }
        if (defendant.archived() && !Objects.equals(defendantId, currentDefendantId)) {
            throw new ArchivedDeadlineRecordException("The defendant is archived: restore it first");
        }
    }

    private CaseRef visibleCase(AuthenticatedUser user, UUID caseId) {
        return cases.findVisible(user, caseId)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no case " + caseId));
    }

    private void editableCase(AuthenticatedUser user, UUID caseId) {
        if (visibleCase(user, caseId).archived()) {
            throw new ArchivedDeadlineRecordException("The case is archived: restore it before changing its suspensions");
        }
    }

    private DeadlineSuspension find(AuthenticatedUser user, UUID id) {
        DeadlineSuspension suspension = suspensions.findById(id)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no suspension " + id));
        visibleCase(user, suspension.getCaseId());
        return suspension;
    }

    private SuspensionView view(DeadlineSuspension suspension) {
        return views(List.of(suspension)).get(0);
    }

    private List<SuspensionView> views(List<DeadlineSuspension> rows) {
        Map<UUID, DefendantRef> defendants = cases.findDefendants(
                rows.stream().map(DeadlineSuspension::getDefendantId).filter(Objects::nonNull).distinct().toList());
        return rows.stream()
                .map(row -> new SuspensionView(
                        row.getId(),
                        row.getCaseId(),
                        row.getDefendantId(),
                        row.getDefendantId() == null ? null : defendants.get(row.getDefendantId()).displayName(),
                        row.getKind(),
                        row.getStartsOn(),
                        row.getEndsOn(),
                        row.getEndsOn() == null,
                        row.getNotes(),
                        row.isArchived(),
                        row.getCreatedAt()))
                .toList();
    }
}
