package ar.gestorpenal.deadline;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The deadline rules of one practice area and the court calendar of its jurisdiction (ADR-0017,
 * ADR-0032), read once at startup from {@code resources/jurisdictions/<code>/<area>/} and shared,
 * read-only, by every firm of the jurisdiction.
 *
 * @param law the code of procedure, the source of every rule that names no law of its own
 */
record DeadlinePackage(
        String jurisdictionCode,
        String areaCode,
        String law,
        String source,
        List<DeadlineRule> rules,
        CourtCalendar calendar) {

    DeadlinePackage {
        rules = List.copyOf(rules);
    }

    /** An area that ships no rules: nothing to compute. The calendar is the jurisdiction's. */
    static DeadlinePackage empty(String jurisdictionCode, String areaCode, CourtCalendar calendar) {
        return new DeadlinePackage(jurisdictionCode, areaCode, null, null, List.of(), calendar);
    }

    /** A jurisdiction without any calendar: every year unknown. */
    static CourtCalendar noCalendar() {
        return new CourtCalendar(Set.of(), Map.of(), null, List.of());
    }

    Optional<DeadlineRule> rule(String code) {
        return rules.stream().filter(rule -> rule.code().equals(code)).findFirst();
    }

    /** "Art. 158; 160 inc. 7 · CPP de Neuquén (Ley 2784)", or the rule's own law alone when it has no article. */
    String sourceOf(DeadlineRule rule) {
        String ruleLaw = rule.law() == null ? law : rule.law();
        return rule.article() == null ? ruleLaw : "Art. " + rule.article() + " · " + ruleLaw;
    }
}
