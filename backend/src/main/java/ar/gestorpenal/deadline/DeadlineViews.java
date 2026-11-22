package ar.gestorpenal.deadline;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.deadline.DeadlineCalculator.Input;
import ar.gestorpenal.deadline.DeadlineCalculator.Result;
import ar.gestorpenal.deadline.DeadlineCalculator.Suspension;
import ar.gestorpenal.deadline.DeadlineView.ExtensionView;
import ar.gestorpenal.deadline.DeadlineView.RuleRef;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Turns stored deadlines into views with their due date (ADR-0017). Loads everything the computation
 * needs in a few queries (rules, settings, extensions, suspensions, defendants, cases) and then runs
 * {@link DeadlineCalculator} in memory: a firm of 1 to 5 lawyers has hundreds of deadlines, not millions.
 */
@Component
class DeadlineViews {

    /** Shown with every due date (CLAUDE.md, rule 6): the system assists, the lawyer controls. */
    static final String DISCLAIMER = "Cálculo asistido: verificá con la norma.";

    /**
     * Met deadlines last; then detainee deadlines; then the soonest due date, those without one
     * (suspended, not calculable) at the end.
     */
    static final Comparator<DeadlineView> MOST_URGENT_FIRST = Comparator
            .comparing((DeadlineView view) -> view.status() == DeadlineStatus.MET)
            .thenComparing(view -> !view.rule().detainee())
            .thenComparing(DeadlineView::dueAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(DeadlineView::id);

    private final FirmRules firmRules;
    private final DeadlineExtensionRepository extensions;
    private final DeadlineSuspensionRepository suspensions;
    private final DeadlineClock clock;
    private final Cases cases;

    DeadlineViews(
            FirmRules firmRules,
            DeadlineExtensionRepository extensions,
            DeadlineSuspensionRepository suspensions,
            DeadlineClock clock,
            Cases cases) {
        this.firmRules = firmRules;
        this.extensions = extensions;
        this.suspensions = suspensions;
        this.clock = clock;
        this.cases = cases;
    }

    DeadlineView of(AuthenticatedUser user, Deadline deadline) {
        return of(user, List.of(deadline)).get(0);
    }

    /** The views, most urgent first. */
    List<DeadlineView> of(AuthenticatedUser user, List<Deadline> deadlines) {
        if (deadlines.isEmpty()) {
            return List.of();
        }
        FirmRules.Snapshot firm = firmRules.current();
        DeadlineCalculator calculator = new DeadlineCalculator(firm.deadlinePackage().calendar(), DeadlineClock.ZONE);
        Map<UUID, List<DeadlineExtension>> extensionsByDeadline = extensions
                .findByDeadlineIdInAndArchivedAtIsNullOrderByGrantedOnAscCreatedAtAscIdAsc(
                        deadlines.stream().map(Deadline::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(DeadlineExtension::getDeadlineId));
        List<UUID> caseIds = deadlines.stream().map(Deadline::getCaseId).distinct().toList();
        Map<UUID, List<DeadlineSuspension>> suspensionsByCase = suspensions.findByCaseIdInAndArchivedAtIsNull(caseIds)
                .stream()
                .collect(Collectors.groupingBy(DeadlineSuspension::getCaseId));
        Map<UUID, DefendantRef> defendants = cases.findDefendants(
                deadlines.stream().map(Deadline::getDefendantId).filter(Objects::nonNull).distinct().toList());
        Map<UUID, CaseRef> caseRefs = cases.findAll(user, caseIds);
        Instant now = clock.now();
        LocalDate today = clock.today();

        List<DeadlineView> views = new ArrayList<>();
        for (Deadline deadline : deadlines) {
            DeadlineRule rule = firm.rule(deadline.getRuleCode());
            List<DeadlineExtension> granted = extensionsByDeadline.getOrDefault(deadline.getId(), List.of());
            DefendantRef defendant = deadline.getDefendantId() == null ? null : defendants.get(deadline.getDefendantId());
            Integer amount = rule.duration() == null
                    ? null
                    : rule.duration() + granted.stream().mapToInt(DeadlineExtension::getAmount).sum();
            Result result = calculator.compute(new Input(
                    rule.computation(),
                    amount == null ? 0 : amount,
                    deadline.getTriggeredAt(),
                    deadline.getTriggeredOn(),
                    deadline.getSetDueOn(),
                    suspensionsOf(rule, deadline, defendant,
                            suspensionsByCase.getOrDefault(deadline.getCaseId(), List.of()))));
            DeadlineStatus status = DeadlineStatus.of(result, deadline.getMetOn(), now, firm.alertDaysBefore(rule));
            views.add(new DeadlineView(
                    deadline.getId(),
                    deadline.getCaseId(),
                    caseRefs.get(deadline.getCaseId()).caption(),
                    deadline.getDefendantId(),
                    defendant == null ? null : defendant.displayName(),
                    ruleRef(rule, firm),
                    deadline.getTriggeredOn(),
                    deadline.getTriggeredAt(),
                    deadline.getSetDueOn(),
                    deadline.getHearingId(),
                    amount,
                    result.dueOn(),
                    result.dueAt(),
                    status,
                    result.dueOn() == null ? null : ChronoUnit.DAYS.between(today, result.dueOn()),
                    result.dueAt() == null ? null : Duration.between(now, result.dueAt()).toHours(),
                    result.suspendedDays(),
                    result.missingYear(),
                    extensionViews(rule, granted),
                    deadline.getMetOn(),
                    deadline.getNotes(),
                    deadline.isArchived(),
                    deadline.getCreatedAt(),
                    DISCLAIMER));
        }
        views.sort(MOST_URGENT_FIRST);
        return views;
    }

    /**
     * The periods that stop this deadline's clock: the defendant's rebellion (art. 52) and the case's
     * loaded suspensions, each only if the rule lists its kind.
     */
    private static List<Suspension> suspensionsOf(
            DeadlineRule rule, Deadline deadline, DefendantRef defendant, List<DeadlineSuspension> ofCase) {
        List<Suspension> found = new ArrayList<>();
        if (rule.isSuspendedBy(SuspensionKind.REBELLION) && defendant != null && defendant.rebellionDeclaredOn() != null) {
            found.add(new Suspension(defendant.rebellionDeclaredOn(), defendant.rebellionLiftedOn()));
        }
        ofCase.stream()
                .filter(suspension -> rule.isSuspendedBy(suspension.getKind()))
                .filter(suspension -> suspension.appliesTo(deadline.getDefendantId()))
                .forEach(suspension -> found.add(new Suspension(suspension.getStartsOn(), suspension.getEndsOn())));
        return found;
    }

    private static RuleRef ruleRef(DeadlineRule rule, FirmRules.Snapshot firm) {
        return new RuleRef(
                rule.code(),
                rule.name(),
                firm.deadlinePackage().sourceOf(rule),
                rule.kind(),
                rule.computation(),
                rule.detainee(),
                rule.consequence(),
                rule.caseLaw().status(),
                rule.caseLaw().url(),
                rule.flags(),
                firm.enabled(rule));
    }

    private static List<ExtensionView> extensionViews(DeadlineRule rule, List<DeadlineExtension> granted) {
        List<ExtensionView> views = new ArrayList<>();
        for (int i = 0; i < granted.size(); i++) {
            DeadlineExtension extension = granted.get(i);
            String grantedBy = i < rule.extensions().size() ? rule.extensions().get(i).grantedBy() : null;
            views.add(new ExtensionView(
                    extension.getId(),
                    i + 1,
                    grantedBy,
                    extension.getAmount(),
                    extension.getGrantedOn(),
                    extension.getGrantedByHearingId(),
                    extension.getNotes()));
        }
        return views;
    }
}
