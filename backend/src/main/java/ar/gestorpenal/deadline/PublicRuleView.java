package ar.gestorpenal.deadline;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.util.List;

/**
 * A built-in rule as the public calculator shows it (ADR-0041): what the law says, without any firm
 * setting.
 *
 * @param source the article and the law, ready to show next to the due date
 * @param duration in the unit of {@code computation}
 */
record PublicRuleView(
        String code,
        String name,
        String source,
        String trigger,
        Computation computation,
        int duration,
        boolean detainee,
        String consequence,
        List<ReviewFlag> flags,
        String note,
        String disclaimer) {

    static PublicRuleView of(DeadlineRule rule, DeadlinePackage deadlinePackage) {
        return new PublicRuleView(
                rule.code(),
                rule.name(),
                deadlinePackage.sourceOf(rule),
                rule.trigger(),
                rule.computation(),
                rule.duration(),
                rule.detainee(),
                rule.consequence(),
                rule.flags(),
                rule.note(),
                DeadlineViews.DISCLAIMER);
    }
}
