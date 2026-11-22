package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.DeadlineRule.CaseLaw;
import ar.gestorpenal.deadline.DeadlineRule.ExtensionStep;
import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.util.List;

/**
 * A built-in rule with the firm's settings. Everything but {@code enabled} and {@code alertDaysBefore}
 * comes from the jurisdiction package and cannot be changed.
 *
 * @param source the article and the law, ready to show next to every due date
 * @param duration in the unit of {@code computation}; {@code null} for a judicial deadline
 */
record DeadlineRuleView(
        String code,
        String name,
        String source,
        String article,
        String trigger,
        RuleKind kind,
        Computation computation,
        Integer duration,
        RuleScope scope,
        boolean detainee,
        String consequence,
        CaseLaw caseLaw,
        List<ExtensionStep> extensions,
        List<SuspensionKind> suspendedBy,
        List<ReviewFlag> flags,
        String note,
        boolean enabled,
        int alertDaysBefore,
        int defaultAlertDaysBefore,
        String disclaimer) {

    static DeadlineRuleView of(DeadlineRule rule, FirmRules.Snapshot firm) {
        return new DeadlineRuleView(
                rule.code(),
                rule.name(),
                firm.deadlinePackage().sourceOf(rule),
                rule.article(),
                rule.trigger(),
                rule.kind(),
                rule.computation(),
                rule.duration(),
                rule.scope(),
                rule.detainee(),
                rule.consequence(),
                rule.caseLaw(),
                rule.extensions(),
                rule.suspendedBy(),
                rule.flags(),
                rule.note(),
                firm.enabled(rule),
                firm.alertDaysBefore(rule),
                rule.alertDaysBefore(),
                DeadlineViews.DISCLAIMER);
    }
}
