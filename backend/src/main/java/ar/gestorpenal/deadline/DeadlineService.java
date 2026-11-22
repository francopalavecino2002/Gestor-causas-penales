package ar.gestorpenal.deadline;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.hearing.Hearings;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Concrete deadlines of the current firm's cases (ADR-0017). A deadline is reached through its case,
 * so another firm's record, or one of a reserved case the user cannot see, is "not found". Whoever
 * sees the case loads and edits its deadlines; only the owner and lawyers archive or restore them.
 */
@Service
class DeadlineService {

    static final int DEFAULT_WITHIN_DAYS = 30;
    static final int MAX_WITHIN_DAYS = 365;

    private final DeadlineRepository deadlines;
    private final DeadlineExtensionRepository extensions;
    private final DeadlineViews views;
    private final FirmRules firmRules;
    private final DeadlineClock clock;
    private final Cases cases;
    private final Hearings hearings;

    DeadlineService(
            DeadlineRepository deadlines,
            DeadlineExtensionRepository extensions,
            DeadlineViews views,
            FirmRules firmRules,
            DeadlineClock clock,
            Cases cases,
            Hearings hearings) {
        this.deadlines = deadlines;
        this.extensions = extensions;
        this.views = views;
        this.firmRules = firmRules;
        this.clock = clock;
        this.cases = cases;
        this.hearings = hearings;
    }

    @Transactional
    DeadlineView create(AuthenticatedUser user, UUID caseId, DeadlineData data) {
        editableCase(user, caseId);
        FirmRules.Snapshot firm = firmRules.current();
        DeadlineRule rule = firm.deadlinePackage().rule(Text.clean(data.ruleCode()))
                .orElseThrow(() -> new InvalidDeadlineDataException("There is no deadline rule '" + data.ruleCode() + "'"));
        if (!firm.enabled(rule)) {
            throw new DeadlineStateException("The rule " + rule.code() + " is disabled in this firm");
        }
        requireDefendantForScope(rule, caseId, data.defendantId());
        requireHearingOfCase(data.hearingId(), caseId);
        Deadline deadline = deadlines.saveAndFlush(
                Deadline.create(caseId, data.defendantId(), rule, data, DeadlineClock.ZONE, clock.today()));
        return views.of(user, deadline);
    }

    @Transactional(readOnly = true)
    List<DeadlineView> listByCase(AuthenticatedUser user, UUID caseId, boolean includeArchived) {
        visibleCase(user, caseId);
        return views.of(user, includeArchived ? deadlines.findByCaseId(caseId) : deadlines.findByCaseIdAndArchivedAtIsNull(caseId));
    }

    @Transactional(readOnly = true)
    DeadlineView get(AuthenticatedUser user, UUID id) {
        return views.of(user, find(user, id));
    }

    /**
     * The deadlines that need attention across the visible cases: overdue, due within
     * {@code withinDays} (1 to 365), or not calculable. Met, suspended and archived deadlines, and those
     * of a disabled rule, are left out. Detainee deadlines first.
     */
    @Transactional(readOnly = true)
    List<DeadlineView> upcoming(AuthenticatedUser user, int withinDays) {
        if (withinDays < 1 || withinDays > MAX_WITHIN_DAYS) {
            throw new InvalidDeadlineDataException("withinDays must be between 1 and " + MAX_WITHIN_DAYS);
        }
        Instant horizon = clock.now().plus(withinDays, ChronoUnit.DAYS);
        return views.of(user, deadlines.findRunningVisible(cases.seesEveryCase(user), user.userId())).stream()
                .filter(view -> view.rule().enabled())
                .filter(view -> switch (view.status()) {
                    case OVERDUE, DUE_SOON, NOT_CALCULABLE -> true;
                    case RUNNING -> !view.dueAt().isAfter(horizon);
                    case MET, SUSPENDED -> false;
                })
                .toList();
    }

    /** Replaces the dates, hearing, met day and notes. The rule and the defendant cannot change. */
    @Transactional
    DeadlineView update(AuthenticatedUser user, UUID id, DeadlineData data) {
        Deadline deadline = findEditable(user, id);
        if (!deadline.getRuleCode().equals(Text.clean(data.ruleCode()))) {
            throw new InvalidDeadlineDataException("The rule of a deadline cannot change: archive it and load a new one");
        }
        if (!Objects.equals(deadline.getDefendantId(), data.defendantId())) {
            throw new InvalidDeadlineDataException("The defendant of a deadline cannot change: archive it and load a new one");
        }
        requireHearingOfCase(data.hearingId(), deadline.getCaseId());
        deadline.apply(firmRules.current().rule(deadline.getRuleCode()), data, DeadlineClock.ZONE, clock.today());
        boolean extendedBeforeStart = activeExtensions(id).stream()
                .anyMatch(extension -> extension.getGrantedOn().isBefore(deadline.getTriggeredOn()));
        if (extendedBeforeStart) {
            throw new InvalidDeadlineDataException(
                    "The deadline cannot start after one of its extensions was granted: archive the extension first");
        }
        deadlines.flush();
        return views.of(user, deadline);
    }

    private List<DeadlineExtension> activeExtensions(UUID deadlineId) {
        return extensions.findByDeadlineIdInAndArchivedAtIsNullOrderByGrantedOnAscCreatedAtAscIdAsc(List.of(deadlineId));
    }

    /**
     * Adds an extension within the rule's limits: no more than the extensions the law allows, and each
     * no longer than its step's maximum.
     */
    @Transactional
    DeadlineView extend(AuthenticatedUser user, UUID id, ExtensionData data) {
        Deadline deadline = findEditable(user, id);
        DeadlineRule rule = firmRules.current().rule(deadline.getRuleCode());
        List<DeadlineExtension> chain = activeExtensions(id);
        int granted = chain.size();
        if (granted >= rule.extensions().size()) {
            throw new DeadlineStateException(rule.extensions().isEmpty()
                    ? "The rule " + rule.code() + " allows no extension"
                    : "The rule " + rule.code() + " allows only " + rule.extensions().size() + " extension(s)");
        }
        DeadlineRule.ExtensionStep step = rule.extensions().get(granted);
        if (data.amount() > step.maxAmount()) {
            throw new InvalidDeadlineDataException("This extension (" + step.grantedBy() + ") is at most "
                    + step.maxAmount() + " " + unitOf(rule.computation()));
        }
        if (data.grantedOn().isBefore(deadline.getTriggeredOn()) || data.grantedOn().isAfter(clock.today())) {
            throw new InvalidDeadlineDataException("An extension is granted between the day the deadline started and today");
        }
        // Extensions are chained: a later step cannot be granted before an earlier one.
        if (!chain.isEmpty() && data.grantedOn().isBefore(chain.get(chain.size() - 1).getGrantedOn())) {
            throw new InvalidDeadlineDataException("An extension cannot be granted before the previous one");
        }
        requireHearingOfCase(data.grantedByHearingId(), deadline.getCaseId());
        extensions.saveAndFlush(DeadlineExtension.create(id, data));
        return views.of(user, deadline);
    }

    /**
     * A mistaken extension is archived, never deleted. Only the last one of the chain: archiving an
     * earlier one would move the later ones to a step whose maximum they were never checked against.
     */
    @Transactional
    DeadlineView archiveExtension(AuthenticatedUser user, UUID extensionId) {
        DeadlineExtension extension = extensions.findById(extensionId)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no extension " + extensionId));
        Deadline deadline = findEditable(user, extension.getDeadlineId());
        cases.requireCanArchive(user);
        if (extension.isArchived()) {
            throw new ArchivedDeadlineRecordException("The extension is already archived");
        }
        List<DeadlineExtension> chain = activeExtensions(deadline.getId());
        if (!chain.get(chain.size() - 1).getId().equals(extensionId)) {
            throw new DeadlineStateException("Only the last extension can be archived: archive the later ones first");
        }
        extension.archive();
        extensions.flush();
        return views.of(user, deadline);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        Deadline deadline = find(user, id);
        cases.requireCanArchive(user);
        deadline.archive();
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        Deadline deadline = find(user, id);
        cases.requireCanArchive(user);
        editableCase(user, deadline.getCaseId());
        if (deadline.getDefendantId() != null) {
            editableDefendant(deadline.getDefendantId());
        }
        deadline.restore();
    }

    private void requireDefendantForScope(DeadlineRule rule, UUID caseId, UUID defendantId) {
        if (rule.scope() == RuleScope.CASE) {
            if (defendantId != null) {
                throw new InvalidDeadlineDataException("The rule " + rule.code() + " runs for the whole case: send no defendant");
            }
            return;
        }
        if (defendantId == null) {
            throw new InvalidDeadlineDataException("The rule " + rule.code() + " runs for each defendant: send defendantId");
        }
        DefendantRef defendant = editableDefendant(defendantId);
        if (!defendant.caseId().equals(caseId)) {
            throw new InvalidDeadlineDataException("The defendant is not in this case");
        }
    }

    /** A defendant of the firm that is not archived (its case was already checked). */
    private DefendantRef editableDefendant(UUID defendantId) {
        DefendantRef defendant = cases.findDefendants(Set.of(defendantId)).get(defendantId);
        if (defendant == null) {
            throw new DeadlineNotFoundException("There is no defendant " + defendantId);
        }
        if (defendant.archived()) {
            throw new ArchivedDeadlineRecordException("The defendant is archived: restore it first");
        }
        return defendant;
    }

    /** The hearing must exist in the firm (else not found) and belong to the case. */
    private void requireHearingOfCase(UUID hearingId, UUID caseId) {
        if (hearingId == null) {
            return;
        }
        UUID hearingCase = hearings.caseOf(hearingId)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no hearing " + hearingId));
        if (!hearingCase.equals(caseId)) {
            throw new InvalidDeadlineDataException("The hearing is not in the deadline's case");
        }
    }

    private CaseRef visibleCase(AuthenticatedUser user, UUID caseId) {
        return cases.findVisible(user, caseId)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no case " + caseId));
    }

    private CaseRef editableCase(AuthenticatedUser user, UUID caseId) {
        CaseRef caseRef = visibleCase(user, caseId);
        if (caseRef.archived()) {
            throw new ArchivedDeadlineRecordException("The case is archived: restore it before changing its deadlines");
        }
        return caseRef;
    }

    private Deadline find(AuthenticatedUser user, UUID id) {
        Deadline deadline = deadlines.findById(id)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no deadline " + id));
        visibleCase(user, deadline.getCaseId());
        return deadline;
    }

    private Deadline findEditable(AuthenticatedUser user, UUID id) {
        Deadline deadline = find(user, id);
        editableCase(user, deadline.getCaseId());
        if (deadline.isArchived()) {
            throw new ArchivedDeadlineRecordException("The deadline is archived: restore it before changing it");
        }
        if (deadline.getDefendantId() != null) {
            editableDefendant(deadline.getDefendantId());
        }
        return deadline;
    }

    private static String unitOf(Computation computation) {
        return switch (computation) {
            case HOURS -> "hours";
            case BUSINESS_DAYS -> "business days";
            case CALENDAR_DAYS -> "calendar days";
            case MONTHS -> "months";
            case YEARS -> "years";
            case SET_BY_COURT -> "days";
        };
    }
}
